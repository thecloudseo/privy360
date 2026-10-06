import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import {
  configurationHash,
  EVIDENCE_SCHEMA,
  evaluateLocalEligibility,
  validateLocalCompose,
  validatePromotion,
} from "../../scripts/local-security-policy.mjs";
import { deploymentBoundaryErrors } from "../../scripts/check-production-boundary.mjs";

const manifest = JSON.parse(
  await readFile(
    new URL("../../infra/docker/security/images.json", import.meta.url),
  ),
).images;
const config = {
  name: "privy360-local",
  networks: { "app-net": { internal: true } },
  services: Object.fromEntries(
    Object.entries(manifest).map(([name, image]) => [
      name,
      {
        image: image.image,
        platform: image.platform,
        networks: { "app-net": null },
        mem_limit: 100000000,
        cpus: 1,
        pids_limit: 128,
        security_opt: ["no-new-privileges:true"],
      },
    ]),
  ),
};
const hash = configurationHash(config);
const finding = {
  cve: "CVE-2026-75595",
  package: "io.netty:netty-handler",
  packagePath:
    "opt/keycloak/lib/lib/main/io.netty.netty-handler-4.1.136.Final.jar",
  installedVersion: "4.1.136.Final",
  fixedVersion: "4.1.137.Final",
  severity: "CRITICAL",
};
const evidence = Object.entries(manifest).map(([service, image]) => ({
  schemaVersion: EVIDENCE_SCHEMA,
  service,
  image: image.image,
  digest: image.image.split("@sha256:")[1],
  platform: image.platform,
  configurationHash: hash,
  scanner: "Trivy",
  scannerVersion: "0.74.0",
  scannerBinarySha256: "d".repeat(64),
  syftVersion: "1.52.0",
  syftBinarySha256: "e".repeat(64),
  scannerIsolation: {
    config: "infra/docker/security/trivy-image.yaml",
    ignorefile: "/dev/null",
    inheritedOverridesRemoved: true,
    anonymousRegistryConfig: true,
  },
  databaseUpdatedAt: "2026-09-30T00:00:00Z",
  databaseVersion: 2,
  scannedAt: "2026-09-30T00:00:00Z",
  scanCommand: `trivy image --scanners vuln --severity HIGH,CRITICAL ${image.image}`,
  sbomSha256: "a".repeat(64),
  rawTrivySha256: "b".repeat(64),
  rawSyftSha256: "c".repeat(64),
  identitySha256: "0".repeat(64),
  coverage: { trivyResults: true, syftArtifacts: true },
  collectionStatus: "complete",
  scanOptions: ["vuln", "HIGH,CRITICAL", "list-all-pkgs"],
  findings: service === "keycloak" ? [finding] : [],
}));
const approved = {
  ...finding,
  image: manifest.keycloak.image,
  platform: manifest.keycloak.platform,
  configurationHash: hash,
  scope: "local-development",
  status: "approved",
  classification: "residual-risk-acceptance",
  classificationStatus: "reviewed",
  riskAssessment: {
    likelihood: "fixture",
    impact: "fixture",
    riskOwner: "security-owner",
  },
  owner: "security-owner",
  approver: "chief-architect",
  approval: {
    reviewId: "review-123",
    reviewer: "chief-architect",
    protectedReference: "refs/reviews/123",
  },
  approvedAt: "2026-09-29T00:00:00Z",
  reviewBy: "2026-10-07T00:00:00Z",
  rationale: "fixture only",
  compensatingControls: ["fixture control"],
  remediationTicket: "F003-123",
  expiresAt: "2026-10-15T00:00:00Z",
};
const input = (overrides = {}) => ({
  context: "local-development",
  config,
  images: manifest,
  evidence,
  dispositions: [approved],
  scanSucceeded: true,
  approvalVerifier: (item) => item.approval?.reviewId === "review-123",
  now: new Date("2026-09-30T00:00:00Z"),
  ...overrides,
});

test("local eligibility is bound to exact digest, CVE, path, configuration and approval", () => {
  assert.equal(evaluateLocalEligibility(input()).eligible, true);
  assert.equal(
    evaluateLocalEligibility(input({ dispositions: [] })).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({ dispositions: [{ ...approved, status: "proposed" }] }),
    ).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({
        dispositions: [{ ...approved, expiresAt: "2026-09-29T00:00:00Z" }],
      }),
    ).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({ dispositions: [{ ...approved, packagePath: "other.jar" }] }),
    ).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({
        dispositions: [
          { ...approved, image: "keycloak@sha256:" + "b".repeat(64) },
        ],
      }),
    ).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({
        evidence: evidence.map((item) =>
          item.service === "keycloak"
            ? {
                ...item,
                findings: [
                  ...item.findings,
                  { ...finding, cve: "CVE-UNKNOWN" },
                ],
              }
            : item,
        ),
      }),
    ).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({
        evidence: evidence.filter((item) => item.service !== "keycloak"),
      }),
    ).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(input({ scanSucceeded: false })).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({ dispositions: [{ ...approved, approval: null }] }),
    ).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({
        evidence: evidence.map((item) =>
          item.service === "keycloak" ? { ...item, sbomSha256: null } : item,
        ),
      }),
    ).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({
        config: {
          ...config,
          services: {
            ...config.services,
            keycloak: { ...config.services.keycloak, command: ["changed"] },
          },
        },
      }),
    ).eligible,
    false,
  );
  assert.equal(
    evaluateLocalEligibility(
      input({
        config: {
          ...config,
          services: {
            ...config.services,
            keycloak: {
              ...config.services.keycloak,
              environment: { KC_HTTP_ENABLED: "false" },
            },
          },
        },
      }),
    ).eligible,
    false,
  );
});

test("local containment and production promotion fail closed", () => {
  assert.deepEqual(validateLocalCompose(config, manifest), []);
  assert.ok(
    validateLocalCompose(
      {
        ...config,
        services: {
          ...config.services,
          keycloak: {
            ...config.services.keycloak,
            ports: [{ published: "8080" }],
          },
        },
      },
      manifest,
    ).length,
  );
  assert.ok(
    validateLocalCompose(
      { ...config, networks: { "app-net": { internal: false } } },
      manifest,
    ).length,
  );
  assert.ok(
    validateLocalCompose(
      {
        ...config,
        services: {
          ...config.services,
          keycloak: {
            ...config.services.keycloak,
            image: "quay.io/keycloak/keycloak:latest",
          },
        },
      },
      manifest,
    ).length,
  );
  for (const context of [
    "staging",
    "saas-production",
    "customer-vpc",
    "government-on-premise",
    "offline-release",
  ]) {
    assert.equal(evaluateLocalEligibility(input({ context })).eligible, false);
    assert.ok(
      validatePromotion({
        context,
        images: manifest,
        artifact: {
          compose: "infra/docker/compose.yaml",
          localEligibility: true,
          images: [manifest.keycloak.image],
        },
      }).length,
    );
    assert.ok(
      validatePromotion({
        context,
        images: manifest,
        artifact: {
          images: [
            `mirror.example/idp@sha256:${manifest.keycloak.image.split("@sha256:")[1]}`,
          ],
        },
      }).length,
    );
  }
  assert.ok(
    deploymentBoundaryErrors(
      `image: ${manifest.keycloak.image}`,
      "release.yaml",
    ).length,
  );
  assert.ok(
    deploymentBoundaryErrors(
      "compose: infra/docker/compose.yaml",
      "release.yaml",
    ).length,
  );
});
