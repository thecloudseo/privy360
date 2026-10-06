import {
  type AtomicAuditUnitOfWork,
  type AuditContext,
  type AuditTransaction,
} from "@privy360/audit";
import { validateBundle, type Bundle } from "./index.ts";

export type PublicationState =
  "DRAFT" | "REVIEWED" | "PUBLISHED" | "SUPERSEDED";
export type LegalPublicationGate = "OPEN-01-UNRESOLVED" | "APPROVED";

export type PublicationResult = Readonly<{
  manifestId: string;
  state: "PUBLISHED";
  supersedesManifestId?: string;
}>;

export type RegulatoryPublicationRequest = Readonly<{
  bundle: Bundle;
  manifestState: PublicationState;
  publicationId: string;
  actorId: string;
  reviewerId: string;
  publisherId: string;
  policyDecisionId: string;
  legalPublicationGate?: LegalPublicationGate;
  auditContext: AuditContext;
  uow: AtomicAuditUnitOfWork;
  supersedesManifestId?: string;
  persistReview: (
    manifestId: string,
    transaction: AuditTransaction,
  ) => Promise<void>;
  persistPublication: (
    manifestId: string,
    supersedesManifestId: string | undefined,
    transaction: AuditTransaction,
  ) => Promise<void>;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: string, name: string): void {
  if (!UUID.test(value)) throw new Error(`${name} must be a UUID`);
}

function fail(message: string): never {
  throw new Error(message);
}

function assertPublishable(request: RegulatoryPublicationRequest): void {
  if (request.auditContext.scope !== "GLOBAL_CORPUS")
    fail("regulatory publication requires GLOBAL_CORPUS audit scope");
  requireUuid(request.publicationId, "publicationId");
  requireUuid(request.actorId, "actorId");
  requireUuid(request.reviewerId, "reviewerId");
  requireUuid(request.publisherId, "publisherId");
  requireUuid(request.policyDecisionId, "policyDecisionId");
  if (
    request.actorId === request.reviewerId ||
    request.actorId === request.publisherId
  )
    fail("maker and Legal publisher must be distinct");
  if (request.reviewerId === request.publisherId)
    fail("reviewer and Legal publisher must be distinct");
  if (request.manifestState !== "DRAFT")
    fail(`invalid transition from ${request.manifestState}`);
  const validation = validateBundle(request.bundle);
  if (!validation.valid)
    fail(
      `publication bundle incomplete: ${validation.errors[0]?.code ?? "INVALID"}`,
    );
  if (
    request.bundle.manifest.sourceIds.length === 0 ||
    request.bundle.manifest.versionIds.length === 0
  )
    fail("publication bundle incomplete: source and version sets are required");
  const hasAuthoritativeSource = request.bundle.sources.some(
    (source) => source.authoritative,
  );
  if (hasAuthoritativeSource && request.legalPublicationGate !== "APPROVED")
    fail("authoritative legal publication remains blocked by OPEN-01");
}

export async function publishRegulatoryBundle(
  request: RegulatoryPublicationRequest,
): Promise<PublicationResult> {
  assertPublishable(request);
  const manifestId = request.bundle.manifest.manifestId;
  const auditContext: AuditContext = {
    ...request.auditContext,
    actor: { id: request.actorId, kind: "USER" },
    policyDecisionId: request.policyDecisionId,
  };
  return request.uow.run(auditContext, async (transaction) => {
    transaction.claimIdempotency({
      actorId: request.actorId,
      route: "regulatory-bundles/:id/publish",
      key: manifestId,
      requestHash: request.bundle.manifest.digest,
    });
    await request.persistReview(manifestId, transaction);
    transaction.recordAudit({
      action: "REGULATORY_REVIEWED",
      resourceType: "regulatory_publication_manifest",
      resourceId: manifestId,
      resourceVersion: request.bundle.manifest.digest,
      result: "SUCCESS",
    });
    await request.persistPublication(
      manifestId,
      request.supersedesManifestId,
      transaction,
    );
    transaction.recordAudit({
      action: "REGULATORY_PUBLISHED",
      resourceType: "regulatory_publication_manifest",
      resourceId: manifestId,
      resourceVersion: request.bundle.manifest.digest,
      result: "SUCCESS",
    });
    transaction.enqueue({
      eventId: request.publicationId,
      type: "RegulationChanged",
      schemaVersion: 1,
      aggregateType: "regulatory_publication",
      aggregateId: request.publicationId,
      payload: {
        manifestId,
        manifestDigest: request.bundle.manifest.digest,
        reviewerRef: request.reviewerId,
        publisherRef: request.publisherId,
        supersedesManifestId: request.supersedesManifestId,
        state: "PUBLISHED",
      },
    });
    return {
      manifestId,
      state: "PUBLISHED",
      ...(request.supersedesManifestId
        ? { supersedesManifestId: request.supersedesManifestId }
        : {}),
    };
  });
}
