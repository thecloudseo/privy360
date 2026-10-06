# AUDIT-001 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the append-only audit stream, canonical audit envelope,
transactional outbox/idempotency schema, and atomic mutation boundary.

**Architecture:** `packages/audit` owns the stable TypeScript contract for
trusted audit attribution and an atomic unit-of-work port. `packages/database`
owns the reviewed SQL migration for tenant/platform streams, immutable event
rows, outbox records, and idempotency records. The implementation accepts a
trusted context supplied by TENANT-002 but does not create identity, tenant
selection, authorization, dispatch, inbox, or query implementations.

**Tech Stack:** TypeScript, PostgreSQL reviewed SQL migrations, Node built-in
test runner, pnpm.

**Spec:** `BUILD_PLAN.md` AUDIT-001, `EVENT_MODEL.md`, `DATABASE_SPEC.md`,
`SECURITY_ARCHITECTURE.md`, ADR-004, ADR-010, ADR-012.

## Global Constraints

- Tenant-channel events require trusted `tenantId`; global platform events use
  a separate platform stream and never treat missing tenant as global access.
- Audit loss aborts the business mutation; dispatcher delay does not lose the
  durable outbox row.
- Audit rows are append-only for runtime roles. No raw secrets, bearer tokens,
  credentials, uploaded contents, prompts, or unnecessary personal data enter
  the envelope.
- Correlation is preserved from `@privy360/api-common`; audit does not create
  a duplicate correlation implementation.
- Hash-chain serialization is implemented for stream integrity, but signed
  external anchors and independent WORM verification belong to AUDIT-003.

## Owned audit contract

`AuditContext` carries trusted `tenantId` or explicit platform scope, actor
reference/kind where known, correlation ID, optional causation ID, policy
decision ID, source channel, and deadline. `AuditRecord` carries canonical
action, resource type/id/version, result, occurrence/recording timestamps,
changed field names, before/after digests, stream sequence, previous hash, and
event hash. `DomainEvent` carries the EVENT_MODEL envelope and minimized typed
payload. `AtomicAuditUnitOfWork.run()` couples a business callback with audit,
outbox, and idempotency effects and rolls back all effects on any failure.

## Database boundaries and invariants

- `audit_streams` and `audit_events` are tenant-scoped and require non-null
  tenant attribution; platform counterparts are separate and tenantless.
- Per-stream sequence and previous hash are serialized by locking the stream
  row; event IDs and `(stream_id, sequence)` are unique.
- Runtime role receives INSERT-only audit access and cannot UPDATE/DELETE;
  migration role owns schema changes; RLS is enabled/forced on tenant tables.
- `outbox_events` stores the exact event envelope, schema version, state and
  availability metadata and has one unique event ID.
- `idempotency_records` uniquely binds actor/route/key and request hash,
  rejecting a conflicting retry rather than replaying a different mutation.

## Review Focus

- Missing tenant or correlation attribution is rejected before persistence.
- Prohibited secret/credential/token fields are rejected from audit payloads.
- Duplicate/conflicting idempotency keys cannot create a second effect.
- Injected audit/outbox failure rolls back the business fixture.
- Runtime roles cannot mutate or delete an existing audit row.

## Implementation tasks

### Task 1: Contract tests and failing invariants

**Files:** `tests/unit/audit-001.test.mjs`,
`tests/integration/audit-001-sql.test.mjs`.

- [ ] Add failing tests for envelope validation, tenant/platform scope,
      correlation propagation, payload redaction, append-only behavior,
      idempotency conflicts, and atomic rollback.
- [ ] Add migration contract tests for table/column/constraint/policy/role
      declarations and bounded up/down artifacts.

### Task 2: Audit TypeScript contract and atomic test adapter

**Files:** `packages/audit/src/index.ts`, `packages/audit/package.json`,
`packages/audit/tsconfig.json`.

- [ ] Implement typed validators and an in-memory transactional adapter used
      only to prove the contract’s rollback/idempotency behavior; it must not be
      presented as production persistence.
- [ ] Expose interfaces downstream producers can implement without depending
      on SQL table details.

### Task 3: Reviewed SQL migration

**Files:** `packages/database/migrations/0002_audit_foundation.up.sql`,
`packages/database/migrations/0002_audit_foundation.down.sql`.

- [ ] Create tenant/platform stream and event tables, outbox and idempotency
      records, stream locking/hash-chain trigger/function, append-only runtime
      grants, tenant RLS policies, and migration ledger entry.
- [ ] Ensure the migration references tenant identity only through trusted
      UUID columns and does not create TENANT-001/TENANT-002 behavior.
- [ ] Provide bounded rollback that removes only AUDIT-001 objects.

### Task 4: Documentation and verification

- [ ] Document AUDIT-001 ownership and the handoff to AUDIT-002/AUDIT-003 in
      `packages/audit/README.md` and `packages/database/README.md` only if the
      baseline files remain placeholders.
- [ ] Run frozen install, format, lint, strict typecheck, focused unit and
      migration contract tests, build, structure, relevant security/static checks,
      secret scan, and `git diff --check`.
- [ ] Classify A/B/C/D findings and commit only the finite AUDIT-001 scope.

## Explicit exclusions

No dispatcher, inbox receipts, dead-letter/replay, signed anchors/WORM
verification, audit query API/UI, identity implementation, tenant context
implementation, authorization registry, regulatory corpus, compliance graph,
business producer endpoints, or production security approval.
