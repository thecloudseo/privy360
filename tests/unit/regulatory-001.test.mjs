import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSource,
  validateBundle,
} from "../../packages/regulatory/src/index.ts";
const digest = "a".repeat(64);
const source = {
  sourceId: "src.dpdp.synthetic",
  issuer: "Synthetic Authority",
  canonicalUri: "https://example.invalid/source",
  language: "en",
  retrievedAt: "2026-01-01T00:00:00Z",
  checksum: { algorithm: "sha256", value: digest },
  verificationState: "VERIFIED",
  authoritative: true,
};
test("rejects malformed and illustrative authoritative sources", () => {
  assert.equal(
    validateSource({
      ...source,
      checksum: { algorithm: "sha256", value: "bad" },
    }).valid,
    false,
  );
  assert.equal(
    validateSource({ ...source, authoritative: false }).valid,
    false,
  );
});
test("requires citations, reviewer and complete manifest for legal version", () => {
  const b = {
    sources: [source],
    citations: [],
    requirements: [
      {
        requirementId: "req.one",
        requirementCode: "REQ-ONE",
        classification: "LEGAL_REQUIREMENT",
      },
    ],
    requirementVersions: [
      {
        requirementVersionId: "ver.one",
        requirementId: "req.one",
        revision: 1,
        atomicWording: "Synthetic wording",
        reviewState: "PUBLISHED",
        effectiveFrom: "2026-01-01",
        reviewerRef: "reviewer",
      },
    ],
    manifest: {
      manifestId: "man.one",
      digest,
      sourceIds: [source.sourceId],
      versionIds: ["ver.one"],
      reviewerRef: "reviewer",
    },
  };
  assert.equal(validateBundle(b).valid, false);
});
test("accepts structurally complete synthetic bundle", () => {
  const b = {
    sources: [source],
    citations: [
      {
        citationId: "cit.one",
        sourceId: source.sourceId,
        sourceDigest: digest,
        locator: "synthetic-locator",
      },
    ],
    requirements: [
      {
        requirementId: "req.one",
        requirementCode: "REQ-ONE",
        classification: "LEGAL_REQUIREMENT",
      },
    ],
    requirementVersions: [
      {
        requirementVersionId: "ver.one",
        requirementId: "req.one",
        revision: 1,
        atomicWording: "Synthetic wording",
        reviewState: "PUBLISHED",
        effectiveFrom: "2026-01-01",
        citationIds: ["cit.one"],
        reviewerRef: "reviewer",
      },
    ],
    manifest: {
      manifestId: "man.one",
      digest,
      sourceIds: [source.sourceId],
      versionIds: ["ver.one"],
      reviewerRef: "reviewer",
    },
  };
  assert.equal(validateBundle(b).valid, true);
});
