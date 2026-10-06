# REGULATORY-002 Implementation Plan

## Objective and dependencies

Implement offline manifest import into a quarantined draft corpus. The exact ticket depends on REGULATORY-001 and AUDIT-001. CP0 companion A04a freezes the boundary: intake is a platform-scoped audited transaction and imported material is not publicly visible before review. AUDIT-002, REGULATORY-003, and legal publication are out of scope.

## Contracts consumed

- `@privy360/regulatory`: `Bundle`, `validateBundle`, source checksum/provenance, stable version IDs, and draft/publication state semantics.
- `@privy360/audit`: `AuditContext`, `AtomicAuditUnitOfWork`, idempotency claims, minimized `AuditRecord`, and `DomainEvent` validation. The caller supplies trusted platform actor/correlation/policy context; this lane does not create authorization or a second audit subsystem.

## Owned intake contract

`importRegulatoryManifest` accepts a validated bundle, exact manifest bytes, trusted global-source-editor authorization evidence, and an audit unit of work. It verifies the manifest SHA-256 digest, validates the bundle, rejects authoritative claims from illustrative sources, and returns a quarantine receipt. It is idempotent for the same manifest digest and rejects a conflicting retry. It emits `RegulatorySourceImported` only inside the same audit unit of work; failures emit `CorpusValidationFailed` as a failed audit record and do not publish data.

## State, provenance, and review boundary

Imported sources remain `UNVERIFIED` or explicitly quarantined, and manifests remain `DRAFT`/`QUARANTINED`. Intake never sets `VERIFIED`, `REVIEWED`, or `PUBLISHED`, never supplies a reviewer, and never exposes a public read route. Source URI is metadata only: no URL fetch, redirect, SSRF-capable network access, or AI/legal interpretation is performed.

## Database and transaction boundary

Migration `0005_regulatory_intake` adds a global intake receipt table with manifest digest uniqueness, quarantine state, trusted actor/correlation references, and no raw source bytes. It references the existing global `publication_manifests` table and is bounded to the regulatory schema. Application persistence must insert the receipt and draft corpus rows in the same database transaction represented by the audit unit-of-work; this ticket supplies the port, not a database adapter.

## Tests

TDD covers incomplete bundles, malformed provenance, tampered manifest bytes, duplicate/idempotent and conflicting retries, missing/invalid attribution, illustrative-authoritative content, no publication state escalation, audit event payload minimisation, and rollback on audit failure. Migration contract tests verify the new global table, unique digest, quarantine-only state, and bounded rollback. Existing REGULATORY-001 and AUDIT-001 tests remain regression gates.

## Explicit exclusions

No arbitrary URL fetch, public/API controller, reviewer UI, legal approval, source publication, supersession, `RegulationChanged`, AUDIT-002 dispatcher/inbox/replay, tenant/RLS behavior, identity/authorization implementation, raw corpus storage, or REGULATORY-003 work.
