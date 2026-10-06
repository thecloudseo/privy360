import test from "node:test";
import assert from "node:assert/strict";
import {
  getProvision,
  getRegulations,
  getRequirementVersions,
} from "../../apps/api/src/regulatory.ts";

const corpus = {
  sources: [
    {
      sourceId: "src.synthetic",
      issuer: "Synthetic Authority",
      canonicalUri: "https://example.invalid/source",
      language: "en",
      retrievedAt: "2026-01-01T00:00:00Z",
      checksum: { algorithm: "sha256", value: "a".repeat(64) },
      verificationState: "UNVERIFIED",
      authoritative: false,
    },
  ],
  citations: [
    {
      citationId: "cit.synthetic",
      sourceId: "src.synthetic",
      sourceDigest: "a".repeat(64),
      locator: "page-1",
    },
  ],
  regulations: [
    {
      regulationId: "reg.synthetic",
      jurisdiction: "IN",
      authority: "Synthetic Authority",
      code: "SYN-REG",
      title: "Synthetic privacy regulation",
    },
  ],
  regulationVersions: [
    {
      regulationVersionId: "regver.synthetic",
      regulationId: "reg.synthetic",
      revision: 1,
      effectiveFrom: "2026-01-01",
      state: "PUBLISHED",
      sourceIds: ["src.synthetic"],
    },
  ],
  provisions: [
    {
      provisionId: "prov.synthetic",
      regulationId: "reg.synthetic",
      code: "P1",
    },
  ],
  provisionVersions: [
    {
      provisionVersionId: "provver.synthetic",
      provisionId: "prov.synthetic",
      regulationVersionId: "regver.synthetic",
      language: "en",
      textContent: "Synthetic provision text",
      locator: "page-1",
      effectiveFrom: "2026-01-01",
      citationId: "cit.synthetic",
    },
  ],
  requirements: [
    {
      requirementId: "req.synthetic",
      requirementCode: "SYN-REQ-1",
      classification: "IMPLEMENTATION_CONTROL",
    },
  ],
  requirementVersions: [
    {
      requirementVersionId: "reqver.synthetic",
      requirementId: "req.synthetic",
      revision: 1,
      atomicWording: "Synthetic control wording",
      reviewState: "PUBLISHED",
      effectiveFrom: "2026-01-01",
      citationIds: [],
      reviewerRef: "fixture-review",
    },
  ],
};

const context = {
  authorized: true,
  correlationId: "11111111-1111-4111-8111-111111111111",
  source: "regulatory-library",
};

test("GET regulations returns bounded published DTOs and audits the read", async () => {
  const reads = [];
  const response = await getRegulations({
    corpus,
    context,
    query: { limit: 10 },
    audit: (event) => reads.push(event),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.items[0].versions[0].state, "PUBLISHED");
  assert.equal(
    response.body.items[0].versions[0].sources[0].authoritative,
    false,
  );
  assert.equal(reads[0].action, "REGULATORY_LIBRARY_VIEWED");
});

test("read API denies by default and does not leak internal details", async () => {
  const response = await getRegulations({
    corpus,
    context: { ...context, authorized: false },
    query: {},
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "FORBIDDEN");
  assert.equal("items" in response.body, false);
});

test("invalid pagination and IDs return correlated safe errors", async () => {
  const invalidPage = await getRegulations({
    corpus,
    context,
    query: { limit: 101 },
  });
  assert.equal(invalidPage.status, 400);
  assert.equal(invalidPage.body.correlationId, context.correlationId);
  const invalidId = await getRequirementVersions({
    corpus,
    context,
    requirementId: "missing",
  });
  assert.equal(invalidId.status, 404);
  assert.equal(invalidId.body.code, "NOT_FOUND");
});

test("GET provisions returns published text with citation references", async () => {
  const response = await getProvision({
    corpus,
    context,
    provisionId: "prov.synthetic",
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.versions[0].citationId, "cit.synthetic");
  assert.equal(response.body.citations[0].locator, "page-1");
});
