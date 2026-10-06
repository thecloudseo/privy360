# TENANT-001 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the reviewed SQL migration and database contracts for the
platform tenant registry and the tenant-owned organisation hierarchy.

**Architecture:** PostgreSQL remains authoritative and schema evolution uses
reviewed SQL migrations. This ticket creates the migration-owned platform
registry plus tenant-owned `organisations`, `legal_entities`, `business_units`,
`departments`, `actor_refs`, and `resource_registry` tables, with role
separation and RLS-ready composite keys. Trusted transaction-local context and
runtime RLS behavior are consumed by TENANT-002; durable audit/outbox behavior
is owned by AUDIT-001.

**Tech Stack:** PostgreSQL SQL migrations, Node.js built-in test runner,
TypeScript workspace, pnpm.

**Spec:** `BUILD_PLAN.md` TENANT-001, `DATABASE_SPEC.md`,
`SECURITY_ARCHITECTURE.md`, ADR-004, ADR-009, ADR-010.

## Global Constraints

- Tenant is an explicit security boundary; hostname or implicit environment is
  never tenant identity.
- Tenant-owned tables have non-null `tenant_id`, server-generated UUID IDs,
  inherited timestamps/version columns, and composite tenant foreign keys.
- Runtime roles are non-owner, non-superuser, and `NOBYPASSRLS`; migration
  ownership is separate and unavailable to applications.
- Bootstrap actor creation is restricted to the provisioning transaction and
  cannot be created by public input.
- No business endpoint, trusted tenant-context adapter, identity/auth flow,
  durable audit/outbox, or downstream ticket implementation is included.

## Owned entities and invariants

- `platform.tenants`: immutable UUID root, unique normalized slug, state
  `ACTIVE|SUSPENDED|CLOSING`, security epoch, deployment reference.
- `platform.deployments`: unique deployment code and tenant reference; only
  secret references/capability metadata, never credentials.
- Tenant-owned organisation hierarchy: one organisation per tenant/code;
  legal entities unique within organisation; business units unique within legal
  entity and self-parent/cross-entity/cycle relationships are rejected;
  departments unique within business unit.
- `tenant.actor_refs`: exactly one actor kind/reference contract is reserved;
  only `BOOTSTRAP` may exist without a later identity FK, and bootstrap rows
  require the restricted provisioning marker.
- `tenant.resource_registry`: immutable tenant-scoped resource/type identity;
  uniqueness is tenant-local and it is not a graph authority.

## Review Focus

- Cross-tenant hierarchy links: composite FKs reject mismatched tenant IDs.
- Business-unit cycles and self-parents: a constraint/trigger rejects them.
- Runtime ownership: app role cannot own tables or bypass RLS.
- Bootstrap creation: public/app roles cannot insert unrestricted bootstrap
  actors.
- Migration reversibility: down migration removes only this ticket's objects
  and upgrade is idempotent through the migration ledger.

## Implementation tasks

### Task 1: Migration contract and adversarial schema tests

**Files:** create `tests/tenancy/tenant-001.test.mjs` and the SQL migration
files listed in Task 2.

- [ ] Write tests that assert table/column/constraint/index/policy/role
      declarations, migration ordering, rollback coverage, and rejection of
      cross-tenant, hierarchy-cycle, app-owner, RLS-bypass, and unrestricted
      bootstrap patterns.
- [ ] Run the focused tests and verify they fail because the migration is
      absent or incomplete.

### Task 2: Forward and rollback migrations

**Files:** create `packages/database/migrations/0001_tenant_foundation.up.sql`
and `packages/database/migrations/0001_tenant_foundation.down.sql`.

- [ ] Add separate `platform` and `tenant` schemas, migration ledger support,
      migration-only/app/runtime role declarations, UUIDv7 generation contract,
      platform registry tables, tenant-owned hierarchy tables, actor/resource
      tables, composite FKs, indexes, check constraints, RLS enable/force policy
      definitions, and restricted bootstrap provisioning function.
- [ ] Add a deferred hierarchy validation trigger that rejects self-parent,
      cross-legal-entity parent, and ancestor cycles.
- [ ] Make the down migration reverse all objects in dependency order and
      include no unrelated tables.

### Task 3: Documentation and package boundary

**Files:** create `packages/database/README.md` update and keep all database
ownership details in this plan; no shared contract package changes unless a
typed public contract is required by test evidence.

- [ ] Document that repositories must consume stable tenant/resource refs and
      never rely on physical schema details; record TENANT-002/AUDIT-001 handoff
      boundaries and the synthetic-only verification limit.

### Task 4: Verification and closure

- [ ] Run frozen install, format, lint, strict typecheck, focused tenancy tests,
      migration static/schema checks, applicable integration/security checks,
      build, structure validation, secret scan, and `git diff --check`.
- [ ] Classify findings A/B/C/D, confirm no adjacent ticket files changed, and
      commit only after fresh evidence.

## Explicit exclusions

No trusted tenant context/session adapter, tenant RLS transaction helper,
membership selection, authentication, authorization registry, audit event or
outbox implementation, API endpoint, actor identity FK completion, tenant
admin UI, production provisioning, or real personal data.
