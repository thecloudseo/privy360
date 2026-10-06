import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import process from "node:process";
import {
  configurationHash,
  EVIDENCE_SCHEMA,
  evaluateLocalEligibility,
  productionScanPasses,
  validDisposition,
  validateLocalCompose,
  validatePromotion,
} from "../../scripts/local-security-policy.mjs";
import { deploymentBoundaryErrors } from "../../scripts/check-production-boundary.mjs";
import { mountedMaterial } from "../../scripts/local-material.mjs";
import {
  validateTrivyOutput,
  validateSyftOutput,
  scannerEnvironment,
  findingsMatchOriginal,
} from "../../scripts/scanner-evidence.mjs";
import {
  BASELINE_COMMIT,
  REQUIRED_ARCHITECTURE_DOCUMENTS,
  baselineErrors,
} from "../../scripts/baseline-policy.mjs";

const image = "registry.example/keycloak@sha256:" + "a".repeat(64);

test("cached assessment cannot claim a successful current scan", () => {
  const repo = resolve(import.meta.dirname, "../..");
  const result = spawnSync(
    process.execPath,
    ["scripts/local-image-evidence.mjs", "evaluate"],
    {
      cwd: repo,
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Cached assessment is not proof|current collection required/,
  );
});
const images = { keycloak: { image, platform: "linux/amd64" } };
const service = {
  image,
  platform: "linux/amd64",
  networks: { private: null },
  mem_limit: 100,
  cpus: 1,
  pids_limit: 20,
  security_opt: ["no-new-privileges:true"],
};
const base = {
  name: "privy360-local",
  services: { keycloak: service },
  networks: { private: { internal: true } },
  volumes: { data: { name: "privy360-local_data" } },
};
const now = new Date("2026-10-06T00:00:00Z");
const finding = {
  cve: "CVE-2026-75595",
  package: "netty",
  packagePath: "/opt/keycloak/netty.jar",
  installedVersion: "1",
  severity: "CRITICAL",
};
const scan = {
  service: "keycloak",
  schemaVersion: EVIDENCE_SCHEMA,
  image,
  digest: "a".repeat(64),
  platform: "linux/amd64",
  configurationHash: configurationHash(base),
  mountHashes: {},
  scanner: "Trivy",
  scannerVersion: "0.74.0",
  scannerBinarySha256: "e".repeat(64),
  syftVersion: "1.52.0",
  syftBinarySha256: "f".repeat(64),
  scannerIsolation: {
    config: "infra/docker/security/trivy-image.yaml",
    ignorefile: "/dev/null",
    inheritedOverridesRemoved: true,
    anonymousRegistryConfig: true,
  },
  databaseUpdatedAt: "2026-10-05T00:00:00Z",
  databaseVersion: 2,
  scannedAt: "2026-10-05T12:00:00Z",
  scanOptions: ["vuln", "HIGH,CRITICAL", "list-all-pkgs"],
  coverage: { trivyResults: true, syftArtifacts: true },
  collectionStatus: "complete",
  findings: [finding],
  sbomSha256: "b".repeat(64),
  rawTrivySha256: "c".repeat(64),
  rawSyftSha256: "d".repeat(64),
  identitySha256: "0".repeat(64),
};
const disposition = {
  ...finding,
  image,
  platform: "linux/amd64",
  configurationHash: configurationHash(base),
  scope: "local-development",
  status: "approved",
  classification: "residual-risk-acceptance",
  classificationStatus: "reviewed",
  riskAssessment: {
    likelihood: "fixture",
    impact: "fixture",
    riskOwner: "owner",
  },
  owner: "owner",
  approver: "reviewer",
  approval: {
    reviewId: "R3-1",
    reviewer: "reviewer",
    protectedReference: "reviewed-commit",
  },
  approvedAt: "2026-10-05T00:00:00Z",
  reviewBy: "2026-10-07T00:00:00Z",
  expiresAt: "2026-10-20T00:00:00Z",
  rationale: "fixture",
  compensatingControls: ["fixture"],
  remediationTicket: "F003-1",
};
const input = (change = {}) => ({
  context: "local-development",
  config: base,
  images,
  evidence: [scan],
  dispositions: [disposition],
  scanSucceeded: true,
  approvalVerifier: (d) => d.approval?.reviewId === "R3-1",
  now,
  ...change,
});

test("B1 hashes top-level volumes and every material Compose field", () => {
  assert.equal(evaluateLocalEligibility(input()).eligible, true);
  const mutations = [
    {
      volumes: {
        data: {
          name: "privy360-local_data",
          driver_opts: { type: "none", device: "/tmp", o: "bind" },
        },
      },
    },
    { networks: { private: { internal: true, driver: "bridge" } } },
    {
      services: {
        keycloak: {
          ...service,
          security_opt: ["no-new-privileges:true", "seccomp:unconfined"],
        },
      },
    },
    { services: { keycloak: { ...service, cap_add: ["NET_ADMIN"] } } },
    { services: { keycloak: { ...service, pids_limit: 21 } } },
    {
      services: {
        keycloak: {
          ...service,
          image: "registry.example/keycloak@sha256:" + "e".repeat(64),
        },
      },
    },
    {
      services: {
        keycloak: {
          ...service,
          volumes: [
            {
              type: "bind",
              source: "/x/infra/docker/setup-temporal.sh",
              target: "/run.sh",
              read_only: true,
            },
          ],
        },
      },
    },
  ];
  for (const mutation of mutations) {
    const changed = { ...base, ...mutation };
    assert.notEqual(configurationHash(changed), scan.configurationHash);
    assert.equal(
      evaluateLocalEligibility(input({ config: changed })).eligible,
      false,
    );
  }
  assert.ok(
    validateLocalCompose(
      { ...base, volumes: { data: { external: true } } },
      images,
    ).length,
  );
  assert.ok(
    validateLocalCompose(
      { ...base, volumes: { data: { driver_opts: { device: "/host" } } } },
      images,
    ).length,
  );
  assert.ok(
    validateLocalCompose(
      {
        ...base,
        services: { keycloak: { ...service, cap_add: ["NET_ADMIN"] } },
      },
      images,
    ).length,
  );
  assert.ok(
    validateLocalCompose(
      {
        ...base,
        services: {
          keycloak: {
            ...service,
            security_opt: ["no-new-privileges:true", "seccomp:unconfined"],
          },
        },
      },
      images,
    ).length,
  );
});

test("B1 binds mounted script and directory contents", async () => {
  const config = {
    ...base,
    services: {
      keycloak: {
        ...service,
        volumes: [
          {
            type: "bind",
            source: resolve("infra/docker/setup-temporal.sh"),
            read_only: true,
          },
          {
            type: "bind",
            source: resolve("infra/docker/dynamicconfig"),
            read_only: true,
          },
        ],
      },
    },
  };
  const material = await mountedMaterial(config, "infra/docker");
  assert.deepEqual(Object.keys(material).sort(), [
    "dynamicconfig",
    "setup-temporal.sh",
  ]);
  assert.notEqual(
    configurationHash(config, material),
    configurationHash(config, {
      ...material,
      "setup-temporal.sh": { type: "file", sha256: "f".repeat(64) },
    }),
  );
  assert.notEqual(
    configurationHash(config, material),
    configurationHash(config, {
      ...material,
      dynamicconfig: { type: "directory", entries: {} },
    }),
  );
  assert.notEqual(
    configurationHash(config, material),
    configurationHash(config, {
      ...material,
      "setup-temporal.sh": { ...material["setup-temporal.sh"], mode: 0o777 },
    }),
  );
});

test("B2 rejects malformed, stale, mismatched and partial evidence", () => {
  const mutations = [
    { scannedAt: "not-a-date" },
    { scannedAt: "2026-02-30T00:00:00Z" },
    { databaseUpdatedAt: "not-a-date" },
    { databaseUpdatedAt: "2026-02-30T00:00:00Z" },
    { scannedAt: "2026-10-07T00:00:00Z" },
    { databaseUpdatedAt: "2026-09-01T00:00:00Z" },
    { databaseUpdatedAt: "2026-10-06T00:00:00Z" },
    { image: "registry.example/other@sha256:" + "a".repeat(64) },
    { platform: "linux/arm64" },
    { findings: null },
    { coverage: { trivyResults: false, syftArtifacts: true } },
    { coverage: { trivyResults: true, syftArtifacts: false } },
    { rawTrivySha256: null },
    { rawSyftSha256: null },
    { collectionStatus: "partial" },
    { schemaVersion: 1 },
    { scanOptions: ["vuln"] },
    {
      scannerIsolation: {
        ...scan.scannerIsolation,
        ignorefile: ".trivyignore",
      },
    },
  ];
  for (const mutation of mutations)
    assert.equal(
      evaluateLocalEligibility(input({ evidence: [{ ...scan, ...mutation }] }))
        .eligible,
      false,
      JSON.stringify(mutation),
    );
  assert.equal(
    evaluateLocalEligibility(input({ scanSucceeded: false })).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(input({ evidence: [] })).eligible,
    false,
  );
});

test("B2 rejects missing, partial and mismatched original scanner outputs", () => {
  const rawOccurrence = {
    VulnerabilityID: finding.cve,
    PkgName: finding.package,
    InstalledVersion: finding.installedVersion,
    PkgPath: finding.packagePath,
    Severity: finding.severity,
  };
  assert.equal(findingsMatchOriginal([finding], [rawOccurrence]), true);
  assert.equal(
    findingsMatchOriginal([{ ...finding, severity: "HIGH" }], [rawOccurrence]),
    false,
  );
  assert.deepEqual(
    scannerEnvironment({
      PATH: "/bin",
      TRIVY_IGNORE_UNFIXED: "true",
      TRIVY_SEVERITY: "LOW",
      SYFT_EXCLUDE: "**",
      GRYPE_CHECK_FOR_APP_UPDATE: "false",
    }),
    { PATH: "/bin", SYFT_CHECK_FOR_APP_UPDATE: "false" },
  );
  const trivy = {
    SchemaVersion: 2,
    ArtifactType: "container_image",
    Trivy: { Version: "0.74.0" },
    Metadata: {
      RepoDigests: [image],
      ImageConfig: { os: "linux", architecture: "amd64" },
    },
    Results: [
      {
        Target: "Java",
        Class: "lang-pkgs",
        Type: "jar",
        Packages: [{ Name: "fixture" }],
        Vulnerabilities: [],
      },
    ],
  };
  assert.deepEqual(validateTrivyOutput(trivy, image), []);
  for (const raw of [
    null,
    {},
    { ...trivy, Results: undefined },
    { ...trivy, Results: [] },
    { ...trivy, Results: [{}] },
    { ...trivy, Metadata: { ...trivy.Metadata, RepoDigests: ["other"] } },
    {
      ...trivy,
      Metadata: {
        ...trivy.Metadata,
        ImageConfig: { os: "linux", architecture: "arm64" },
      },
    },
  ])
    assert.throws(() => validateTrivyOutput(raw, image));
  const sha = (bytes) =>
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const configBytes = Buffer.from(
    JSON.stringify({ os: "linux", architecture: "amd64" }),
  );
  const manifestBytes = Buffer.from(
    JSON.stringify({ config: { digest: sha(configBytes) } }),
  );
  const syft = {
    schema: { version: "16.1.10" },
    source: {
      type: "image",
      id: sha(manifestBytes).slice(7),
      version: `sha256:${"a".repeat(64)}`,
      metadata: {
        userInput: image,
        repoDigests: [image],
        manifestDigest: sha(manifestBytes),
        imageID: sha(configBytes),
        manifest: manifestBytes.toString("base64"),
        config: configBytes.toString("base64"),
      },
    },
    artifacts: [
      { name: "pkg", version: "1", locations: [] },
      { name: "pkg2", version: "1", locations: [] },
    ],
  };
  assert.equal(validateSyftOutput(syft, image).length, 2);
  for (const raw of [
    null,
    {},
    { ...syft, artifacts: [] },
    { ...syft, artifacts: [{}] },
    {
      ...syft,
      source: {
        ...syft.source,
        metadata: { ...syft.source.metadata, userInput: "other" },
      },
    },
    {
      ...syft,
      source: {
        ...syft.source,
        metadata: {
          ...syft.source.metadata,
          manifestDigest: `sha256:${"b".repeat(64)}`,
        },
      },
    },
  ])
    assert.throws(() => validateSyftOutput(raw, image));
});

test("B3 structurally rejects local state, path aliases, missing fields and tag images", async () => {
  const realImages = JSON.parse(
    await readFile("infra/docker/security/images.json", "utf8"),
  ).images;
  const valid = {
    schemaVersion: 1,
    kind: "rendered-deployment",
    context: "staging",
    rendered: true,
    productionScan: { required: true },
    images: ["registry.example/app@sha256:" + "f".repeat(64)],
  };
  assert.deepEqual(
    validatePromotion({
      context: "staging",
      images: realImages,
      artifact: valid,
    }),
    [],
  );
  const bad = [
    { ...valid, localEligibility: true },
    { ...valid, scope: "local-development" },
    { ...valid, compose: "infra/docker/./compose.yaml" },
    { ...valid, images: ["quay.io/keycloak/keycloak:26.7.4"] },
    { ...valid, rendered: undefined },
    { ...valid, productionScan: undefined },
    { ...valid, images: [realImages.keycloak.image] },
    { ...valid, images: ["registry.example/app@sha256:${DIGEST}"] },
  ];
  for (const artifact of bad) {
    assert.ok(
      validatePromotion({ context: "staging", images: realImages, artifact })
        .length,
    );
    assert.ok(
      deploymentBoundaryErrors(
        JSON.stringify(artifact, null, 2),
        "release.json",
      ).length,
    );
  }
  assert.ok(
    deploymentBoundaryErrors("scope: local-development", "release.yaml").length,
  );
});

test("B4 requires lifecycle and independently verified approval", () => {
  assert.equal(validDisposition(disposition, now), false);
  const verify = () => true;
  assert.equal(validDisposition(disposition, now, verify), true);
  assert.equal(
    validDisposition(
      { ...disposition, classification: "scanner-correction" },
      now,
      verify,
    ),
    false,
  );
  assert.equal(
    validDisposition(
      {
        ...disposition,
        classification: "scanner-correction",
        correctionEvidence: {
          assertion: "version-normalization",
          sourceSha256: "a".repeat(64),
          vendorReference: "fixture-advisory",
        },
      },
      now,
      verify,
    ),
    true,
  );
  assert.equal(
    validDisposition(
      { ...disposition, classification: "configuration-specific-nonexposure" },
      now,
      verify,
    ),
    false,
  );
  assert.equal(
    validDisposition(
      {
        ...disposition,
        classification: "configuration-specific-nonexposure",
        exposureEvidence: {
          configurationHash: disposition.configurationHash,
          condition: "fixture",
          collectedAt: "2026-10-05T00:00:00Z",
          verifiedAt: "2026-10-05T00:00:00Z",
        },
      },
      now,
      verify,
    ),
    true,
  );
  const bad = [
    { reviewBy: "2026-10-05T00:00:00Z" },
    { expiresAt: "2026-11-20T00:00:00Z" },
    { approvedAt: "not-a-date" },
    { approvedAt: "2026-02-30T00:00:00Z" },
    { reviewBy: "2026-10-04T00:00:00Z" },
    { owner: "" },
    { remediationTicket: "https://advisory.example" },
    { approval: null },
    { revokedAt: "2026-10-06T00:00:00Z" },
    { classification: "generic-exception" },
    { classificationStatus: "proposed-unverified" },
    { renewedFrom: "old-disposition" },
    { approver: "owner" },
  ];
  for (const mutation of bad)
    assert.equal(
      validDisposition({ ...disposition, ...mutation }, now, verify),
      false,
      JSON.stringify(mutation),
    );
});

test("B5 local approval never changes production High/Critical decision", () => {
  const raw = {
    Results: [
      {
        Vulnerabilities: [
          { Severity: "CRITICAL", VulnerabilityID: finding.cve },
        ],
      },
    ],
  };
  assert.equal(evaluateLocalEligibility(input()).eligible, true);
  assert.equal(productionScanPasses(raw, true), false);
  assert.equal(productionScanPasses({ Results: [] }, true), false);
  assert.equal(
    productionScanPasses({ Results: [{ Vulnerabilities: [] }] }, false),
    false,
  );
  assert.equal(
    evaluateLocalEligibility(input({ context: "staging" })).eligible,
    false,
  );
});

test("finding severity or fix-status changes invalidate an exact local disposition", () => {
  assert.equal(
    evaluateLocalEligibility(
      input({
        evidence: [{ ...scan, findings: [{ ...finding, severity: "HIGH" }] }],
      }),
    ).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({
        evidence: [
          { ...scan, findings: [{ ...finding, fixedStatus: "fixed" }] },
        ],
      }),
    ).eligible,
    false,
  );
});

test("architecture baseline tag is immutable while reviewed documents may evolve", () => {
  const present = new Set(REQUIRED_ARCHITECTURE_DOCUMENTS);
  assert.deepEqual(baselineErrors(BASELINE_COMMIT, present), []);
  assert.ok(
    baselineErrors(null, present).some((x) => x.includes("tag missing")),
  );
  assert.ok(
    baselineErrors("f".repeat(40), present).some((x) =>
      x.includes("tag changed"),
    ),
  );
  const missing = new Set(present);
  missing.delete("SECURITY_ARCHITECTURE.md");
  assert.ok(
    baselineErrors(BASELINE_COMMIT, missing).some((x) =>
      x.includes("SECURITY_ARCHITECTURE.md"),
    ),
  );
  // Current document contents are intentionally not compared to the historical baseline.
  assert.deepEqual(baselineErrors(BASELINE_COMMIT, present), []);
});
