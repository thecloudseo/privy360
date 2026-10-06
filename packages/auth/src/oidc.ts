import { createHash, timingSafeEqual } from "node:crypto";

export class AuthBoundaryError extends Error {
  readonly code = "AUTH_BOUNDARY_DENIED";
  constructor(message = "Authentication request denied.") {
    super(message);
    this.name = "AuthBoundaryError";
  }
}

export type OidcIdentity = Readonly<{
  issuer: string;
  subject: string;
  audience: string;
  assurance: "MFA";
}>;

type CallbackInput = Readonly<{
  claims: Readonly<Record<string, unknown>>;
  state: string;
  expectedState: string;
  nonce: string;
  expectedNonce: string;
  codeVerifier: string;
  expectedCodeChallenge: string;
  mfaVerified: boolean;
}>;

type OidcConfig = Readonly<{ issuer: string; audience: string }>;

function equal(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function validateOidcCallback(
  input: CallbackInput,
  config: OidcConfig,
): OidcIdentity {
  const claims = input.claims;
  if (
    Object.keys(claims).some(
      (key) =>
        key === "tenant_id" || key === "tenantId" || key === "membership_id",
    )
  ) {
    throw new AuthBoundaryError("Untrusted tenant claim rejected.");
  }
  if (claims.iss !== config.issuer || claims.aud !== config.audience)
    throw new AuthBoundaryError();
  if (
    typeof claims.sub !== "string" ||
    claims.sub.length === 0 ||
    claims.sub.length > 256
  )
    throw new AuthBoundaryError();
  if (
    typeof claims.exp !== "number" ||
    !Number.isInteger(claims.exp) ||
    claims.exp <= Math.floor(Date.now() / 1000)
  )
    throw new AuthBoundaryError();
  if (
    typeof claims.nonce !== "string" ||
    !equal(input.state, input.expectedState) ||
    !equal(input.nonce, input.expectedNonce) ||
    !equal(claims.nonce, input.expectedNonce)
  )
    throw new AuthBoundaryError();
  if (!equal(challenge(input.codeVerifier), input.expectedCodeChallenge))
    throw new AuthBoundaryError();
  if (input.mfaVerified !== true || claims.acr !== "urn:privy360:mfa")
    throw new AuthBoundaryError();
  return Object.freeze({
    issuer: config.issuer,
    subject: claims.sub,
    audience: config.audience,
    assurance: "MFA",
  });
}
