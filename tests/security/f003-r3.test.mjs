import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  cp1PostgresVerificationConfiguration,
  configurationHash,
  scopeLocalServiceConfiguration,
  validateLocalCompose,
  validatePromotion,
  validDisposition,
} from "../../scripts/local-security-policy.mjs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import process from "node:process";
import { URL } from "node:url";
import {
  validateCredentials,
  redactConfig,
  executionBindingMatches,
} from "../../scripts/local-services.mjs";
import {
  validateTrivyOutput,
  validateSyftOutput,
  findingsMatchOriginal,
  validateImageIdentity,
} from "../../scripts/scanner-evidence.mjs";
import { publishCompletedCollection } from "../../scripts/collection-publication.mjs";

const root = new URL("../../infra/docker/security/", import.meta.url);
const images = JSON.parse(readFileSync(new URL("images.json", root))).images;
const keycloak = images.keycloak.image;
const suffix = keycloak.split("@sha256:")[1];
const trivy = JSON.parse(
  gunzipSync(readFileSync(new URL(`evidence/trivy-${suffix}.json.gz`, root))),
);
const syft = JSON.parse(
  gunzipSync(readFileSync(new URL(`evidence/syft-${suffix}.json.gz`, root))),
);
const clone = (value) => globalThis.structuredClone(value);

test("service-scoped admission retains only the selected reviewed boundary", () => {
  const config = {
    name: "privy360-local",
    services: {
      "app-db": {
        image: images["app-db"].image,
        platform: "linux/amd64",
        mem_limit: 512 * 1024 * 1024,
        cpus: 1,
        pids_limit: 256,
        security_opt: ["no-new-privileges:true"],
        networks: { "app-net": null },
        volumes: [
          {
            type: "volume",
            source: "app-db-v18-data",
            target: "/var/lib/postgresql/data",
          },
        ],
      },
      keycloak: {
        image: images.keycloak.image,
        platform: "linux/amd64",
        mem_limit: 1536 * 1024 * 1024,
        cpus: 2,
        pids_limit: 512,
        security_opt: ["no-new-privileges:true"],
        networks: { "app-net": null },
      },
    },
    networks: { "app-net": { internal: true } },
    volumes: { "app-db-v18-data": {} },
  };

  const scoped = scopeLocalServiceConfiguration(
    config,
    {
      "app-db": images["app-db"],
      keycloak: images.keycloak,
    },
    ["app-db"],
  );

  assert.deepEqual(Object.keys(scoped.config.services), ["app-db"]);
  assert.deepEqual(Object.keys(scoped.images), ["app-db"]);
  assert.deepEqual(Object.keys(scoped.config.networks), ["app-net"]);
  assert.deepEqual(Object.keys(scoped.config.volumes), ["app-db-v18-data"]);
  assert.deepEqual(validateLocalCompose(scoped.config, scoped.images), []);
});

test("service-scoped admission fails closed for unknown or changed services", () => {
  const config = {
    name: "privy360-local",
    services: {
      "app-db": {
        image: images["app-db"].image,
        platform: "linux/amd64",
        mem_limit: 512 * 1024 * 1024,
        cpus: 1,
        pids_limit: 256,
        security_opt: ["no-new-privileges:true"],
        networks: { "app-net": null },
      },
    },
    networks: { "app-net": { internal: true } },
    volumes: {},
  };
  const inventory = { "app-db": images["app-db"] };

  assert.throws(() =>
    scopeLocalServiceConfiguration(config, inventory, ["keycloak"]),
  );
  const changed = clone(config);
  changed.services["app-db"].image =
    "cgr.dev/chainguard/postgres@sha256:" + "0".repeat(64);
  assert.throws(() =>
    scopeLocalServiceConfiguration(changed, inventory, ["app-db"]),
  );
});

test("CP1 PostgreSQL verification changes only the initialization role", () => {
  const source = {
    name: "privy360-local",
    services: {
      "app-db": {
        image: images["app-db"].image,
        platform: "linux/amd64",
        mem_limit: 512 * 1024 * 1024,
        cpus: 1,
        pids_limit: 256,
        security_opt: ["no-new-privileges:true"],
        environment: {
          POSTGRES_DB: "privy360",
          POSTGRES_USER: "privy360_app",
          POSTGRES_PASSWORD: "<local-credential>",
        },
        networks: { "app-net": null },
      },
    },
    networks: { "app-net": { internal: true } },
    volumes: {},
  };
  const transformed = cp1PostgresVerificationConfiguration(source);

  assert.equal(
    transformed.services["app-db"].environment.POSTGRES_USER,
    "privy360_cp1_bootstrap",
  );
  const restored = clone(transformed);
  restored.services["app-db"].environment.POSTGRES_USER = "privy360_app";
  assert.deepEqual(restored, source);
  assert.deepEqual(source.services["app-db"].environment, {
    POSTGRES_DB: "privy360",
    POSTGRES_USER: "privy360_app",
    POSTGRES_PASSWORD: "<local-credential>",
  });
});

