import { randomUUID } from "node:crypto";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TenantContextSource = "SESSION" | "WORKER" | "SERVICE";

export type TrustedTenantContext = Readonly<{
  tenantId: string;
  actorId: string;
  membershipId: string;
  correlationId: string;
  source: TenantContextSource;
}>;

export class TenantContextDeniedError extends Error {
  readonly code = "TENANT_CONTEXT_DENIED";

  constructor(message = "Trusted tenant context is required.") {
    super(message);
    this.name = "TenantContextDeniedError";
  }
}

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new TenantContextDeniedError(`${field} is invalid.`);
  }
  return value;
}

/** Internal boundary: `verified` can only be set after server-side membership verification. */
export function createTrustedTenantContext(input: {
  readonly tenantId: string;
  readonly actorId: string;
  readonly membershipId: string;
  readonly correlationId?: string;
  readonly source: TenantContextSource;
  readonly verified: true;
}): TrustedTenantContext {
  if (input.verified !== true) throw new TenantContextDeniedError();
  return Object.freeze({
    tenantId: requireUuid(input.tenantId, "tenantId"),
    actorId: requireUuid(input.actorId, "actorId"),
    membershipId: requireUuid(input.membershipId, "membershipId"),
    correlationId: requireUuid(
      input.correlationId ?? randomUUID(),
      "correlationId",
    ),
    source: input.source,
  });
}

export function assertSameTenantContext(
  current: TrustedTenantContext | undefined,
  next: TrustedTenantContext,
): void {
  if (current && current.tenantId !== next.tenantId) {
    throw new TenantContextDeniedError("Nested tenant context mismatch.");
  }
}
