# IDENTITY-002 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish fail-closed staff membership selection that binds an authenticated IDENTITY-001 session to a verified active tenant membership and produces the existing TENANT-002 trusted context.

**Architecture:** `packages/auth` owns a framework-neutral membership repository port and selection service. It authenticates the caller only through the existing opaque session record, resolves the requested membership from server-side state, checks membership and tenant lifecycle/security epochs, and then calls `createTrustedTenantContext` from `@privy360/security`. No caller tenant ID, OIDC tenant claim, header, or session metadata becomes authority. The migration adds tenant-safe membership rows and RLS; API/BFF adapters remain outside this ticket.

**Tech Stack:** TypeScript ESM, existing `@privy360/auth` and `@privy360/security` contracts, PostgreSQL SQL migration, Node test runner, pnpm.

**Spec:** `BUILD_PLAN.md` IDENTITY-002; `DOMAIN_MODEL.md`; `SECURITY_ARCHITECTURE.md`; `DATABASE_SPEC.md`; `EVENT_MODEL.md`; IDENTITY-001, TENANT-001/002/003 plans; ADR-009, ADR-010, ADR-011.

## Global Constraints

- Authentication, membership, tenant context, and authorization remain separate boundaries.
- Membership is resolved only from trusted server-side issuer+subject/user state and an opaque membership identifier.
- Active selection requires membership `ACTIVE`, tenant `ACTIVE`, matching tenant ownership, and current security epoch.
- `SUSPENDED`/`REVOKED` membership, suspended/closing tenant, stale session epoch, missing membership, and mismatches deny access.
- Trusted context is created only with TENANT-002 `createTrustedTenantContext`; no competing mechanism is introduced.
- Audit events contain pseudonymous identifiers and reason codes only; no raw tokens, claims, or personal data.

## Review Focus

- A valid login without a membership: deny before context creation.
- Membership from another tenant or forged tenant input: deny and ignore caller tenant values.
- Suspension/revocation after selection: next resolution denies and constrains the stale session.
- Duplicate or concurrent selection: deterministic membership identity and idempotent result; no cross-tenant ambiguity.
- Nested or malformed context: fail through the existing TENANT-002 trusted-context guard.

### Task 1: Freeze adversarial membership contracts

**Files:**
- Create: `tests/security/identity-002.test.mjs`
- Modify: `packages/auth/src/session.ts`
- Create: `packages/auth/src/membership.ts`
- Modify: `packages/auth/src/index.ts`

**Interfaces:**
- `MembershipRecord`: immutable server-side `{membershipId,userId,tenantId,issuer,subject,membershipState,tenantState,membershipSecurityEpoch,tenantSecurityEpoch,actorId}`.
- `MembershipStore.findForSession(session, membershipId) -> Promise<MembershipRecord | undefined>`.
- `selectTenantMembership(session, membershipId, store, audit) -> Promise<TrustedTenantContext>`.
- `assertSelectedMembershipCurrent(session, context, store, audit) -> Promise<TrustedTenantContext>`.

- [ ] Write failing tests for no membership, forged tenant input/claims, cross-tenant identity, suspended/revoked membership, suspended tenant, stale security epoch, malformed IDs, deterministic duplicate selection, and audit redaction.
- [ ] Run the focused test and verify it fails because the membership contract is absent.

### Task 2: Implement selection and current-state enforcement

**Files:** `packages/auth/src/membership.ts`, `packages/auth/src/session.ts`, `packages/auth/src/index.ts`.

- [ ] Implement server-side lookup, exact issuer+subject binding, lifecycle/epoch checks, trusted-context creation, same-tenant protection, and `SessionSelected`/`TenantAccessDenied` audit events.
- [ ] Run focused identity-001 and identity-002 tests; preserve secure opaque-session behavior.

### Task 3: Add tenant-safe membership migration

**Files:**
- Create: `packages/database/migrations/0010_identity_memberships.up.sql`
- Create: `packages/database/migrations/0010_identity_memberships.down.sql`
- Modify: `tests/security/identity-002.test.mjs`

- [ ] Add `tenant.user_memberships` with composite tenant/user FKs, immutable membership identity, constrained lifecycle, security epoch, active uniqueness, RLS/FORCE RLS, indexes, app-role grants, and no tenant reassignment path.
- [ ] Add rollback scoped only to this migration and static assertions against caller-controlled tenant authority or secrets.
- [ ] Use the governed PostgreSQL verification path only if its approved migration sequence admits this ticket; otherwise report static evidence and integration sequencing.

### Task 4: Verification and closure

- [ ] Run frozen install, format, lint, strict typecheck, build, focused identity tests, IDENTITY-001 and tenant regressions, audit regressions, migration tests, full unit/security suite, structure, production boundary, available Semgrep/gitleaks, changed-source secret scan, and `git diff --check`.
- [ ] Review staged diff for IDENTITY-002-only scope, classify A/B/C/D, commit `feat(identity): enforce tenant membership selection`, and record final status.

## Explicit exclusions

No AUTHZ-001/002/003, IDENTITY-003+, principal identity, federation, account UI, public controller wiring, membership administration/invitations, role/permission evaluation, audit dispatcher/outbox, or production approval.
