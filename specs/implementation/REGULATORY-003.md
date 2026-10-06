# REGULATORY-003 Implementation Plan

**Goal:** Implement the fail-closed, audited mechanics for reviewing and publishing a complete regulatory bundle while keeping real legal publication blocked by OPEN-01/CP3.

**Architecture:** Extend the existing `@privy360/regulatory` package with a pure state-transition/publication service that consumes the REGULATORY-001/002 bundle and the AUDIT-001/002 atomic unit-of-work contracts. Persist only global corpus publication state in a bounded migration; perform review, approval, supersession, audit, and `RegulationChanged` enqueueing in one caller-owned transaction. No controller, legal corpus, authorization provider, or AUDIT-003 functionality is introduced.

**Tech Stack:** TypeScript 5.9, Node test runner, pnpm workspace, PostgreSQL SQL migrations, existing `@privy360/audit` contracts.

**Spec:** `BUILD_PLAN.md` REGULATORY-003, `REGULATORY_INGESTION_SPEC.md`, `specs/implementation/REGULATORY-001.md`, `specs/implementation/REGULATORY-002.md`, `specs/implementation/AUDIT-002.md`, `ROADMAP.md`, and OPEN-01 in `ROADMAP.md`.

## Global Constraints

- Publication is global-corpus scoped and never tenant-owned.
- A distinct Legal publisher approval is required; maker/self-publication fails closed.
- Incomplete source sets, missing provenance/citations/effective intervals/reviewer attribution, and non-reviewed content cannot publish.
- Synthetic fixtures use non-legal classification and cannot become authoritative legal corpus content.
- Published/versioned content is immutable; supersession creates a new version and preserves old queryability.
- Review/publication mechanics do not resolve OPEN-01, CP3, or authorize actual legal publication.
- Consume existing audit contracts; do not implement AUDIT-003 or a second audit subsystem.

## Review Focus

- Self-review or missing Legal publisher attribution must be denied and leave no audit/event side effects.
- A partial bundle or manifest/version mismatch must remain unpublished.
- Concurrent/repeated publication must be idempotent or fail closed without mutating published history.
- A published version must reject update/delete and remain queryable after supersession.
- `RegulationChanged` must carry only minimized non-sensitive global-corpus references and preserve correlation/causation context.

### Task 1: Freeze publication state contracts with tests

**Files:**

- Modify: `packages/regulatory/src/index.ts`
- Create: `packages/regulatory/src/publication.ts`
- Test: `tests/unit/regulatory-003.test.mjs`

**Interfaces:**

- Consumes: `Bundle`, `validateBundle`, `ReviewState`, `AtomicAuditUnitOfWork`, `AuditContext`.
- Produces: explicit transition validator and `publishRegulatoryBundle` service accepting trusted Legal-publisher approval, current bundle, and transaction-scoped persistence callbacks.

- [ ] Write failing tests for allowed `DRAFT→REVIEWED`, `REVIEWED→PUBLISHED`, and published supersession; reject skips, self-review, incomplete bundles, synthetic authoritative promotion, and repeated publication.
- [ ] Run the focused test and verify expected failures are due to missing publication behavior.
- [ ] Implement the smallest typed state-transition and publication contract; require `GLOBAL_CORPUS`, UUID actor/policy attribution, distinct maker/reviewer/publisher identities, and complete validated provenance/citation/effective interval data.
- [ ] Run focused tests and the REGULATORY-001/002 and audit contract tests.

### Task 2: Add atomic publication persistence boundary and migration

**Files:**

- Create: `packages/database/migrations/0009_regulatory_publication.up.sql`
- Create: `packages/database/migrations/0009_regulatory_publication.down.sql`
- Test: `tests/integration/regulatory-003-sql.test.mjs`

**Interfaces:**

- Consumes: existing `regulatory.publication_manifests`, version tables, and audit migration conventions.
- Produces: global review records/publication state constraints, immutable published guards, and bounded rollback for the service persistence adapter.

- [ ] Write migration contract tests for global scope, review attribution, publication state constraints, supersession linkage, uniqueness, immutable published rows, and rollback.
- [ ] Run them red before adding the migration.
- [ ] Implement only the REGULATORY-003-owned tables/constraints/triggers; do not alter AUDIT-003 or unrelated module schemas.
- [ ] Run migration tests and live PostgreSQL validation when the approved local service runtime is available.

### Task 3: Integrate audit/event mechanics and verify the gate boundary

**Files:**

- Modify: `packages/regulatory/src/publication.ts`
- Test: `tests/unit/regulatory-003.test.mjs`
- Modify: `tests/regulatory/README.md` if evidence documentation is needed

**Interfaces:**

- Consumes: `AuditTransaction.recordAudit`, `enqueue`, `claimIdempotency`, and AUDIT-002 delivery semantics.
- Produces: `REGULATORY_REVIEWED`, `REGULATORY_PUBLISHED`, and `REGULATION_CHANGED` audit/event records with minimized bundle/version references and no legal-content assertion.

- [ ] Add failing tests for rollback, audit attribution, idempotency, event payload minimization, and preservation of correlation/causation.
- [ ] Implement one atomic transaction boundary for persistence plus audit/outbox records; do not add delivery/replay/integrity behavior.
- [ ] Run focused, regression, audit contract, migration, and full repository verification commands.
- [ ] Review the diff, classify A/B/C/D findings, and commit as `feat(regulatory): implement reviewed publication workflow` without merging or downstream work.

## Acceptance Evidence

REGULATORY-003 acceptance is evaluated separately from CP3 and OPEN-01. Passing mechanics tests means the implementation boundary is complete; it does not mean legal content is authoritative, CP3 is reached, or actual publication is permitted.
