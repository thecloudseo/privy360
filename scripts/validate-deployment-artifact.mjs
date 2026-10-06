import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { validatePromotion } from "./local-security-policy.mjs";

const images = JSON.parse(
  await readFile(
    new URL("../infra/docker/security/images.json", import.meta.url),
    "utf8",
  ),
).images;
const [context, file] = process.argv.slice(2);
if (!context || !file) {
  console.error(
    "Usage: node scripts/validate-deployment-artifact.mjs CONTEXT ARTIFACT_JSON",
  );
  process.exitCode = 2;
} else {
  try {
    const artifact = JSON.parse(await readFile(file, "utf8"));
    const errors = validatePromotion({ context, images, artifact });
    if (errors.length) throw new Error(errors.join(" "));
    console.log("Deployment artifact passed local-stack exclusion.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
