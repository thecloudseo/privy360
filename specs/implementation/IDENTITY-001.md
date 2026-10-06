# IDENTITY-001 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the staff OIDC callback and server-side session boundary with fail-closed validation, tenant-safe persistence, logout revocation, and durable-ready security events.

**Architecture:** `packages/auth` owns framework-neutral OIDC and opaque-session contracts. The BFF/API adapters are intentionally not implemented here; they consume these contracts later. PostgreSQL stores only minimal staff identity metadata and a hash of the opaque session plus a secret reference for the server-side token bundle. Trusted tenant context remains TENANT-002's contract and membership selection remains IDENTITY-002.

**Tech Stack:** TypeScript ESM, Node built-in crypto, PostgreSQL SQL migrations, Node test runner, pnpm.

**Spec:** `BUILD_PLAN.md` IDENTITY-001; `SECURITY_ARCHITECTURE.md`; `DATABASE_SPEC.md`; `RBAC_ABAC.md`; `EVENT_MODEL.md`; ADR-005, ADR-009, ADR-010, ADR-011.

## Global Constraints

- OIDC issuer, audience, signature, expiry, state, nonce, and PKCE verification fail closed.
- Browser receives only a Secure, HttpOnly, SameSite=Lax host-only opaque session cookie; tokens remain server-side.
- Authentication does not grant tenant membership or authorization.
- Tenant identity comes from verified server-side context; caller tenant claims are never trusted.
- Staff MFA is required by the callback assurance contract; no recovery or federation is added.
- No secrets, raw tokens, passwords, or unnecessary IdP claims are persisted or logged.

## Review Focus

- Issuer/audience and expiry mismatch: callback rejects without disclosing token details.
- State, nonce, and PKCE replay/mismatch: callback rejects before token exchange acceptance.
- Caller-controlled tenant claims: callback produces no tenant context and cannot persist a tenant assignment.
- Session theft/revocation: only a server-side hash is persisted and revoked sessions fail lookup.
- Global/staff identity confusion: platform identity mapping remains separate from tenant membership and authorization.

### Task 1: Freeze adversarial contracts

**Files:**

- Create: `tests/security/identity-001.test.mjs`
- Create: `packages/auth/src/oidc.ts`, `packages/auth/src/session.ts`, `packages/auth/src/index.ts`

**Interfaces:**

- `validateOidcCallback(input, config) -> OidcIdentity` validates exact issuer/audience, state, nonce, PKCE verifier binding, expiry, and MFA assurance.
- `createOpaqueSession(input) -> { cookie, record }` returns a host-only cookie descriptor and a persistence-safe session record.
- `revokeSession(store, sessionId)` and `readActiveSession(store, presentedToken)` provide server-side revocation semantics.
- `AuditSink.append(event)` receives `LoginSucceeded`, `LoginFailed`, and `SessionRevoked` metadata without credentials or raw token values.

- [ ] Write focused positive and negative tests for malformed claims, issuer/audience mismatch, expiry, state/nonce/PKCE replay, missing MFA, token non-persistence, cookie flags, revocation, tenant-claim rejection, and audit redaction.
- [ ] Run the focused test and verify it fails because the auth contracts are absent.

### Task 2: Implement the minimal auth contracts

**Files:** `packages/auth/src/oidc.ts`, `packages/auth/src/session.ts`, `packages/auth/src/index.ts`.

- [ ] Implement exact validation and opaque-session behavior with non-disclosing errors, parameterized claim allowlisting, SHA-256 session hashing, and frozen outputs.
- [ ] Run the focused tests and the package strict typecheck.

### Task 3: Add identity/session migration and static migration tests

**Files:**

- Create: `packages/database/migrations/0006_identity_foundation.up.sql`
- Create: `packages/database/migrations/0006_identity_foundation.down.sql`
- Modify: `scripts/cp1-postgres-rls.mjs` only if the governed migration sequence requires the new migration.
- Modify: `tests/security/identity-001.test.mjs`

- [ ] Add tenant-owned `users` and `sessions` with issuer-subject uniqueness, minimal fields, tenant-safe composite references, expiry/revocation/security epoch fields, RLS, and app-role ownership protections.
- [ ] Add rollback in dependency order and static assertions that no password/token/tenant override columns exist.
- [ ] Run static migration tests and the approved governed PostgreSQL verification when the canonical service-scoped admission is available.

### Task 4: Repository verification and closure

- [ ] Run frozen install, format, lint, strict typecheck, focused and tenant/security regression tests, migration/database contract tests, full unit/security suite, build, structure, production-boundary, Semgrep/static security checks, changed-source secret scan, and `git diff --check`.
- [ ] Review staged diff for IDENTITY-001-only scope, classify A/B/C/D findings, commit `feat(identity): establish identity foundation`, and record final Git status.

## Explicit exclusions

No IDENTITY-002/003+, membership selection, RBAC/ABAC evaluator, federation, account UI, public controller implementation, user provisioning, service credentials, audit dispatcher/outbox, real provider integration, or production approval.
