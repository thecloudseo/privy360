# FOUNDATION-004 Implementation Plan

## Objective

Implement the portable secrets/KMS application boundary, a deterministic fake test adapter, and an approved-provider configuration contract. The implementation must fail closed when a required provider is unavailable or configuration is invalid, while leaving provider selection and cryptographic profile approval to OPEN-02.

## Approved prerequisites and ownership

- Prerequisite: FOUNDATION-003.
- Owned artifacts: `@privy360/security` package, typed secret/key-provider ports, fake adapter, provider configuration parser, and focused contract/security tests.
- Downstream consumers: FOUNDATION-005, SECURITY-001, and HARDEN-001 may depend on the exported interfaces and configuration behavior only.

## Boundaries and implications

- Security: default deny; no plaintext secrets in logs/errors; no production credentials; no provider bypass; fake adapter is explicitly test-only.
- Tenant: no tenant data or tenant-owned persistence is introduced. Future consumers must supply trusted scope/context; this ticket does not invent tenant authorization.
- Database/API/events/audit: none. SecretAccessDenied and RotationRequested remain event metadata contracts for later durable audit ownership; this ticket does not implement an event bus or audit store.
- Deployment: provider names are configuration values, not vendor commitments. OPEN-02 remains required before production crypto/secrets acceptance.

## Expected files

- `pnpm-workspace.yaml` and `pnpm-lock.yaml` for package inclusion.
- `packages/security/package.json`, `packages/security/tsconfig.json`, `packages/security/src/*`.
- `tests/security/foundation-004.test.mjs`.

## Tests and acceptance criteria

- Port contract is deterministic and does not expose implementation details.
- Fake adapter supports synthetic test values without becoming a production fallback.
- Approved-provider configuration accepts only supported declared modes and rejects missing/invalid provider configuration.
- Missing provider and unavailable secret access fail closed with safe, non-secret errors.
- Secret values never appear in errors, logs, or serialized failure results.
- Focused contract, fake-adapter, provider-configuration, and negative tests pass; repository T0/structure/security checks remain green.

## Explicitly out of scope

FOUNDATION-005 API middleware, SECURITY-001 envelope encryption/storage, HARDEN-001 backup/restore tooling, provider/vendor selection, cryptographic algorithm selection, database schema, runtime endpoints, production secret access, and changes to FOUNDATION-003.
