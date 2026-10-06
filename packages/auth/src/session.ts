import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AuthBoundaryError } from "./oidc.ts";

export type AuditEvent = Readonly<{
  type: "LoginSucceeded" | "LoginFailed" | "SessionRevoked";
  sessionId?: string;
  userId?: string;
  issuer?: string;
  subject?: string;
  correlationId: string;
}>;
export type AuditSink = Readonly<{
  append(event: AuditEvent): void | Promise<void>;
}>;
export type SessionRecord = Readonly<{
  sessionId: string;
  userId: string;
  issuer: string;
  subject: string;
  tenantId?: string;
  tokenHash: string;
  expiresAt: number;
  idleExpiresAt: number;
  securityEpoch: number;
  revokedAt?: number;
}>;
export type SessionResult = Readonly<{
  presentedToken: string;
  cookie: string;
  record: SessionRecord;
}>;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function recordLoginFailure(
  audit: AuditSink,
  correlationId: string,
): Promise<void> {
  await audit.append({ type: "LoginFailed", correlationId });
}

export function createOpaqueSession(
  input: Readonly<{
    userId: string;
    issuer: string;
    subject: string;
    tenantId?: string;
    securityEpoch?: number;
    idleSeconds?: number;
    absoluteSeconds?: number;
    audit?: AuditSink;
  }>,
): SessionResult {
  const now = Math.floor(Date.now() / 1000);
  const token = randomBytes(32).toString("base64url");
  const sessionId = randomUUID();
  const record: SessionRecord = Object.freeze({
    sessionId,
    userId: input.userId,
    issuer: input.issuer,
    subject: input.subject,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    tokenHash: hash(token),
    expiresAt: now + (input.absoluteSeconds ?? 43200),
    idleExpiresAt: now + (input.idleSeconds ?? 1800),
    securityEpoch: input.securityEpoch ?? 1,
  });
  void input.audit?.append({
    type: "LoginSucceeded",
    sessionId,
    userId: input.userId,
    issuer: input.issuer,
    subject: input.subject,
    correlationId: sessionId,
  });
  return Object.freeze({
    presentedToken: token,
    cookie: `__Host-privy360_session=${token}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    record,
  });
}

export async function readActiveSession(
  store: ReadonlyMap<string, SessionRecord>,
  presentedToken: string,
): Promise<SessionRecord> {
  const record = [...store.values()].find(
    (candidate) => candidate.tokenHash === hash(presentedToken),
  );
  const now = Math.floor(Date.now() / 1000);
  if (
    !record ||
    record.revokedAt !== undefined ||
    record.expiresAt <= now ||
    record.idleExpiresAt <= now
  )
    throw new AuthBoundaryError("Session is revoked or expired.");
  return record;
}

export async function revokeSession(
  store: Map<string, SessionRecord>,
  sessionId: string,
  audit?: AuditSink,
): Promise<void> {
  const record = store.get(sessionId);
  if (!record) throw new AuthBoundaryError("Session not found.");
  store.set(
    sessionId,
    Object.freeze({ ...record, revokedAt: Math.floor(Date.now() / 1000) }),
  );
  await audit?.append({
    type: "SessionRevoked",
    sessionId,
    userId: record.userId,
    correlationId: sessionId,
  });
}
