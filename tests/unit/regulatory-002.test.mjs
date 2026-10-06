import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";
import { InMemoryAtomicAuditUnitOfWork } from "../../packages/audit/src/index.ts";
import { importRegulatoryManifest } from "../../packages/regulatory/src/intake.ts";

const digest = "a".repeat(64);
const actor = "11111111-1111-4111-8111-111111111111";
const correlation = "22222222-2222-4222-8222-222222222222";
const policy = "33333333-3333-4333-8333-333333333333";
const intake = "44444444-4444-4444-8444-444444444444";
const source = {
  sourceId: "src.synthetic",
  issuer: "Synthetic Authority",
  canonicalUri: "https://example.invalid/source",
  language: "en",
  retrievedAt: "2026-01-01T00:00:00Z",
  checksum: { algorithm: "sha256", value: digest },
  verificationState: "UNVERIFIED",
  authoritative: false,
};
const bytes = new TextEncoder().encode("synthetic manifest");
const manifestDigest = createHash("sha256").update(bytes).digest("hex");
const bundle = {
  sources: [source],
  citations: [],
  requirements: [
    {
      requirementId: "req.control",
      requirementCode: "CTRL-1",
      classification: "IMPLEMENTATION_CONTROL",
    },
  ],
  requirementVersions: [
    {
      requirementVersionId: "ver.control",
      requirementId: "req.control",
      revision: 1,
      atomicWording: "Synthetic control wording",
      reviewState: "DRAFT",
      effectiveFrom: "2026-01-01",
      citationIds: [],
    },
  ],
  manifest: {
    manifestId: "manifest.synthetic",
    digest: manifestDigest,
    sourceIds: [source.sourceId],
    versionIds: ["ver.control"],
    reviewerRef: "source-editor-intake",
  },
};

function request(overrides = {}) {
  return {
    bundle,
    manifestBytes: bytes,
    intakeId: intake,
    authorization: { allowed: true, policyDecisionId: policy },
    auditContext: {
      scope: "GLOBAL_CORPUS",
      actor: { id: actor, kind: "USER" },
      correlationId: correlation,
      sourceChannel: "regulatory-intake",
    },
    uow: new InMemoryAtomicAuditUnitOfWork(),
    persist: async () => "CREATED",
    ...overrides,
  };
}

test("rejects a tampered manifest before persistence", async () => {
  await assert.rejects(
    () =>
      importRegulatoryManifest(
        request({ manifestBytes: new TextEncoder().encode("tampered") }),
      ),
    /checksum/i,
  );
});
test("rejects missing trusted source-editor authorization and attribution", async () => {
  await assert.rejects(
    () =>
      importRegulatoryManifest(
        request({
          authorization: { allowed: false, policyDecisionId: policy },
        }),
      ),
    /authorization/i,
  );
  await assert.rejects(
    () =>
      importRegulatoryManifest(
        request({
          auditContext: {
            scope: "GLOBAL_CORPUS",
            correlationId: correlation,
            sourceChannel: "regulatory-intake",
          },
        }),
      ),
    /actor/i,
  );
});
test("quarantines a valid draft and records the audited import", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  const result = await importRegulatoryManifest(
    request({ uow, manifestBytes: bytes }),
  );
  assert.equal(result.state, "QUARANTINED");
  assert.equal(uow.auditCount, 1);
  assert.equal(uow.outboxCount, 1);
});
test("same manifest digest is idempotent", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  const first = request({ uow, manifestBytes: bytes });
  await importRegulatoryManifest(first);
  await importRegulatoryManifest({
    ...first,
    intakeId: "55555555-5555-4555-8555-555555555555",
    persist: async () => "DUPLICATE",
  });
  assert.equal(uow.auditCount, 1);
  assert.equal(uow.outboxCount, 1);
});
test("failed persistence rolls back the audit unit of work", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  await assert.rejects(() =>
    importRegulatoryManifest(
      request({
        uow,
        manifestBytes: bytes,
        persist: async () => {
          throw new Error("db unavailable");
        },
      }),
      /db unavailable/,
    ),
  );
  assert.equal(uow.auditCount, 0);
  assert.equal(uow.outboxCount, 0);
});
