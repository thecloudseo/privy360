# ATOMIC-001 Implementation Plan

## Objective

Implement the first durable Compliance Evidence Graph bridge from reviewed regulatory requirement versions to reusable atomic controls and tenant-owned obligation/control state. Preserve the distinction between legal source material, regulatory versions, obligations, controls, implementation guidance, evidence requirements, and organizational state. Provide a fail-closed traceability validator and the `ControlValidationFailed` contract without implementing later applicability, assessment, evidence-storage, reporting, or audit-delivery workflows.

## Authority and contracts consumed

- `AGENTS.md`, `BUILD_PLAN.md` ATOMIC-001 card, W3 entry in `EXECUTION_ROADMAP.md`.
- `DOMAIN_MODEL.md`, `DATABASE_SPEC.md`, `ARCHITECTURE.md`, `MODULE_BOUNDARIES.md`, `EVENT_MODEL.md`, `RBAC_ABAC.md`.
- `packages/regulatory` REGULATORY-001/002 contracts: stable requirement IDs/codes, immutable requirement versions, classification, effective interval, source citations, review/publication state, and no fabricated legal corpus.
- TENANT-002 trusted tenant transaction/context boundary.
- AUDIT-001 atomic audit/outbox port only where needed for the validation-failure event; AUDIT-003 and durable delivery remain out of scope.

## Domain model and ownership

Global/regulatory definitions remain immutable and non-tenant-mutable: `control_templates` are reusable taxonomy definitions and guidance; requirement/version/source references remain owned by Regulatory. Compliance owns tenant `controls`, `obligations`, `control_mappings`, `obligation_controls`, and `evidence_requirements`. A control can reference a shared template and a published requirement version, but tenant control content is explicitly classified as `IMPLEMENTATION_CONTROL` or `GOOD_PRACTICE` unless legal provenance is present. An obligation materializes a reviewed applicable requirement for a tenant scope; ATOMIC-001 stores the required linkage but does not implement applicability decisions.

The validator requires, for a legal control ready for approval, a published requirement version, source citation, effective interval, approved applicability-rule reference, and at least one evidence requirement. It must reject missing or mismatched provenance, tenant-crossing references, unsupported taxonomy families, and invalid temporal relationships without disclosing sensitive details.

## Planned changes

1. Add compliance domain types and pure validation ports under `packages/domain/compliance`, using stable IDs, explicit classifications, taxonomy families from `DOMAIN_MODEL.md`, immutable approved definitions, and typed validation errors.
2. Add the `ControlValidationFailed` event schema/registration under `packages/contracts/events` if the existing contract layout supports it; payload contains IDs, revisions, failure codes, correlation/provenance digests, and no source text, personal data, credentials, or uploaded contents.
3. Add migration `0008_atomic_controls.up.sql` and bounded down migration. Create the compliance-owned global/tenant tables and constraints from `DATABASE_SPEC.md`: `control_templates`, `controls`, `control_mappings`, `obligations`, `obligation_controls`, and `evidence_requirements`, including typed classifications, stable codes, immutable-approved checks, source/version FKs, tenant-scoped composite FKs, uniqueness, interval checks, and indexes. Do not duplicate the regulatory `requirement_controls` edge as a second store.
4. Add focused unit tests first for taxonomy support, legal-vs-guidance separation, traceability completeness, temporal/version checks, tenant-boundary rejection, and event payload minimisation. Add migration structure/rollback tests and relevant tenant/regulatory regressions. No downstream workflow tests are introduced.
5. Add only contract schemas/ports needed for the scoped create/validate boundary; no arbitrary status patch API, no later applicability command, and no control-assessment implementation.

## Authorization, tenancy, audit, and privacy

- Shared templates and regulatory mappings are platform/global and cannot be mutated through tenant context.
- Tenant control and obligation mutations require trusted server-side tenant context, Compliance draft scope, and explicit Legal review for legal mappings; client-supplied tenant IDs are never authorization.
- Cross-tenant references fail closed through composite foreign keys and application validation.
- A validation failure emits `ControlValidationFailed` atomically with the owning transaction where the AUDIT-001 port is available; no audit bypass or direct delivery implementation is added.
- Store provenance references/digests and minimal actor/resource context; never copy legal source text, personal data, secrets, or evidence contents into events or logs.

## Acceptance criteria

- All repository-defined taxonomy families are representable and validated.
- Legal/control/good-practice classifications remain explicit and cannot be silently promoted.
- Missing requirement, source citation, effective interval, applicability reference, or evidence requirement fails validation.
- Regulatory provenance is versioned and points to approved/published requirement data; no invented DPDP obligations or seed corpus is added.
- Global definitions cannot be tenant-mutated; tenant state is explicitly tenant-owned and cross-tenant access is denied.
- Migrations, rollback, indexes, constraints, and structure tests are bounded to ATOMIC-001.
- `ControlValidationFailed` is typed, minimal, deduplicable, and compatible with the event model.
- Focused, regulatory, tenant, migration, full unit/security, build, structure, production-boundary, static/security, secret-scan, and `git diff --check` gates are run and reported honestly.

## Verification and known boundaries

Run frozen install, format, lint, strict typecheck, ATOMIC-001 tests, regulatory regressions, relevant tenant regressions, migration/schema tests, live PostgreSQL tests when the approved scoped runtime is available, full unit/security suite, build, structure/production-boundary checks, relevant static/security checks, secret scan, and `git diff --check`. Classify findings A correctness, B security/regulatory-integrity blocker, C follow-up/tooling, or D backlog. Do not merge, push, or begin ATOMIC-002, REGULATORY-003, AUDIT-003, IDENTITY-001, or downstream inventory/risk/reporting work.
