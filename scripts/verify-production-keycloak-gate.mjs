import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import console from "node:console";
import process from "node:process";
import {
  validateTrivyOutput,
  scannerEnvironment,
} from "./scanner-evidence.mjs";

const root = resolve(import.meta.dirname, "..");
const security = resolve(root, "infra/docker/security");
const images = JSON.parse(
  await readFile(resolve(security, "images.json"), "utf8"),
).images;
const image = images.keycloak.image;
const args = [
  "image",
  "--config",
  resolve(security, "trivy-image.yaml"),
  "--ignorefile",
  "/dev/null",
  "--cache-dir",
  resolve(root, ".cache/trivy-db"),
  "--scanners",
  "vuln",
  "--severity",
  "HIGH,CRITICAL",
  "--list-all-pkgs",
  "--exit-code",
  "1",
  "--format",
  "json",
  image,
];
const env = scannerEnvironment(process.env);
env.HOME = resolve(root, ".cache/scanner-home");
env.DOCKER_CONFIG = env.HOME;
env.XDG_CONFIG_HOME = env.HOME;
env.XDG_CACHE_HOME = resolve(env.HOME, "cache");
const dbPath = resolve(root, ".cache/trivy-db/db/metadata.json");
const dbBefore = JSON.parse(await readFile(dbPath, "utf8"));
const result = spawnSync(resolve(root, ".cache/trivy"), args, {
  cwd: root,
  env,
  encoding: "utf8",
  timeout: 120_000,
  maxBuffer: 100 * 1024 * 1024,
});
try {
  if (result.error) throw result.error;
  const raw = JSON.parse(result.stdout);
  const findings = validateTrivyOutput(raw, image);
  const dbAfter = JSON.parse(await readFile(dbPath, "utf8"));
  const scannedAt = Date.parse(raw.CreatedAt);
  if (
    !Number.isFinite(scannedAt) ||
    dbBefore.Version !== dbAfter.Version ||
    dbBefore.UpdatedAt !== dbAfter.UpdatedAt ||
    !Number.isFinite(Date.parse(dbAfter.UpdatedAt)) ||
    Date.parse(dbAfter.UpdatedAt) > scannedAt
  )
    throw new Error(
      "Vulnerability database used by production scan cannot be established.",
    );
  if (result.status !== 1 || !findings.length)
    throw new Error(
      "Production High/Critical gate did not reject the vulnerable Keycloak image.",
    );
  const compressed = gzipSync(result.stdout);
  const summary = {
    schemaVersion: 1,
    image,
    platform: images.keycloak.platform,
    scanner: "Trivy",
    scannerVersion: raw.Trivy.Version,
    scannerBinarySha256: createHash("sha256")
      .update(await readFile(resolve(root, ".cache/trivy")))
      .digest("hex"),
    databaseVersion: dbAfter.Version,
    databaseUpdatedAt: new Date(dbAfter.UpdatedAt).toISOString(),
    scannedAt: new Date(scannedAt).toISOString(),
    scanCommand:
      "trivy image --config infra/docker/security/trivy-image.yaml --ignorefile /dev/null --cache-dir <local-cache> --scanners vuln --severity HIGH,CRITICAL --list-all-pkgs --exit-code 1 --format json <pinned-Keycloak-image>",
    exitStatus: result.status,
    highCriticalOccurrences: findings.length,
    originalFile: "production-gate-keycloak.json.gz",
    originalSha256: createHash("sha256").update(compressed).digest("hex"),
    result: "rejected",
    localDispositionsApplied: false,
  };
  await writeFile(resolve(security, summary.originalFile), compressed);
  await writeFile(
    resolve(security, "production-gate-keycloak.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(
    `Production-style High/Critical gate rejected exact Keycloak image: exit ${result.status}, ${findings.length} occurrences.`,
  );
} catch (error) {
  console.error(
    `Production-style image scan failed without a valid security result: ${error.message}; exit ${result.status ?? "unknown"}.`,
  );
  process.exitCode = 1;
}
