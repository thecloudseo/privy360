import { query } from "./db.js";

export interface AuditEventPayload {
  tenantId: string;
  actorId: string;
  resourceType: string;
  resourceId?: string | undefined;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "WITHDRAW";
  changes?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Log an audit event
 * Per AGENTS.md §15: Every mutation must produce an audit event
 * Per DATABASE_SPEC.md: audit_events table is immutable (INSERT-only)
 */
export async function logAuditEvent(payload: AuditEventPayload): Promise<void> {
  const {
    tenantId,
    actorId,
    resourceType,
    resourceId,
    action,
    changes,
    ipAddress,
    userAgent,
  } = payload;

  try {
    await query(
      `INSERT INTO audit_events (
        tenant_id, actor_id, resource_type, resource_id, action, changes, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        actorId,
        resourceType,
        resourceId,
        action,
        changes ? JSON.stringify(changes) : null,
        ipAddress || null,
        userAgent || null,
      ],
      tenantId,
    );
  } catch (err) {
    // Per AGENTS.md §37: Do not hide failures
    console.error("Failed to log audit event:", err);
    throw err;
  }
}
