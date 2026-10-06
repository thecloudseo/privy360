import test from "node:test";
import assert from "node:assert/strict";
import {
  listPublishedRegulations,
  projectPublishedCorpus,
  selectPublishedRequirementVersions,
} from "../../packages/regulatory/src/library.ts";

const source = {
  sourceId: "src.synthetic",
  issuer: "Synthetic Authority",
  canonicalUri: "https://example.invalid/source",
  title: "Synthetic source fixture",
  language: "en",
  retrievedAt: "2026-01-01T00:00:00Z",
  checksum: { algorithm: "sha256", value: "a".repeat(64) },
  verificationState: "UNVERIFIED",
  authoritative: false,
};

const corpus = {
  sources: [source],
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
      regulationVersionId: "regver.draft",
      regulationId: "reg.synthetic",
      revision: 1,
      effectiveFrom: "2026-01-01",
      state: "DRAFT",
      sourceIds: [source.sourceId],
    },
    {
      regulationVersionId: "regver.published",
      regulationId: "reg.synthetic",
      revision: 2,
      effectiveFrom: "2026-02-01",
      state: "PUBLISHED",
      sourceIds: [source.sourceId],
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
      regulationVersionId: "regver.published",
      language: "en",
      textContent: "Synthetic provision text",
      locator: "p.1",
      effectiveFrom: "2026-02-01",
      citationId: "cit.synthetic",
    },
  ],
  citations: [
    {
      citationId: "cit.synthetic",
      sourceId: source.sourceId,
      sourceDigest: source.checksum.value,
      locator: "page-1",
    },
  ],
  requirements: [
    {
      requirementId: "req.synthetic",
      requirementCode: "SYN-REQ-1",
      classification: "IMPLEMENTATION_CONTROL",
      family: "SEC",
    },
  ],
  requirementVersions: [
    {
      requirementVersionId: "reqver.draft",
      requirementId: "req.synthetic",
      revision: 1,
      atomicWording: "Draft wording",
      reviewState: "DRAFT",
      effectiveFrom: "2026-01-01",
      citationIds: [],
    },
    {
      requirementVersionId: "reqver.published",
      requirementId: "req.synthetic",
      revision: 2,
      atomicWording: "Synthetic control wording",
      reviewState: "PUBLISHED",
      effectiveFrom: "2026-02-01",
      citationIds: ["cit.synthetic"],
      reviewerRef: "synthetic-review",
    },
  ],
};

test("projects only published versions and preserves synthetic provenance", () => {
  const result = projectPublishedCorpus(corpus);
  assert.equal(result.regulationVersions.length, 1);
  assert.equal(
    result.regulationVersions[0].regulationVersionId,
    "regver.published",
  );
  assert.equal(result.requirements[0].classification, "IMPLEMENTATION_CONTROL");
  assert.equal(result.sources[0].authoritative, false);
  assert.equal(result.provisionVersions[0].citationId, "cit.synthetic");
});

test("list pagination and query never expose draft records", () => {
  const page = listPublishedRegulations(projectPublishedCorpus(corpus), {
    limit: 1,
    query: "synthetic",
  });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].versions[0].state, "PUBLISHED");
  assert.equal(
    page.items[0].versions.some((version) => version.state === "DRAFT"),
    false,
  );
});

test("invalid identifiers and unpublished requirement versions fail closed", () => {
  assert.throws(
    () =>
      selectPublishedRequirementVersions(
        projectPublishedCorpus(corpus),
        "missing",
      ),
    /not found/i,
  );
  assert.deepEqual(
    selectPublishedRequirementVersions(
      projectPublishedCorpus(corpus),
      "req.synthetic",
    ).map((version) => version.requirementVersionId),
    ["reqver.published"],
  );
});
