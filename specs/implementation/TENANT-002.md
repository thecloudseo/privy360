# TENANT-002 Implementation Plan

## Objective

Implement the trusted, transaction-local tenant context boundary consumed by repositories and workers, plus a composite tenant-FK fixture that proves tenant-safe links. The adapter must fail closed before database work, set only transaction-local context, and rely on PostgreSQL FORCE RLS for row isolation.

## Authority and CP1

Authority: `AGENTS.md`, the TENANT-002 card in `BUILD_PLAN.md`, the CP1 row in `EXECUTION_ROADMAP.md`, TENANT-001 migration/contracts, `SECURITY_ARCHITECTURE.md`, `DATABASE_SPEC.md`, `RBAC_ABAC.md`, ADR-004 and ADR-010. CP1 evidence is: tenant schema/FKs, transaction-local context, runtime-role RLS escape suite, and the routing/cache/object-key contract boundary. Local runtime evidence is reported separately if protected PostgreSQL admission is unavailable.

## Contracts consumed

- TENANT-001 global platform tenant registry and tenant-owned hierarchy.
- Composite `(tenant_id, id)` keys and foreign keys.
- Existing `privy360_app` non-owner, `NOBYPASSRLS` role and `privy360.tenant_id` policy setting.
- FOUNDATION-005's fail-closed API validation/correlation boundary; no client tenant field is accepted as trusted context.

## Contracts owned

- `TrustedTenantContext`: verified server-side tenant/membership/actor references, source channel, and correlation ID; no browser/header tenant authority.
- `withTenantTransaction`: requires a valid context, executes `set_config('privy360.tenant_id', ..., true)` inside the transaction, and delegates commit/rollback and connection release to the transaction provider.
- Nested context guard: same-tenant nesting is allowed; a different tenant is denied.
- Composite-FK fixture SQL for a tenant-owned resource link with RLS and immutable tenant ownership.

## Invariants and adversarial cases

- Missing, malformed, unverified, or caller-controlled context is denied before SQL.
- Context is transaction-local (`SET LOCAL` semantics), never session-global; rollback/commit clears it before pool reuse.
- FORCE RLS and `NOBYPASSRLS` remain required; no application role is granted owner, superuser, or bypass privileges.
- Tenant A cannot read, write, or link Tenant B rows; cross-tenant composite references fail.
- Nested mismatched tenants fail deterministically; transaction failure propagates without leaking context.
- Platform/global operations are not represented by a tenant context and remain a separate authenticated control-plane boundary.

## Explicit exclusions

No identity/session implementation, membership selection, RBAC/ABAC evaluator, tenant routing, cache/object-key helpers, audit dispatcher, regulatory intake, control schema, or public endpoint is implemented. No RLS bypass, default tenant, or production-data fixture is introduced.

## Verification

TDD unit tests cover context validation, fail-closed behavior, SQL parameterization, nesting, rollback propagation, and cleanup assumptions. Static migration/fixture tests cover composite FKs, RLS/FORCE RLS, immutable ownership, role privileges, and no tenant override. A disposable approved PostgreSQL runtime is required for CP1 escape evidence; if admission remains unavailable, the implementation closes with CP1 explicitly blocked on that evidence.
