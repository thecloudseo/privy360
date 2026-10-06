import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAtomicAuditUnitOfWork } from "../../packages/audit/src/index.ts";
import { publishRegulatoryBundle } from "../../packages/regulatory/src/publication.ts";

const actor = "11111111-1111-4111-8111-111111111111";
const reviewer = "22222222-2222-4222-8222-222222222222";
const publisher = "33333333-3333-4333-8333-333333333333";
const policy = "44444444-4444-4444-8444-444444444444";
const correlation = "55555555-5555-4555-8555-555555555555";
const digest = "a".repeat(64);
const clone = (value) => JSON.parse(JSON.stringify(value));

const completeBundle = {
  sources: [
    {
      sourceId: "src.synthetic",
      issuer: "Synthetic Authority",
      canonicalUri: "https://example.invalid/source",
      language: "en",
      retrievedAt: "2026-01-01T00:00:00Z",
      checksum: { algorithm: "sha256", value: digest },
      verificationState: "UNVERIFIED",
      authoritative: false,
    },
  ],
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
    digest,
    sourceIds: ["src.synthetic"],
    versionIds: ["ver.control"],
    reviewerRef: "source-review",
  },
};

function request(overrides = {}) {
  return {
    bundle: clone(completeBundle),
    manifestState: "DRAFT",
    actorId: actor,
    reviewerId: reviewer,
    publisherId: publisher,
    publicationId: "66666666-6666-4666-8666-666666666666",
    policyDecisionId: policy,
    auditContext: {
      scope: "GLOBAL_CORPUS",
      actor: { id: actor, kind: "USER" },
      correlationId: correlation,
      sourceChannel: "regulatory-publication",
    },
    uow: new InMemoryAtomicAuditUnitOfWork(),
    persistReview: async () => {},
    persistPublication: async () => {},
    ...overrides,
  };
}

test("reviews a draft then publishes only with a distinct Legal publisher", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  const result = await publishRegulatoryBundle(request({ uow }));
  assert.equal(result.state, "PUBLISHED");
  assert.equal(uow.auditCount, 2);
  assert.equal(uow.outboxCount, 1);
});

test("rejects self-publication and leaves audit state untouched", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  await assert.rejects(
    () => publishRegulatoryBundle(request({ uow, publisherId: actor })),
    /distinct|self/i,
  );
  assert.equal(uow.auditCount, 0);
  assert.equal(uow.outboxCount, 0);
});

test("keeps authoritative legal publication blocked while OPEN-01 is unresolved", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  const legalBundle = clone(completeBundle);
  legalBundle.sources[0].verificationState = "VERIFIED";
  legalBundle.sources[0].authoritative = true;
  await assert.rejects(
    () => publishRegulatoryBundle(request({ uow, bundle: legalBundle })),
    /OPEN-01|authoritative/i,
  );
  assert.equal(uow.auditCount, 0);
  assert.equal(uow.outboxCount, 0);
});

test("rejects incomplete publication without changing state", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  await assert.rejects(
    () =>
      publishRegulatoryBundle(
        request({
          uow,
          bundle: {
            ...completeBundle,
            manifest: { ...completeBundle.manifest, versionIds: [] },
          },
        }),
      ),
    /complete|incomplete/i,
  );
  assert.equal(uow.auditCount, 0);
});

test("rolls back audit and persistence when publication persistence fails", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  await assert.rejects(
    () =>
      publishRegulatoryBundle(
        request({
          uow,
          persistPublication: async () => {
            throw new Error("db unavailable");
          },
        }),
      ),
    /db unavailable/,
  );
  assert.equal(uow.auditCount, 0);
  assert.equal(uow.outboxCount, 0);
});

test("preserves supersession and rejects republishing an already published manifest", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  const first = await publishRegulatoryBundle(request({ uow }));
  assert.equal(first.supersedesManifestId, undefined);
  await assert.rejects(
    () => publishRegulatoryBundle(request({ uow, manifestState: "PUBLISHED" })),
    /published|transition/i,
  );
});
