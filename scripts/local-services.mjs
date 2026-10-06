import { randomBytes, randomUUID } from "node:crypto";
import console from "node:console";
import process from "node:process";
import { constants } from "node:fs";
import { mkdir, open, lstat, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { validateLocalCompose } from "./local-security-policy.mjs";
import { configurationHash } from "./local-security-policy.mjs";
import { mountedMaterial } from "./local-material.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const compose = resolve(repo, "infra/docker/compose.yaml");
const localFile = resolve(repo, "infra/docker/.local/credentials.json");
const imageFile = resolve(repo, "infra/docker/security/images.json");
const keys = [
  "APP_DB_PASSWORD",
  "IDP_DB_PASSWORD",
  "TEMPORAL_DB_PASSWORD",
  "REDIS_PASSWORD",
  "KEYCLOAK_ADMIN_PASSWORD",
  "MINIO_ROOT_USER",
  "MINIO_ROOT_PASSWORD",
];
const requiredServices = [
  "app-db",
  "idp-db",
  "temporal-db",
  "redis",
  "keycloak",
  "temporal",
  "minio",
];

function operationalEvent(type) {
  console.log(
    JSON.stringify({
      eventId: randomUUID(),
      type,
      at: new globalThis.Date().toISOString(),
    }),
  );
}

export function validateCredentials(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  return (
    Object.keys(value).sort().join() === keys.slice().sort().join() &&
    keys.every(
      (key) =>
        typeof value[key] === "string" && /^[A-Za-z0-9]{24,}$/.test(value[key]),
    ) &&
    new Set(keys.map((key) => value[key])).size === keys.length
  );
}

async function credentials() {
  const directory = dirname(localFile);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryStat = await lstat(directory);
  if (!directoryStat.isDirectory() || directoryStat.mode & 0o077)
    throw new Error("Local credential directory permissions are unsafe.");
  try {
    const handle = await open(
      localFile,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    let values;
    try {
      const fileStat = await handle.stat();
      if (!fileStat.isFile() || fileStat.mode & 0o077)
        throw new Error("Local credential file permissions are unsafe.");
      values = JSON.parse(await handle.readFile("utf8"));
    } finally {
      await handle.close();
    }
    if (!validateCredentials(values))
      throw new Error("Invalid local credentials.");
    return values;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const values = Object.fromEntries(
    keys.map((key) => [key, randomBytes(24).toString("hex")]),
  );
  const handle = await open(localFile, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(values)}\n`);
  } finally {
    await handle.close();
  }
  return values;
}

function run(args, env, inherit = true, frozenConfig = null) {
  const timeoutMs =
    args[0] === "up" ? 330_000 : args[0] === "down" ? 120_000 : 30_000;
  const result = spawnSync(
    "docker",
    ["compose", "-f", frozenConfig ? "-" : compose, ...args],
    {
      cwd: dirname(compose),
      env: { ...process.env, COMPOSE_PROGRESS: "quiet", ...env },
      encoding: "utf8",
      stdio:
        frozenConfig === null
          ? inherit
            ? "inherit"
            : "pipe"
          : [
              "pipe",
              inherit ? "inherit" : "pipe",
              inherit ? "inherit" : "pipe",
            ],
      timeout: timeoutMs,
      input: frozenConfig === null ? undefined : JSON.stringify(frozenConfig),
    },
  );
  if (result.error?.code === "ETIMEDOUT")
    throw new Error(
      `Docker Compose ${args[0]} timed out after ${timeoutMs / 1000}s; inspect local service health and bounded logs.`,
    );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Docker Compose failed (exit ${result.status}).`);
  return result.stdout;
}

const credentialLocations = {
  "app-db": { POSTGRES_PASSWORD: "APP_DB_PASSWORD" },
  "idp-db": { POSTGRES_PASSWORD: "IDP_DB_PASSWORD" },
  "temporal-db": { POSTGRES_PASSWORD: "TEMPORAL_DB_PASSWORD" },
  redis: { REDIS_PASSWORD: "REDIS_PASSWORD" },
  keycloak: {
    KC_DB_PASSWORD: "IDP_DB_PASSWORD",
    KC_BOOTSTRAP_ADMIN_PASSWORD: "KEYCLOAK_ADMIN_PASSWORD",
  },
  temporal: { POSTGRES_PWD: "TEMPORAL_DB_PASSWORD" },
  "temporal-setup": { SQL_PASSWORD: "TEMPORAL_DB_PASSWORD" },
  minio: {
    MINIO_ROOT_USER: "MINIO_ROOT_USER",
    MINIO_ROOT_PASSWORD: "MINIO_ROOT_PASSWORD",
  },
};

export function redactConfig(value, credentials) {
  if (!validateCredentials(credentials))
    throw new Error("Invalid local credentials.");
  const redacted = globalThis.structuredClone(value);
  for (const [service, fields] of Object.entries(credentialLocations)) {
    for (const [field, credential] of Object.entries(fields)) {
      if (
        redacted.services?.[service]?.environment?.[field] !==
        credentials[credential]
      )
        throw new Error(
          `${service}: expected credential location missing or changed.`,
        );
      redacted.services[service].environment[field] = "<local-credential>";
    }
  }
  const serialized = JSON.stringify(redacted);
  if (Object.values(credentials).some((secret) => serialized.includes(secret)))
    throw new Error(
      "Credential appears in an unreviewed configuration location.",
    );
  return redacted;
}

export function executionBindingMatches(binding, config, mounts) {
  return binding?.configurationHash === configurationHash(config, mounts);
}

export function summarizeStatus(output) {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const service = JSON.parse(line);
      return `${service.Service}: ${service.State}${service.Health ? ` (${service.Health})` : ""}`;
    });
}

