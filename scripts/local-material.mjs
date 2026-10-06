import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function tree(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink())
    throw new Error("Mounted symlinks are unsupported.");
  if (stat.isFile())
    return {
      type: "file",
      mode: stat.mode & 0o777,
      sha256: digest(await readFile(path)),
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
