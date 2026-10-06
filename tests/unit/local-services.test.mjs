import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import {
  validateCredentials,
  summarizeStatus,
  missingServices,
  unhealthyServices,
  probeReady,
} from "../../scripts/local-services.mjs";

const compose = await readFile(
  new URL("../../infra/docker/compose.yaml", import.meta.url),
  "utf8",
);

test("local credentials require distinct strong values", () => {
  const names = [
    "APP_DB_PASSWORD",
    "IDP_DB_PASSWORD",
    "TEMPORAL_DB_PASSWORD",
    "REDIS_PASSWORD",
    "KEYCLOAK_ADMIN_PASSWORD",
    "MINIO_ROOT_USER",
    "MINIO_ROOT_PASSWORD",
  ];
  const valid = Object.fromEntries(
    names.map((name, index) => [name, String(index).repeat(24)]),
  );
  assert.equal(validateCredentials(valid), true);
  assert.equal(
    validateCredentials({ ...valid, IDP_DB_PASSWORD: valid.APP_DB_PASSWORD }),
    false,
  );
  assert.equal(
    validateCredentials({ ...valid, MINIO_ROOT_PASSWORD: "password" }),
    false,
  );
  assert.equal(
    validateCredentials({ ...valid, REDIS_PASSWORD: undefined }),
    false,
  );
});

test("required local services and separated databases are defined", () => {
  for (const service of [
    "app-db",
    "idp-db",
    "temporal-db",
    "redis",
    "keycloak",
    "temporal-setup",
    "temporal",
    "minio",
  ]) {
    assert.match(compose, new RegExp(`^  ${service}:`, "m"));
  }
  for (const volume of [
    "app-db-v18-data",
    "idp-db-v18-data",
    "temporal-db-v18-data",
  ])
    assert.match(compose, new RegExp(`^  ${volume}:`, "m"));
  assert.equal((compose.match(/POSTGRES_PASSWORD: \$\{/g) ?? []).length, 3);
});

test("no service port is published and critical services expose readiness", () => {
  assert.doesNotMatch(compose, /^ {4}ports:/m);
  assert.ok(compose.includes("/health/ready"));
  assert.match(
    compose,
    /temporal:\n[\s\S]*?healthcheck:[\s\S]*?nc, -z, localhost, "7233"/,
  );
});

test("unhealthy service state is visible", () => {
  const output = JSON.stringify({
    Service: "minio",
    State: "running",
    Health: "unhealthy",
  });
  assert.deepEqual(summarizeStatus(output), ["minio: running (unhealthy)"]);
});

test("missing Temporal and storage readiness failures are visible", async () => {
  const output = JSON.stringify({ Service: "minio", State: "running" });
  assert.ok(missingServices(output).includes("temporal"));
  assert.ok(missingServices(output).includes("keycloak"));
  assert.deepEqual(
    unhealthyServices(
      JSON.stringify({
        Service: "keycloak",
        State: "running",
        Health: "unhealthy",
      }),
    ),
    ["keycloak"],
  );
  assert.deepEqual(
    unhealthyServices(JSON.stringify({ Service: "temporal", State: "exited" })),
    ["temporal"],
  );
  assert.equal(
    await probeReady(async () => {
      throw new Error("offline");
    }),
    false,
  );
  assert.equal(await probeReady(async () => {}), true);
});
