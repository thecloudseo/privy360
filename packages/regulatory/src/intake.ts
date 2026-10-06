import { createHash } from "node:crypto";
import {
  type AtomicAuditUnitOfWork,
  type AuditContext,
  type AuditTransaction,
} from "@privy360/audit";
import { validateBundle, type Bundle } from "@privy360/regulatory";

export type IntakeReceipt = Readonly<{
  importId: string;
  manifestId: string;
  manifestDigest: string;
  state: "QUARANTINED";
}>;

export type RegulatoryImportRequest = Readonly<{
  bundle: Bundle;
  manifestBytes: Uint8Array;
  intakeId: string;
  authorization: Readonly<{ allowed: boolean; policyDecisionId: string }>;
  auditContext: AuditContext;
  uow: AtomicAuditUnitOfWork;
  persist: (
    receipt: IntakeReceipt,
    transaction: AuditTransaction,
  ) => Promise<"CREATED" | "DUPLICATE">;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(message: string): never {
  throw new Error(message);
}

export async function importRegulatoryManifest(
  request: RegulatoryImportRequest,
): Promise<IntakeReceipt> {
  if (!request.authorization.allowed)
    fail("source-editor authorization denied");
  if (!UUID.test(request.intakeId)) fail("intakeId must be a UUID");
  if (!UUID.test(request.authorization.policyDecisionId))
    fail("policyDecisionId must be a UUID");
  if (request.auditContext.scope !== "GLOBAL_CORPUS")
    fail("regulatory intake requires GLOBAL_CORPUS audit scope");
  const validation = validateBundle(request.bundle);
  if (!validation.valid)
    fail(
      `manifest validation failed: ${validation.errors[0]?.code ?? "INVALID"}`,
    );
  const actualDigest = digest(request.manifestBytes);
  if (actualDigest !== request.bundle.manifest.digest)
    fail("manifest checksum mismatch");

  const receipt: IntakeReceipt = {
    importId: request.intakeId,
    manifestId: request.bundle.manifest.manifestId,
    manifestDigest: request.bundle.manifest.digest,
    state: "QUARANTINED",
  };
  const auditContext: AuditContext = {
    ...request.auditContext,
    policyDecisionId: request.authorization.policyDecisionId,
  };
  return request.uow.run(auditContext, async (transaction) => {
    transaction.claimIdempotency({
      actorId: auditContext.actor?.id ?? fail("actor attribution required"),
      route: "regulatory-sources/import",
      key: receipt.manifestDigest,
      requestHash: receipt.manifestDigest,
    });
    const persistence = await request.persist(receipt, transaction);
    if (persistence === "DUPLICATE") return receipt;
    transaction.recordAudit({
      action: "REGULATORY_SOURCE_IMPORTED",
      resourceType: "regulatory_source_manifest",
      resourceId: receipt.manifestId,
      resourceVersion: receipt.manifestDigest,
      result: "SUCCESS",
    });
    transaction.enqueue({
      eventId: receipt.importId,
      type: "RegulatorySourceImported",
      schemaVersion: 1,
      aggregateType: "regulatory_source_import",
      aggregateId: receipt.importId,
      payload: {
        manifestDigest: receipt.manifestDigest,
        state: receipt.state,
        sourceIds: request.bundle.manifest.sourceIds,
        versionIds: request.bundle.manifest.versionIds,
      },
    });
    return receipt;
  });
}