export function missingServices(output) {
  const services = new Set(
    output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line).Service),
  );
  return requiredServices.filter((service) => !services.has(service));
}

export function unhealthyServices(output) {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter(
      (service) =>
        service.State !== "running" ||
        (service.Health && service.Health !== "healthy"),
    )
    .map((service) => service.Service);
}

export async function probeReady(probe) {
  try {
    await probe();
    return true;
  } catch {
    return false;
  }
}

async function reportStatus(env, waitForDependencies = false) {
  const output = run(["ps", "--format", "json"], env, false);
  if (!output.trim()) {
    console.log("No local services running.");
    return false;
  }
  console.log(summarizeStatus(output).join("\n"));
  const missing = missingServices(output);
  if (missing.length)
    throw new Error(`Missing local services: ${missing.join(", ")}.`);
  const unhealthy = unhealthyServices(output);
  if (unhealthy.length)
    throw new Error(`Unready local services: ${unhealthy.join(", ")}.`);
  const storageProbe = () =>
    run(["run", "--rm", "--no-deps", "-T", "storage-probe"], env, false);
  const temporalProbe = () =>
    run(["run", "--rm", "--no-deps", "-T", "temporal-probe"], env, false);
  let storageReady = await probeReady(storageProbe);
  let temporalReady = await probeReady(temporalProbe);
  const deadline = Date.now() + 120_000;
  while (
    waitForDependencies &&
    (!storageReady || !temporalReady) &&
    Date.now() < deadline
  ) {
    await setTimeout(2000);
    if (!storageReady) storageReady = await probeReady(storageProbe);
    if (!temporalReady) temporalReady = await probeReady(temporalProbe);
  }
  console.log(`minio readiness: ${storageReady ? "healthy" : "failed"}`);
  console.log(`temporal readiness: ${temporalReady ? "healthy" : "failed"}`);
  if (!storageReady || !temporalReady)
    throw new Error(
      `Local readiness failed for ${[
        !storageReady && "minio",
        !temporalReady && "temporal",
      ]
        .filter(Boolean)
        .join(", ")} within the 120s probe deadline.`,
    );
  return true;
}

