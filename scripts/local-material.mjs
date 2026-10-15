import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Read through a descriptor opened with O_NOFOLLOW and verify it is the same inode
// we lstat'd, so a path swapped between check and read cannot redirect the read.
async function readVerifiedFile(path, expected) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== expected.dev ||
      opened.ino !== expected.ino
    )
      throw new Error("Mounted material changed during read.");
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function tree(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink())
    throw new Error("Mounted symlinks are unsupported.");
  if (stat.isFile())
    return {
      type: "file",
      mode: stat.mode & 0o777,
      sha256: digest(await readVerifiedFile(path, stat)),
    };
  if (!stat.isDirectory()) throw new Error("Unsupported mounted material.");
  const entries = {};
  for (const name of (await readdir(path)).sort())
    entries[name] = await tree(resolve(path, name));
  return { type: "directory", mode: stat.mode & 0o777, entries };
}

export async function mountedMaterial(config, allowedRoot) {
  const root = await realpath(allowedRoot);
  const result = {};
  for (const service of Object.values(config.services ?? {})) {
    for (const mount of service.volumes ?? []) {
      if (mount.type !== "bind") continue;
      if (!mount.read_only || typeof mount.source !== "string")
        throw new Error("Mounted file must be a read-only bind.");
      if ((await lstat(mount.source)).isSymbolicLink())
        throw new Error("Mounted symlinks are unsupported.");
      const path = await realpath(mount.source);
      const rel = relative(root, path);
      if (
        !rel ||
        rel === ".." ||
        rel.startsWith(`..${sep}`) ||
        rel.startsWith(sep)
      )
        throw new Error(
          "Mounted file must remain inside the reviewed local Docker directory.",
        );
      result[rel] = await tree(path);
    }
  }
  return result;
}
