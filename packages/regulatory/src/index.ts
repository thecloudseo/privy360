export type Classification =
  "LEGAL_REQUIREMENT" | "IMPLEMENTATION_CONTROL" | "GOOD_PRACTICE";
export type VerificationState = "UNVERIFIED" | "VERIFIED" | "REJECTED";
export type ReviewState =
  "DRAFT" | "REVIEWED" | "PUBLISHED" | "SUPERSEDED" | "RETIRED";

export interface RegulatorySource {
  sourceId: string;
  issuer: string;
  canonicalUri: string;
  title?: string;
  language: string;
  publishedAt?: string;
  retrievedAt: string;
  checksum: { algorithm: "sha256"; value: string };
  objectRef?: string;
  verificationState: VerificationState;
  authoritative: boolean;
}
export interface SourceCitation {
  citationId: string;
  sourceId: string;
  sourceDigest: string;
  locator: string;
  page?: number;
  paragraph?: string;
}
export interface Requirement {
  requirementId: string;
  requirementCode: string;
  classification: Classification;
  family?: string;
}
export interface RequirementVersion {
  requirementVersionId: string;
  requirementId: string;
  revision: number;
  atomicWording: string;
  interpretationNote?: string;
  reviewState: ReviewState;
  effectiveFrom: string;
  effectiveTo?: string;
  citationIds: string[];
  reviewerRef?: string;
}
export interface Bundle {
  sources: RegulatorySource[];
  citations: SourceCitation[];
  requirements: Requirement[];
  requirementVersions: RequirementVersion[];
  manifest: {
    manifestId: string;
    digest: string;
    sourceIds: string[];
    versionIds: string[];
    reviewerRef?: string;
  };
}
export interface ValidationError {
  path: string;
  code: string;
  message: string;
}
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const id = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/;
const iso = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/;
const sha256 = /^[a-f0-9]{64}$/;
function err(
  errors: ValidationError[],
  path: string,
  code: string,
  message: string,
) {
  errors.push({ path, code, message });
}
function dateOk(value: string) {
  return iso.test(value) && !Number.isNaN(Date.parse(value));
}
function unique(values: string[]) {
  return new Set(values).size === values.length;
}

