import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AuthBoundaryError,
  createOpaqueSession,
  readActiveSession,
  recordLoginFailure,
  revokeSession,
  validateOidcCallback,
} from "../../packages/auth/src/index.ts";

const config = {
  issuer: "https://idp.synthetic.example/realms/privy360",
  audience: "privy360-staff",
};
const claims = {
  iss: config.issuer,
  aud: config.audience,
  sub: "staff-subject-1",
  exp: Math.floor(Date.now() / 1000) + 300,
  nonce: "nonce-1",
  acr: "urn:privy360:mfa",
};

function validInput(overrides = {}) {
  return {
    claims: { ...claims, ...overrides.claims },
    state: "state-1",
    expectedState: "state-1",
    nonce: "nonce-1",
    expectedNonce: "nonce-1",
    codeVerifier: "verifier-1",
    expectedCodeChallenge: "xTYRBLTDt1gS3-rw_3FBVafZ0iNg9bZYBbG8fRPvkEs",
    mfaVerified: true,
    ...overrides,
  };
}

test("OIDC callback accepts only an exact, MFA-assured identity", () => {
  const identity = validateOidcCallback(validInput(), config);
  assert.deepEqual(identity, {
    issuer: config.issuer,
    subject: "staff-subject-1",
    audience: config.audience,
    assurance: "MFA",
  });
});

test("OIDC callback rejects issuer, audience, expiry, replay, PKCE, and MFA failures", () => {
  for (const overrides of [
    { claims: { iss: "https://evil.example" } },
    { claims: { aud: "other-client" } },
    { claims: { exp: 1 } },
    { state: "wrong" },
    { nonce: "wrong" },
    { expectedCodeChallenge: "wrong" },
    { mfaVerified: false },
  ]) {
    assert.throws(() => validateOidcCallback(validInput(overrides), config), AuthBoundaryError);
  }
});

test("OIDC callback never accepts a caller-controlled tenant claim", () => {
  assert.throws(
    () => validateOidcCallback(validInput({ claims: { tenant_id: "attacker" } }), config),
    (error) => error instanceof AuthBoundaryError && error.message === "Untrusted tenant claim rejected.",
  );
});

test("opaque sessions persist only a hash and use secure host-only cookies", async () => {
  const session = createOpaqueSession({
    userId: "11111111-1111-4111-8111-111111111111",
    issuer: config.issuer,
    subject: claims.sub,
    tenantId: "22222222-2222-4222-8222-222222222222",
    securityEpoch: 1,
    idleSeconds: 1800,
    absoluteSeconds: 43200,
  });
  assert.match(session.cookie, /^__Host-privy360_session=/);
  assert.match(session.cookie, /Secure/);
  assert.match(session.cookie, /HttpOnly/);
  assert.match(session.cookie, /SameSite=Lax/);
  assert.doesNotMatch(JSON.stringify(session.record), /privy360_session=/);
  assert.doesNotMatch(JSON.stringify(session.record), /rawToken|secret/i);

  const store = new Map([[session.record.sessionId, session.record]]);
  assert.equal((await readActiveSession(store, session.presentedToken)).userId, session.record.userId);
  await revokeSession(store, session.record.sessionId);
  await assert.rejects(() => readActiveSession(store, session.presentedToken), /revoked/i);
});

test("audit events are redacted and authentication does not create tenant authority", () => {
  const events = [];
  const session = createOpaqueSession({
    userId: "11111111-1111-4111-8111-111111111111",
    issuer: config.issuer,
    subject: claims.sub,
    audit: { append: (event) => events.push(event) },
  });
  assert.equal(session.record.tenantId, undefined);
  assert.equal(events[0].type, "LoginSucceeded");
  assert.doesNotMatch(JSON.stringify(events), /verifier|token|tenant_id|secret/i);
});

test("failed authentication emits only a correlation-scoped failure event", async () => {
  const events = [];
  await recordLoginFailure({ append: (event) => events.push(event) }, "corr-1");
  assert.deepEqual(events, [{ type: "LoginFailed", correlationId: "corr-1" }]);
});

test("identity migration is tenant-safe and rollback-scoped", async () => {
  const up = await readFile(resolve("packages/database/migrations/0006_identity_foundation.up.sql"), "utf8");
  const down = await readFile(resolve("packages/database/migrations/0006_identity_foundation.down.sql"), "utf8");
  assert.match(up, /unique \(tenant_id, issuer, subject\)/i);
  assert.match(up, /foreign key \(tenant_id, user_id\) references tenant\.users/i);
  assert.match(up, /enable row level security/i);
  assert.match(up, /force row level security/i);
  assert.match(up, /token_bundle_secret_ref/i);
  assert.doesNotMatch(up, /password|raw_token|access_token|refresh_token/i);
  assert.match(down, /drop table if exists tenant\.sessions/i);
  assert.match(down, /drop table if exists tenant\.users/i);
  assert.doesNotMatch(down, /platform\.tenants|actor_refs|organisations/i);
});