test("service-scoped preflight permits clean PostgreSQL and denies vulnerable images", () => {
  const run = (service, cp1 = false) =>
    spawnSync(
      process.execPath,
      [
        new URL("../../scripts/local-image-evidence.mjs", import.meta.url)
          .pathname,
        "preflight",
        "--service",
        service,
        ...(cp1 ? ["--cp1-postgres"] : []),
      ],
      { encoding: "utf8" },
    );

  const postgres = run("app-db");
  assert.equal(postgres.status, 0, postgres.stderr);
  assert.match(postgres.stdout, /app-db/);
  const cp1Postgres = run("app-db", true);
  assert.equal(cp1Postgres.status, 0, cp1Postgres.stderr);
  assert.match(cp1Postgres.stdout, /CP1 PostgreSQL/);

  const keycloakResult = run("keycloak");
  assert.equal(keycloakResult.status, 1);
  assert.match(keycloakResult.stderr, /High\/Critical findings/);

  const unknown = run("unknown");
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /reviewed local inventory/);
});

test("R3 rejects unsupported top-level Compose configs and secrets", () => {
  const base = {
    name: "privy360-local",
    services: {
      keycloak: {
        image: keycloak,
        platform: "linux/amd64",
        mem_limit: 100,
        cpus: 1,
        pids_limit: 20,
        security_opt: ["no-new-privileges:true"],
        networks: { local: null },
      },
    },
    networks: { local: { internal: true } },
  };
  for (const field of ["configs", "secrets"]) {
    const changed = { ...base, [field]: { runtime: { file: "./runtime" } } };
    assert.notDeepEqual(
      validateLocalCompose(changed, { keycloak: images.keycloak }),
      [],
    );
  }
});

test("R3 credential redaction cannot erase unrelated configuration", () => {
  const names = [
    "APP_DB_PASSWORD",
    "IDP_DB_PASSWORD",
    "TEMPORAL_DB_PASSWORD",
    "REDIS_PASSWORD",
    "KEYCLOAK_ADMIN_PASSWORD",
    "MINIO_ROOT_USER",
    "MINIO_ROOT_PASSWORD",
  ];
  const credentials = Object.fromEntries(
    names.map((name, index) => [name, String(index).repeat(24)]),
  );
  assert.equal(
    validateCredentials({ ...credentials, EXTRA: "relaxed" }),
    false,
  );
  const config = {
    services: {
      "app-db": {
        environment: { POSTGRES_PASSWORD: credentials.APP_DB_PASSWORD },
      },
      "idp-db": {
        environment: { POSTGRES_PASSWORD: credentials.IDP_DB_PASSWORD },
      },
      "temporal-db": {
        environment: { POSTGRES_PASSWORD: credentials.TEMPORAL_DB_PASSWORD },
      },
      redis: { environment: { REDIS_PASSWORD: credentials.REDIS_PASSWORD } },
      keycloak: {
        environment: {
          KC_DB_PASSWORD: credentials.IDP_DB_PASSWORD,
          KC_BOOTSTRAP_ADMIN_PASSWORD: credentials.KEYCLOAK_ADMIN_PASSWORD,
          SECURITY_MODE: "relaxed",
        },
      },
      temporal: {
        environment: { POSTGRES_PWD: credentials.TEMPORAL_DB_PASSWORD },
      },
      "temporal-setup": {
        environment: { SQL_PASSWORD: credentials.TEMPORAL_DB_PASSWORD },
      },
      minio: {
        environment: {
          MINIO_ROOT_USER: credentials.MINIO_ROOT_USER,
          MINIO_ROOT_PASSWORD: credentials.MINIO_ROOT_PASSWORD,
        },
      },
    },
  };
  assert.equal(
    redactConfig(config, credentials).services.keycloak.environment
      .KC_DB_PASSWORD,
    "<local-credential>",
  );
  assert.equal(
    redactConfig(config, credentials).services.keycloak.environment
      .SECURITY_MODE,
    "relaxed",
  );
  const collision = globalThis.structuredClone(config);
  collision.services.keycloak.environment.SECURITY_MODE =
    credentials.APP_DB_PASSWORD;
  assert.throws(() => redactConfig(collision, credentials));
  const reviewed = redactConfig(config, credentials);
  const binding = { configurationHash: configurationHash(reviewed, {}) };
  assert.equal(executionBindingMatches(binding, reviewed, {}), true);
  const mutated = globalThis.structuredClone(reviewed);
  mutated.services.keycloak.environment.SECURITY_MODE = "changed-after-review";
  assert.equal(executionBindingMatches(binding, mutated, {}), false);
  assert.equal(
    executionBindingMatches(binding, reviewed, {
      "/mounted/setup-temporal.sh": "changed-content",
    }),
    false,
  );
});