export function validateSource(source: RegulatorySource): ValidationResult {
  const errors: ValidationError[] = [];
  if (!id.test(source.sourceId))
    err(
      errors,
      "sourceId",
      "INVALID_ID",
      "Stable source identifier is malformed",
    );
  if (!source.issuer.trim())
    err(errors, "issuer", "REQUIRED", "Issuer is required");
  if (!/^https?:\/\//.test(source.canonicalUri))
    err(
      errors,
      "canonicalUri",
      "INVALID_URI",
      "Canonical URI must be https/http",
    );
  if (!source.language.trim())
    err(errors, "language", "REQUIRED", "Language is required");
  if (!dateOk(source.retrievedAt))
    err(
      errors,
      "retrievedAt",
      "INVALID_DATE",
      "Retrieved timestamp is invalid",
    );
  if (source.publishedAt && !dateOk(source.publishedAt))
    err(
      errors,
      "publishedAt",
      "INVALID_DATE",
      "Published timestamp is invalid",
    );
  if (
    source.checksum.algorithm !== "sha256" ||
    !sha256.test(source.checksum.value)
  )
    err(
      errors,
      "checksum",
      "INVALID_CHECKSUM",
      "A lowercase SHA-256 digest is required",
    );
  if (source.verificationState === "VERIFIED" && !source.authoritative)
    err(
      errors,
      "authoritative",
      "ILLUSTRATIVE_SOURCE",
      "Illustrative sources cannot be authoritative",
    );
  if (
    !["UNVERIFIED", "VERIFIED", "REJECTED"].includes(source.verificationState)
  )
    err(
      errors,
      "verificationState",
      "INVALID_STATE",
      "Unknown verification state",
    );
  return { valid: errors.length === 0, errors };
}

export function validateBundle(bundle: Bundle): ValidationResult {
  const errors: ValidationError[] = [];
  if (!bundle || !bundle.manifest)
    return {
      valid: false,
      errors: [
        { path: "manifest", code: "REQUIRED", message: "Manifest is required" },
      ],
    };
  const sources = new Map(bundle.sources.map((x) => [x.sourceId, x]));
  const requirements = new Map(
    bundle.requirements.map((x) => [x.requirementId, x]),
  );
  const citations = new Map(bundle.citations.map((x) => [x.citationId, x]));
  const versions = new Map(
    bundle.requirementVersions.map((x) => [x.requirementVersionId, x]),
  );
  if (!unique(bundle.sources.map((x) => x.sourceId)))
    err(errors, "sources", "DUPLICATE_ID", "Source IDs must be unique");
  if (!unique(bundle.requirementVersions.map((x) => x.requirementVersionId)))
    err(
      errors,
      "requirementVersions",
      "DUPLICATE_ID",
      "Version IDs must be unique",
    );
  bundle.sources.forEach((x, i) =>
    validateSource(x).errors.forEach((e) =>
      err(errors, `sources[${i}].${e.path}`, e.code, e.message),
    ),
  );
  bundle.requirements.forEach((x, i) => {
    if (!id.test(x.requirementId) || !x.requirementCode.trim())
      err(
        errors,
        `requirements[${i}]`,
        `INVALID_REQUIREMENT`,
        `Requirement identifier and code are required`,
      );
  });
  bundle.citations.forEach((x, i) => {
    if (
      !sources.has(x.sourceId) ||
      !sha256.test(x.sourceDigest) ||
      !x.locator.trim()
    )
      err(
        errors,
        `citations[${i}]`,
        `INVALID_CITATION`,
        `Citation must reference a source, digest, and locator`,
      );
  });
  bundle.requirementVersions.forEach((x, i) => {
    const r = requirements.get(x.requirementId);
    if (
      !r ||
      !Number.isInteger(x.revision) ||
      x.revision < 1 ||
      !x.atomicWording.trim() ||
      !dateOk(x.effectiveFrom) ||
      (x.effectiveTo && !dateOk(x.effectiveTo))
    )
      err(
        errors,
        `requirementVersions[${i}]`,
        `INVALID_VERSION`,
        `Version fields are incomplete or malformed`,
      );
    if (
      x.effectiveTo &&
      Date.parse(x.effectiveFrom) >= Date.parse(x.effectiveTo)
    )
      err(
        errors,
        `requirementVersions[${i}].effectiveTo`,
        `INVALID_INTERVAL`,
        `effectiveFrom must precede effectiveTo`,
      );
    if (
      r?.classification === "LEGAL_REQUIREMENT" &&
      (!(x.citationIds ?? []).length ||
        x.citationIds.some((c) => !citations.has(c)))
    )
      err(
        errors,
        `requirementVersions[${i}].citationIds`,
        `CITATION_REQUIRED`,
        `Legal requirements require existing source citations`,
      );
    if (
      ["REVIEWED", "PUBLISHED", "SUPERSEDED"].includes(x.reviewState) &&
      !x.reviewerRef?.trim()
    )
      err(
        errors,
        `requirementVersions[${i}].reviewerRef`,
        `REVIEWER_REQUIRED`,
        `Reviewed versions require a reviewer reference`,
      );
  });
  if (
    !id.test(bundle.manifest.manifestId) ||
    !sha256.test(bundle.manifest.digest) ||
    !unique(bundle.manifest.sourceIds) ||
    !unique(bundle.manifest.versionIds) ||
    bundle.manifest.sourceIds.some((x) => !sources.has(x)) ||
    bundle.manifest.versionIds.some((x) => !versions.has(x)) ||
    !bundle.manifest.reviewerRef?.trim()
  )
    err(
      errors,
      "manifest",
      "INCOMPLETE_MANIFEST",
      "Manifest must be complete and reviewed",
    );
  return { valid: errors.length === 0, errors };
}
