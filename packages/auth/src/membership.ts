import {
  createTrustedTenantContext,
  TenantContextDeniedError,
  type TrustedTenantContext,
} from "../../security/src/tenant-context.ts";
import { AuthBoundaryError } from "./oidc.ts";
import type { AuditEvent, AuditSink, SessionRecord } from "./session.ts";

export type MembershipState = "ACTIVE" | "SUSPENDED" | "REVOKED";
export type TenantState = "ACTIVE" | "SUSPENDED" | "CLOSING";
export type MembershipRecord = Readonly<{
  membershipId: string;
  userId: string;
  tenantId: string;
  issuer: string;
  subject: string;
  membershipState: MembershipState;
  tenantState: TenantState;
  membershipSecurityEpoch: number;
  tenantSecurityEpoch: number;
  actorId: string;
}>;
export type MembershipStore = Readonly<{
  findForSession(session: SessionRecord, membershipId: string): Promise<MembershipRecord | undefined>;
}>;

function deny(audit: AuditSink | undefined, session: SessionRecord, membershipId: string, reasonCode: string): never {
  const event: AuditEvent = { type: "TenantAccessDenied", membershipId, reasonCode, correlationId: session.sessionId };
  void audit?.append(event);
  throw new AuthBoundaryError("Tenant membership access denied.");
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolve(session: SessionRecord, membershipId: string, store: MembershipStore, audit?: AuditSink): Promise<MembershipRecord> {
  if (!validUuid(membershipId)) return deny(audit, session, membershipId, "MALFORMED_MEMBERSHIP");
  const membership = await store.findForSession(session, membershipId);
  if (!membership) return deny(audit, session, membershipId, "MEMBERSHIP_NOT_FOUND");
  if (membership.userId !== session.userId || membership.issuer !== session.issuer || membership.subject !== session.subject) return deny(audit, session, membershipId, "IDENTITY_MISMATCH");
  if (session.tenantId !== undefined && session.tenantId !== membership.tenantId) return deny(audit, session, membershipId, "TENANT_MISMATCH");
  if (membership.membershipState !== "ACTIVE") return deny(audit, session, membershipId, "MEMBERSHIP_INACTIVE");
  if (membership.tenantState !== "ACTIVE") return deny(audit, session, membershipId, "TENANT_INACTIVE");
  if (membership.membershipSecurityEpoch > session.securityEpoch || membership.tenantSecurityEpoch > session.securityEpoch) return deny(audit, session, membershipId, "STALE_SESSION");
  return membership;
}

export async function selectTenantMembership(session: SessionRecord, membershipId: string, store: MembershipStore, audit?: AuditSink): Promise<TrustedTenantContext> {
  const membership = await resolve(session, membershipId, store, audit);
  let context: TrustedTenantContext;
  try {
    context = createTrustedTenantContext({ tenantId: membership.tenantId, actorId: membership.actorId, membershipId: membership.membershipId, correlationId: session.sessionId, source: "SESSION", verified: true });
  } catch (error) {
    if (error instanceof TenantContextDeniedError) return deny(audit, session, membershipId, "CONTEXT_REJECTED");
    throw error;
  }
  await audit?.append({ type: "SessionSelected", tenantId: context.tenantId, membershipId: context.membershipId, correlationId: context.correlationId });
  return context;
}

export async function assertSelectedMembershipCurrent(session: SessionRecord, context: TrustedTenantContext, store: MembershipStore, audit?: AuditSink): Promise<TrustedTenantContext> {
  const membership = await resolve(session, context.membershipId, store, audit);
  if (membership.tenantId !== context.tenantId || membership.actorId !== context.actorId) return deny(audit, session, context.membershipId, "CONTEXT_MISMATCH");
  return context;
}