async function assertLocalBoundary(env) {
  const manifest = JSON.parse(await readFile(imageFile, "utf8"));
  const config = JSON.parse(
    run(["--profile", "probe", "config", "--format", "json"], env, false),
  );
  const errors = validateLocalCompose(config, manifest.images);
  if (errors.length)
    throw new Error(`Local service boundary failed: ${errors.join(" ")}`);
}

function securityCheck(action, timeoutMs) {
  const result = spawnSync(
    process.execPath,
    [resolve(repo, "scripts/local-image-evidence.mjs"), action],
    {
      cwd: repo,
      encoding: "utf8",
      stdio: "pipe",
      timeout: timeoutMs,
    },
  );
  if (result.error?.code === "ETIMEDOUT")
    throw new Error(
      `Local security ${action} timed out after ${timeoutMs / 1000}s.`,
    );
  if (result.error || result.status !== 0)
    throw new Error(
      `Local security ${action} denied: ${result.stderr?.trim() || result.error?.message || "scanner failed"}`,
    );
  return result.stdout;
}

function assertLocalEligibility() {
  securityCheck("preflight", 30_000);
  const output = securityCheck("collect-evaluate", 600_000);
  const line = output
    .split("\n")
    .find((item) => item.startsWith("LOCAL_ELIGIBILITY_BINDING="));
  if (!line)
    throw new Error(
      "Local eligibility did not return an exact material binding.",
    );
  return { configurationHash: line.slice("LOCAL_ELIGIBILITY_BINDING=".length) };
}

const command = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  if (
    !["up", "down", "status", "config", "security-config"].includes(command)
  ) {
    console.error(
      "Usage: node scripts/local-services.mjs up|down|status|config|security-config",
    );
    process.exitCode = 2;
  } else {
    try {
      const env = await credentials();
      if (command !== "down" && command !== "security-config")
        await assertLocalBoundary(env);
      if (command === "security-config") {
        const config = JSON.parse(
          run(["--profile", "probe", "config", "--format", "json"], env, false),
        );
        const manifest = JSON.parse(await readFile(imageFile, "utf8"));
        const errors = validateLocalCompose(config, manifest.images);
        if (errors.length) throw new Error(errors.join(" "));
        console.log(JSON.stringify(redactConfig(config, env)));
      } else if (command === "config") {
        run(["config", "--quiet"], env);
        console.log("Local service configuration valid.");
        operationalEvent("LocalServiceConfigValidated");
      } else if (command === "up") {
        const binding = assertLocalEligibility();
        const frozenConfig = JSON.parse(
          run(["--profile", "probe", "config", "--format", "json"], env, false),
        );
        const redacted = redactConfig(frozenConfig, env);
        const mounts = await mountedMaterial(redacted, dirname(compose));
        if (!executionBindingMatches(binding, redacted, mounts))
          throw new Error(
            "Local service configuration changed after security review.",
          );
        const boundary = validateLocalCompose(
          redacted,
          JSON.parse(await readFile(imageFile, "utf8")).images,
        );
        if (boundary.length)
          throw new Error(
            `Local service boundary changed: ${boundary.join(" ")}`,
          );
        console.log("Starting local services.");
        run(
          ["up", "-d", "--wait", "--wait-timeout", "300"],
          env,
          true,
          frozenConfig,
        );
        await reportStatus(env, true);
        operationalEvent("LocalServicesStarted");
      } else if (command === "down") {
        run(["down"], env);
        console.log("Local services stopped; data volumes retained.");
        operationalEvent("LocalServicesStopped");
      } else {
        await reportStatus(env);
      }
    } catch (error) {
      console.error(error.message);
      if (error.message.startsWith("Local security"))
        console.error("Local eligibility denied; no services were started.");
      else if (command === "up" || command === "status")
        console.error(
          "Readiness unavailable; inspect Docker Compose service health and logs locally.",
        );
      operationalEvent("LocalServiceOperationFailed");
      process.exitCode = 1;
    }
  }
}
