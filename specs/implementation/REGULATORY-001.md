# REGULATORY-001 Implementation Plan

## Objective and boundary

Establish the immutable, global regulatory-corpus foundation and a pure bundle validator. The foundation preserves source provenance, stable identifiers, version history, classifications, citations, effective intervals, and a future publication-manifest boundary without importing, reviewing, publishing, or asserting any legal content.

Authority: `AGENTS.md`, the REGULATORY-001 card in `BUILD_PLAN.md`, its W2 roadmap entry, `DATABASE_SPEC.md`, `EVENT_MODEL.md`, and the approved regulatory architecture/ADR set.

## Owned contracts

- Global corpus entities: sources, regulations, regulation versions, provisions, provision versions, requirements, requirement versions, aliases, applicability-rule definitions, source citations, and publication manifests.
- Stable external identifiers are opaque strings/codes; database integer identity is never a legal identifier.
- Source provenance includes issuer, canonical URI, retrieval time, checksum, and verification state. Source rows are immutable byte versions.
- Version rows are immutable, revision-unique, and use explicit ISO dates/timestamps with `effective_from < effective_to` when an end exists.
- Requirement classifications remain distinct: `LEGAL_REQUIREMENT`, `IMPLEMENTATION_CONTROL`, and `GOOD_PRACTICE`. Legal requirements require a source citation; aliases are not law.
- The validator checks structural completeness and referential integrity only. It does not decide legal authority, applicability, or publication eligibility.

## Database and API boundaries

The migration is global (`regulatory` schema), has no tenant ownership, and creates database constraints for uniqueness, dates, enums, references, and published-version immutability. Runtime publication and tenant read authorization are later boundaries. The package exports contract types and deterministic validation functions; no public legal-claim API is implemented.

## Invariants and security

- Missing or malformed provenance, checksum, citation, reviewer, version, or effective interval fails closed.
- Illustrative sources cannot be represented as authoritative verified corpus sources.
- No raw personal data, credentials, source-body content, or AI output is required by the contract.
- Historical versions cannot be updated/deleted after publication; this ticket defines the database guard, not publication workflow.
- Future global corpus events use the platform channel; no tenant context is fabricated.

## Tests and migration strategy

TDD starts with unit contract tests for malformed records, duplicate IDs, missing citations, date ordering, classification separation, reviewer requirements, and illustrative-source rejection. Migration contract tests verify the required tables, constraints, global schema boundary, and up/down pairing. A real PostgreSQL integration test is conditional on repository infrastructure; no production schema is touched.

## Downstream consumers

REGULATORY-002 consumes the source/manifest boundary for quarantined import; ATOMIC-001 consumes immutable requirement/version identifiers; NOTICES-001 consumes requirement/source citations. These consumers must not depend on internal validator or SQL implementation details.

## Explicit exclusions

No corpus fetch/import/quarantine, review UI or command, publication/supersession workflow, legal seed data, source-text corpus, audit/outbox implementation, `RegulationChanged` event emission, tenant/RLS implementation, public regulatory API, or REGULATORY-002/003 work is included. Human legal decisions about authoritative Indian corpus content and classification remain unresolved by design.