test("R3 material binding includes reviewed image scanner policy", () => {
  const config = {
    name: "privy360-local",
    services: {},
    networks: {},
    volumes: {},
  };
  const base = {
    scope: "local-development",
    images: { keycloak: { image: keycloak, minimumKnownFindings: 23 } },
  };
  const relaxed = {
    ...base,
    images: { keycloak: { ...base.images.keycloak, minimumKnownFindings: 0 } },
  };
  assert.notEqual(
    configurationHash(config, {}, base),
    configurationHash(config, {}, relaxed),
  );
});

test("R3 rejects unsupported and partial scanner output", () => {
  assert.throws(() =>
    validateTrivyOutput({ ...trivy, SchemaVersion: 999 }, keycloak),
  );
  assert.throws(() =>
    validateTrivyOutput(
      {
        ...trivy,
        Results: [{ Target: "partial", Class: "os-pkgs", Type: "redhat" }],
      },
      keycloak,
    ),
  );
  assert.throws(() =>
    validateTrivyOutput(
      {
        ...trivy,
        Results: trivy.Results.map((result) => ({
          ...result,
          Vulnerabilities: [],
        })),
      },
      keycloak,
      images.keycloak,
    ),
  );
  assert.throws(() =>
    validateSyftOutput({ ...syft, schema: { version: "999" } }, keycloak),
  );
  assert.throws(() =>
    validateSyftOutput(
      { ...syft, artifacts: syft.artifacts.slice(0, 1) },
      keycloak,
    ),
  );
  const swapped = clone(syft);
  const other = "example.test/other@sha256:" + "1".repeat(64);
  swapped.source.metadata.userInput = other;
  swapped.source.version = "sha256:" + "1".repeat(64);
  assert.throws(() => validateSyftOutput(swapped, other));
  const wrongPlatform = clone(syft);
  wrongPlatform.source.metadata.config = Buffer.from(
    JSON.stringify({ os: "linux", architecture: "arm64" }),
  ).toString("base64");
  assert.throws(() => validateSyftOutput(wrongPlatform, keycloak));
});

test("R3 cryptographically connects requested index, selected manifest and Syft config", () => {
  const manifest = Buffer.from(syft.source.metadata.manifest, "base64");
  const selectedDigest =
    "sha256:" + createHash("sha256").update(manifest).digest("hex");
  const index = Buffer.from(
    JSON.stringify({
      schemaVersion: 2,
      manifests: [
        {
          digest: selectedDigest,
          platform: { os: "linux", architecture: "amd64" },
        },
      ],
    }),
  );
  const requested =
    "example.test/image@sha256:" +
    createHash("sha256").update(index).digest("hex");
  const inventory = clone(syft);
  inventory.source.metadata.userInput = requested;
  inventory.source.metadata.repoDigests = [requested];
  inventory.source.version = "sha256:" + requested.split("@sha256:")[1];
  const record = {
    image: requested,
    platform: "linux/amd64",
    indexBase64: index.toString("base64"),
    manifestBase64: manifest.toString("base64"),
  };
  assert.doesNotThrow(() =>
    validateImageIdentity(record, requested, inventory),
  );
  assert.throws(() =>
    validateImageIdentity({ ...record, image: keycloak }, requested, inventory),
  );
  assert.throws(() =>
    validateImageIdentity(
      { ...record, manifestBase64: Buffer.from("{}").toString("base64") },
      requested,
      inventory,
    ),
  );
  assert.throws(() =>
    validateImageIdentity(record, requested, {
      ...inventory,
      source: {
        ...inventory.source,
        metadata: {
          ...inventory.source.metadata,
          config: Buffer.from("{}").toString("base64"),
        },
      },
    }),
  );
});

