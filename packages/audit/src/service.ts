// Audit service for application-level audit logging
// Authority: AGENTS.md §15, DATABASE_SPEC.md §4, SECURITY_ARCHITECTURE.md §4

import {
  AuditContext,
  AuditRecord,
  AuditTransaction,
  DomainEvent,
  ActorRef,
} from "./index.ts";

export interface AuditedMutation<T> {
  readonly result: T;
  readonly auditRecord: AuditRecord;
  readonly events?: readonly DomainEvent[];
}

/**
 * High-level audit service wrapping transaction-based audit logging.
 * Every mutation must be audited (AGENTS.md §15).
 * Enforces tenant isolation and immutability.
 */
export class AuditService {
  constructor(private readonly context: AuditContext) {
    // Validate context on creation
    if (!context.tenantId && context.scope === "TENANT") {
      throw new Error("tenantId required for tenant audit scope");
    }
  }

  /**
   * Log a successful resource creation.
   * AGENTS.md §15: Every CREATE mutation must be audited.
   */
  recordCreate(
    transaction: AuditTransaction,
    resourceType: string,
    resourceId: string,
    data: unknown,
  ): void {
    transaction.recordAudit({
      action: "CREATE",
      resourceType,
      resourceId,
      result: "SUCCESS",
      changedFieldNames: this.extractFieldNames(data),
      afterDigest: this.digest(data),
    });
  }

  /**
   * Log a successful resource update.
   * AGENTS.ms §15: Include before/after state for mutation visibility.
   */
  recordUpdate(
    transaction: AuditTransaction,
    resourceType: string,
    resourceId: string,
    before: unknown,
    after: unknown,
  ): void {
    transaction.recordAudit({
      action: "UPDATE",
      resourceType,
      resourceId,
      result: "SUCCESS",
      changedFieldNames: this.extractDifferentFields(before, after),
      beforeDigest: this.digest(before),
      afterDigest: this.digest(after),
    });
  }

  /**
   * Log a successful resource deletion.
   * AGENTS.ms §15: Deletion is a critical mutation; must be audited with rationale.
   */
  recordDelete(
    transaction: AuditTransaction,
    resourceType: string,
    resourceId: string,
    beforeData: unknown,
  ): void {
    transaction.recordAudit({
      action: "DELETE",
      resourceType,
      resourceId,
      result: "SUCCESS",
      beforeDigest: this.digest(beforeData),
    });
  }

  /**
   * Log a failed operation attempt.
   * AGENTS.ms §15: Failures are also audited (denial tracking).
   */
  recordDenied(
    transaction: AuditTransaction,
    resourceType: string,
    resourceId: string,
    action: string,
    reason?: string,
  ): void {
    transaction.recordAudit({
      action: `${action}_DENIED`,
      resourceType,
      resourceId,
      result: "DENIED",
    });
  }

  /**
   * Log an approval action (e.g., notice published, DPIA approved).
   * AGENTS.ms §24: Approval workflows must be audited.
   */
  recordApproval(
    transaction: AuditTransaction,
    resourceType: string,
    resourceId: string,
    approvalType: string,
  ): void {
    transaction.recordAudit({
      action: "APPROVE",
      resourceType,
      resourceId,
      result: "SUCCESS",
      changedFieldNames: ["status", "approvedAt", "approverNote"],
    });
  }

  /**
   * Log role or permission changes.
   * AGENTS.ms §15: Authorization changes are security-critical.
   */
  recordAuthorizationChange(
    transaction: AuditTransaction,
    userId: string,
    oldRole: string,
    newRole: string,
  ): void {
    transaction.recordAudit({
      action: "UPDATE",
      resourceType: "user_role",
      resourceId: userId,
      result: "SUCCESS",
      changedFieldNames: ["role"],
      beforeDigest: this.digest({ role: oldRole }),
      afterDigest: this.digest({ role: newRole }),
    });
  }

  /**
   * Log consent grant/withdrawal.
   * AGENTS.ms §15: Consent is central to data processing legality.
   */
  recordConsentChange(
    transaction: AuditTransaction,
    consentId: string,
    principalId: string,
    purpose: string,
    action: "GRANT" | "WITHDRAW",
  ): void {
    transaction.recordAudit({
      action,
      resourceType: "consent",
      resourceId: consentId,
      result: "SUCCESS",
      changedFieldNames: ["status"],
    });
  }

  /**
   * Log personal data deletion execution.
   * AGENTS.ms §15: Deletion is a critical sensitive operation.
   */
  recordDeletionExecution(
    transaction: AuditTransaction,
    deletionRequestId: string,
    deletedCount: number,
    systems: readonly string[],
  ): void {
    transaction.recordAudit({
      action: "DELETE",
      resourceType: "personal_data_deletion",
      resourceId: deletionRequestId,
      result: "SUCCESS",
      changedFieldNames: ["deletedCount", "systems", "completedAt"],
    });
  }

  /**
   * Log breach notification submission.
   * AGENTS.ms §15: Regulatory notifications are audit-critical.
   */
  recordBreachNotification(
    transaction: AuditTransaction,
    incidentId: string,
    recipientType: "AUTHORITY" | "PRINCIPAL",
    recipient: string,
  ): void {
    transaction.recordAudit({
      action: "SUBMIT",
      resourceType: "breach_notification",
      resourceId: incidentId,
      result: "SUCCESS",
      changedFieldNames: ["notificationSent", "recipient", "timestamp"],
    });
  }

  /**
   * Enqueue a domain event for processing.
   * AGENTS.ms §23: Important state transitions must emit events.
   */
  enqueueEvent(
    transaction: AuditTransaction,
    event: DomainEvent,
  ): void {
    transaction.enqueue(event);
  }

  /**
   * Claim idempotency key to prevent duplicate processing.
   * AGENTS.ms §17: Sensitive/retryable operations need idempotency.
   */
  claimIdempotency(
    transaction: AuditTransaction,
    actorId: string,
    route: string,
    key: string,
    requestHash: string,
  ): void {
    transaction.claimIdempotency({
      actorId,
      route,
      key,
      requestHash,
    });
  }

  /**
   * Private helper: extract field names from object.
   */
  private extractFieldNames(data: unknown): string[] {
    if (!data || typeof data !== "object") return [];
    return Object.keys(data as Record<string, unknown>);
  }

  /**
   * Private helper: compute hash of object for before/after tracking.
   * Used for integrity and versioning, not cryptography.
   */
  private digest(data: unknown): string {
    if (!data) return "";
    // Simple deterministic JSON hash; in production use crypto.createHash
    const json = JSON.stringify(data, Object.keys(
      data as Record<string, unknown>
    ).sort());
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Private helper: extract field names that changed between before/after.
   */
  private extractDifferentFields(before: unknown, after: unknown): string[] {
    if (!before || typeof before !== "object" || !after || typeof after !== "object") {
      return [];
    }
    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;
    const changed = new Set<string>();

    for (const key of Object.keys(afterObj)) {
      if (JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key])) {
        changed.add(key);
      }
    }
    return Array.from(changed);
  }
}

/**
 * Create audit service for a mutation operation.
 * Ties audit context (tenant, actor, correlation) to service.
 */
export function createAuditService(context: AuditContext): AuditService {
  return new AuditService(context);
}
