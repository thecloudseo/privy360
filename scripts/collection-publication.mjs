import { rename, rm } from "node:fs/promises";

export async function publishCompletedCollection(stage, output, complete) {
  if (!complete)
    throw new Error("Incomplete evidence collection cannot be published.");
  const backup = `${output}.previous`;
  await rm(backup, { recursive: true, force: true });
  await rename(output, backup).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  try {
    await rename(stage, output);
  } catch (error) {
    await rename(backup, output).catch(() => {});
    throw error;
  }
  await rm(backup, { recursive: true, force: true });
}
