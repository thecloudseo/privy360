# REGULATORY-004 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the published global regulatory corpus through bounded read contracts and a polished, accessible staff regulatory-library surface without creating legal content or publication authority.

**Architecture:** `packages/regulatory` owns the published read model and immutable DTO projections. `apps/api/src/regulatory.ts` provides framework-neutral GET handlers using FOUNDATION-005 error, correlation, pagination, and default-deny contracts; the caller supplies trusted authorization and a read-only published-corpus port. `apps/web/src/regulatory.ts` renders the read model into an accessible enterprise library/detail HTML surface; it contains no authorization or database access.

**Tech Stack:** TypeScript 5.9, Node test runner, existing `@privy360/api-common`, `@privy360/ui`, and `@privy360/regulatory` packages.

**Spec:** `BUILD_PLAN.md` REGULATORY-004, `EXECUTION_ROADMAP.md`, `API_ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `DATABASE_SPEC.md`, `REGULATORY_INGESTION_SPEC.md`, `specs/implementation/REGULATORY-001.md`, `specs/implementation/REGULATORY-002.md`, `specs/implementation/REGULATORY-003.md`, `specs/implementation/FOUNDATION-005.md`, `specs/implementation/FOUNDATION-006.md`, ADR-013, ADR-016, and OPEN-01 in `ROADMAP.md`.

## Global Constraints

- Only `PUBLISHED` global-corpus versions/manifests are returned; quarantined, draft, reviewed-only, superseded, and retired content is hidden from the published read port.
- The read surface never mutates, publishes, approves, or infers legal authority.
- Synthetic fixtures remain visibly `SYNTHETIC`/non-authoritative and cannot be presented as approved DPDP law.
- Regulation, source, version, provision, requirement, classification, provenance, citation, effective interval, and publication state remain distinct fields.
- Pagination is bounded through FOUNDATION-005; invalid IDs and filters fail closed with non-disclosing correlated errors.
- Read authorization is supplied by trusted server context and defaults to deny; UI visibility is not authorization.
- English/Hindi locale infrastructure, semantic landmarks, focus behavior, and reduced-motion tokens come from FOUNDATION-006.

## Review Focus

- A quarantined/draft/superseded record must never appear even when its identifier is requested.
- A synthetic record must retain its non-authoritative classification and visible fixture label.
- Invalid regulation/version/requirement IDs and malformed pagination must return safe correlated errors.
- Effective-date/version filtering must select immutable versions deterministically without flattening provenance.
- Empty, error, and long-list states must remain navigable by keyboard and understandable to screen readers in both locales.

## Design plan

- Palette: the foundation’s ink/teal/focus-gold tokens, with a restrained paper-white surface and a quiet slate canvas; status uses semantic colors only.
- Type: the existing Inter/system family for dense operational reading, with weight and spacing contrast for hierarchy rather than decorative display typography.
- Layout: a two-column reading room—persistent regulation/version rail on the left, provenance-led detail pane on the right—with a compact metadata strip and citation panel; mobile collapses the rail above content.
- Principles: legal traceability is the visual anchor; every assertion carries state, effective date, source and classification; one teal “active publication” signal is the memorable product cue; no generic dashboard tiles or fake metrics.

### Task 1: Freeze published read model and DTO projections

**Files:**

- Modify: `packages/regulatory/src/index.ts`
- Create: `packages/regulatory/src/library.ts`
- Test: `tests/unit/regulatory-004-library.test.mjs`

**Interfaces:**

- Consumes: REGULATORY-001/002/003 `Bundle`, `ReviewState`, source/citation/provenance fields.
- Produces: `PublishedCorpus`, `PublishedRegulationDto`, `PublishedProvisionDto`, `PublishedRequirementDto`, stable filtering/version-selection functions, and explicit synthetic classification.

- [ ] Write failing tests for published-only projection, hidden states, invalid IDs, deterministic effective-date selection, classification preservation, citation/source projection, and read-only DTOs.
- [ ] Run the focused test and verify it fails for missing library contracts.
- [ ] Implement pure projections over supplied records; reject incomplete references and never manufacture legal text or authority.
- [ ] Run focused library tests and REGULATORY-001/002/003 regressions.

### Task 2: Implement bounded read API contracts

**Files:**

- Create: `apps/api/src/regulatory.ts`
- Create: `tests/unit/regulatory-004-api.test.mjs`
- Create: `specs/api/regulatory-library.openapi.json`

**Interfaces:**

- Consumes: `@privy360/api-common` correlation/errors/pagination/default-deny permission check and `PublishedCorpus` read port.
- Produces: handlers for `GET /regulations`, `GET /regulations/:id`, `GET /provisions/:id`, and `GET /requirements/:id/versions` with safe DTOs and a `RegulatoryLibraryViewed` audit callback.

- [ ] Write failing API tests for authorization denial, pagination/filtering, unpublished leakage, invalid IDs, version selection, non-disclosing errors, read-only behavior, correlation IDs, and audit metadata.
- [ ] Run them red.
- [ ] Implement allowlisted GET handlers only; apply explicit `REGULATORY_LIBRARY_READ` permission, published-only filtering, bounded pagination, and audit callback without exposing raw source bodies or internal errors.
- [ ] Add OpenAPI paths/schemas and run API tests plus schema-shape checks.

### Task 3: Build the accessible regulatory library surface

**Files:**

- Create: `apps/web/src/regulatory.ts`
- Create: `tests/unit/regulatory-004-ui.test.mjs`
- Modify: `packages/ui/src/index.ts` only if a shared locale/token primitive is required

**Interfaces:**

- Consumes: published library DTOs and FOUNDATION-006 locale/tokens.
- Produces: `createRegulatoryLibraryModel`, `renderRegulatoryLibrary`, loading/empty/error states, regulation/version navigation, provenance/citation detail, and Hindi-compatible labels.

- [ ] Write failing UI tests for hierarchy/detail rendering, state/classification/effective-date/citation visibility, empty/error/loading states, keyboard landmarks, focus target, and English/Hindi labels.
- [ ] Run them red.
- [ ] Implement the two-pane “regulatory reading room” with semantic navigation/main/aside regions, visible focus, responsive collapse, and no mutation controls.
- [ ] Run UI tests and inspect the rendered HTML for leakage and accessibility regressions.

### Task 4: Verification and handoff

- [ ] Run frozen install, format, lint, strict typecheck, build, focused API/UI/library tests, REGULATORY-001/002/003 and audit/security regressions, full unit/security suite, structure, production boundary, available static/secret scans, and `git diff --check`.
- [ ] Review shared package/API/UI collision risks; do not implement IDENTITY-002, AUDIT-004, REGULATORY-005, or legal corpus work.
- [ ] Stage only REGULATORY-004 files, inspect the staged diff, and commit `feat(regulatory): add regulatory library` without merging.

## Acceptance Evidence

REGULATORY-004 completion means the published read mechanics and library surface pass their implementation tests. It does not mean CP3 is reached, OPEN-01 is resolved, or any real DPDP corpus is authoritative.