test("R3 compares fixed version and status with original occurrence", () => {
  const original = trivy.Results.flatMap(
    (result) => result.Vulnerabilities ?? [],
  );
  const summary = original.map((v) => ({
    cve: v.VulnerabilityID,
    package: v.PkgName,
    installedVersion: v.InstalledVersion,
    packagePath: v.PkgPath ?? "/var/lib/rpm/rpmdb.sqlite",
    severity: v.Severity,
    fixedVersion: v.FixedVersion ?? null,
    fixedStatus: v.Status ?? "unknown",
  }));
  assert.equal(findingsMatchOriginal(summary, original, "redhat"), true);
  assert.equal(
    findingsMatchOriginal(
      summary.map((f, i) => (i ? f : { ...f, fixedVersion: "invented" })),
      original,
      "redhat",
    ),
    false,
  );
  assert.equal(
    findingsMatchOriginal(
      summary.map((f, i) => (i ? f : { ...f, fixedStatus: "fixed" })),
      original,
      "redhat",
    ),
    false,
  );
});

test("R3 rejects nested local deployment material and arbitrary metadata", () => {
  const artifact = {
    schemaVersion: 1,
    kind: "rendered-deployment",
    context: "saas-production",
    rendered: true,
    images: ["example.test/app@sha256:" + "b".repeat(64)],
    productionScan: { required: true },
  };
  for (const metadata of [
    { image: keycloak },
    { file: "infra/docker/./compose.yaml" },
    { file: "infra/docker/security/dispositions.json" },
    { localEligibility: false },
    { arbitrary: "reference" },
  ])
    assert.notDeepEqual(
      validatePromotion({
        context: artifact.context,
        images,
        artifact: { ...artifact, metadata },
      }),
      [],
    );
  assert.notDeepEqual(
    validatePromotion({
      context: artifact.context,
      images,
      artifact: {
        ...artifact,
        productionScan: { required: true, metadata: { image: keycloak } },
      },
    }),
    [],
  );
  assert.notDeepEqual(
    validatePromotion({
      context: artifact.context,
      images,
      artifact: { ...artifact, compose: "infra/kubernetes/production.yaml" },
    }),
    [],
  );
});

test("R3 rejects future configuration exposure evidence", () => {
  const item = {
    classification: "configuration-specific-nonexposure",
    status: "approved",
    classificationStatus: "reviewed",
    owner: "owner",
    approver: "reviewer",
    approval: {
      reviewId: "R3",
      reviewer: "reviewer",
      protectedReference: "fixture",
    },
    rationale: "fixture",
    compensatingControls: ["fixture"],
    remediationTicket: "F003-1",
    configurationHash: "a".repeat(64),
    approvedAt: "2026-10-05T00:00:00Z",
    reviewBy: "2026-10-07T00:00:00Z",
    expiresAt: "2026-10-08T00:00:00Z",
    exposureEvidence: {
      configurationHash: "a".repeat(64),
      condition: "fixture",
      verifiedAt: "2099-01-01T00:00:00Z",
    },
  };
  assert.equal(
    validDisposition(item, new Date("2026-10-06T07:00:00Z"), () => true),
    false,
  );
});

test("R3 retains completed denied evidence and preserves old evidence on incomplete collection", async () => {
  const cacheDir = resolve(import.meta.dirname, "../../.cache");
  await mkdir(cacheDir, { recursive: true });
  const directory = await mkdtemp(resolve(cacheDir, "r3-publication-"));
  try {
    const accepted = resolve(directory, "accepted");
    const stage = resolve(directory, "stage");
    await mkdir(accepted);
    await mkdir(stage);
    await writeFile(resolve(accepted, "scan.json"), "previous");
    await writeFile(resolve(stage, "scan.json"), "new-finding");
    await assert.rejects(publishCompletedCollection(stage, accepted, false));
    assert.equal(
      await readFile(resolve(accepted, "scan.json"), "utf8"),
      "previous",
    );
    await publishCompletedCollection(stage, accepted, true);
    await assert.rejects(async () => {
      throw new Error("eligibility denied");
    });
    assert.equal(
      await readFile(resolve(accepted, "scan.json"), "utf8"),
      "new-finding",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
