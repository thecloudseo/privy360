import { readFile, readdir } from "node:fs/promises";
import { resolve, join, extname, relative } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { validatePromotion } from "./local-security-policy.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const images = JSON.parse(
  await readFile(resolve(root, "infra/docker/security/images.json"), "utf8"),
).images;
const artifactExtensions = new Set([".yaml", ".yml", ".json", ".toml", ".tf"]);
const contexts = new Set([
  "staging",
  "saas-production",
  "customer-vpc",
  "government-on-premise",
  "offline-release",
]);

export function deploymentBoundaryErrors(content, path) {
  if (extname(path) !== ".json")
    return [
      `${path}: unsupported deployment artifact form; validate rendered JSON.`,
    ];
  let artifact;
  try {
    artifact = JSON.parse(content);
  } catch {
    return [`${path}: malformed deployment artifact.`];
  }
  if (!contexts.has(artifact?.context))
    return [`${path}: deployment context is required.`];
  return validatePromotion({ context: artifact.context, images, artifact }).map(
    (error) => `${path}: ${error}`,
  );
}

async function scan(directory) {
  const errors = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isSymbolicLink())
      errors.push(
        `${relative(root, path)}: symlinked deployment artifact forbidden.`,
      );
    else if (item.isDirectory()) errors.push(...(await scan(path)));
    else if (item.isFile() && artifactExtensions.has(extname(path)))
      errors.push(
        ...deploymentBoundaryErrors(await readFile(path, "utf8"), path),
      );
  }
  return errors;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = [];
  for (const path of ["infra/helm", "infra/kubernetes", "infra/terraform"])
    errors.push(...(await scan(resolve(root, path))));
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      "No local-only material in supported rendered deployable artifacts; independent production scan remains required.",
    );
}
