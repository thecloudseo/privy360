import { query } from "./db.js";
import { logAuditEvent } from "./audit.js";
import { CreateConsentRequest, ConsentResponse } from "../schemas/consent.js";

export interface CreateConsentPayload {
  tenantId: string;
  actorId: string;
  request: CreateConsentRequest;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Create consent record
 * Per API_ARCHITECTURE.md §1.1: POST /api/v1/consents implementation
 *
 * Business rules:
 * - dataPrincipalId + purpose must be unique per tenant (via DB constraint)
 * - Status determined by grantConsent flag
 * - If grantConsent=true, status='granted' and granted_date=now()
 * - If grantConsent=false, status='pending' and no granted_date
 * - Duplicate attempts return 409 Conflict
 */
export async function createConsent(
  payload: CreateConsentPayload,
): Promise<ConsentResponse> {
  const { tenantId, actorId, request, ipAddress, userAgent } = payload;
  const { dataPrincipalId, purpose, grantConsent } = request;

  // Determine status and granted_date based on grantConsent flag
  const status = grantConsent ? "granted" : "pending";
  const grantedDate = grantConsent ? new Date() : null;
  const grantedBy = grantConsent ? actorId : null;

  try {
    // Insert consent record (unique constraint will catch duplicates)
    const result = await query(
      `INSERT INTO consents (
        tenant_id, principal_id, purpose, status, granted_by, granted_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, now())
      RETURNING id, tenant_id, principal_id, purpose, status, granted_date, created_at`,
      [tenantId, dataPrincipalId, purpose, status, grantedBy, grantedDate],
      tenantId,
    );

    const consentRow = result.rows[0];

    // Log audit event per AGENTS.ms §15
    await logAuditEvent({
      tenantId,
      actorId,
      resourceType: "consent",
      resourceId: consentRow.id,
      action: "CREATE",
      changes: {
        principal_id: dataPrincipalId,
        purpose,
        status,
        granted_by: grantedBy,
      },
      ipAddress,
      userAgent,
    });

    return {
      id: consentRow.id,
      tenantId: consentRow.tenant_id,
      principalId: consentRow.principal_id,
      purpose: consentRow.purpose,
      status: consentRow.status,
      grantedDate: grantedDate ? grantedDate.toISOString() : null,
      createdAt: consentRow.created_at,
    };
  } catch (err: any) {
    // Check for unique constraint violation (duplicate consent)
    if (err.code === "23505") {
      const error = new Error(
        "Consent already exists for this principal and purpose",
      );
      (error as any).code = "DUPLICATE_CONSENT";
      (error as any).statusCode = 409;
      throw error;
    }

    // Other database errors
    console.error("Consent creation failed:", err);
    throw err;
  }
}
