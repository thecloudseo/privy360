# AUDIT-004 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or the explicitly selected native execution workflow) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a tenant-scoped, bounded audit-event read contract and an accessible staff audit-trail surface over the AUDIT-001/002/003 primitives.

**Architecture:** `packages/audit` owns the framework-neutral query contract, allowlisted filters, trusted-context authorization boundary, redacted projection, and metadata-only integrity status. `packages/ui` owns the staff audit-trail model/renderer and locale messages; `apps/web` exposes the thin staff-surface adapter. No persistence, integrity, identity, or authorization architecture is redesigned, and no live Nest/Next controller is invented while those app packages remain shells.

**Tech Stack:** TypeScript strict mode, Node built-in test runner, existing `@privy360/api-common` pagination/error contracts, framework-neutral accessible HTML renderer, pnpm.

**Spec:** `BUILD_PLAN.md` AUDIT-004, `API_ARCHITECTURE.md`, `RBAC_ABAC.md`, `EVENT_MODEL.md`, `DATABASE_SPEC.md`, `SECURITY_ARCHITECTURE.md`, `FOUNDATION-005`, `FOUNDATION-006`, AUDIT-001/002/003 contracts, ADR-010, ADR-012, ADR-015.

## Global Constraints

- Resolve tenant scope only from trusted server-side context; reject caller-supplied tenant/actor/ownership/policy fields and never use UI filters as authorization.
- Default-deny: only an explicitly authorized scoped Auditor or DPO may read audit events; unknown permission, missing context, scope mismatch, or policy failure denies.
- Apply authorization and field projection before pagination/counting; use only bounded allowlisted filters and opaque cursor semantics.
- Return no raw payload, before/after values, secrets, tokens, prompts, uploaded content, unnecessary personal data, signing secrets, or inappropriate integrity internals.
- GET is read-only except for the existing access-audit contract; historical audit rows and anchors are never mutated by this ticket.
- Preserve English/Hindi locale infrastructure, visible keyboard focus, semantic landmarks, reduced-motion behavior, and non-disclosing error/correlation conventions.
- Do not modify IDENTITY-002 or REGULATORY-004, implement AUDIT-005, or introduce unrelated dashboards/exports.

## Review Focus

- Cross-tenant and platform-scope confusion must be rejected before repository access, pagination, or counts.
- Unsupported and malformed filters must fail with safe field errors rather than becoming SQL/predicate expressions.
- Cursor/filter/tenant binding must prevent replaying a cursor under a different scope or filter.
- Redaction must remove payloads and sensitive fields while retaining useful actor/action/resource chronology.
- Empty, loading, API-error, and Hindi states must remain understandable and keyboard/screen-reader accessible.

## Implementation Tasks

### Task 1: Freeze API and UI contract tests

**Files:** Create `tests/unit/audit-004.test.mjs`; create `tests/unit/audit-004-ui.test.mjs`; create `tests/integration/audit-004-api.test.mjs`.

**Interfaces:** Tests define `TrustedAuditReadContext`, `AuditEventReader`, `AuditEventQuery`, `AuditEventPage`, `AuditTrailModel`, and the metadata-only integrity projection. Cover authorized/unauthorized roles, tenant isolation, allowlisted filters, pagination limits/cursor binding, safe errors, read-only behavior, redaction, empty/error states, and accessibility/i18n output.

- [ ] Write focused failing tests before implementation.
- [ ] Run the focused tests and confirm failures are caused by missing AUDIT-004 contracts.
- [ ] Add regression assertions for AUDIT-001/002/003 immutability and scope contracts where the read layer consumes them.

### Task 2: Implement scoped audit query contract

**Files:** Create `packages/audit/src/query.ts`; modify `packages/audit/package.json` exports if needed.

**Interfaces:** Export `TrustedAuditReadContext`, `AuditEventQuery`, `AuditEventSummary`, `AuditEventPage`, `AuditEventReader`, `queryAuditEvents(reader, context, input)`, and `createAuditIntegritySummary`.

- [ ] Validate trusted context, explicit permission (`audit.events.read`), tenant/platform scope, bounded limit 1..100, opaque cursor length, and allowlisted filters (`action`, `resourceType`, `result`, `actorKind`, `occurredFrom`, `occurredTo`, `streamId`). Reject caller tenant/actor/policy fields and unsupported sort/predicate fields.
- [ ] Bind cursors to tenant/scope/filter digest and reject mismatches; authorize and redact before invoking the reader or computing counts.
- [ ] Project only safe metadata: event ID, sequence, actor kind/pseudonymous reference, action, resource type/id, result, timestamps, correlation/causation IDs, policy decision ID where permitted, changed field names, digests, and safe integrity status. Exclude payload/before/after values and raw signatures.
- [ ] Return `ApiErrorResponse`-compatible non-disclosing errors with safe correlation IDs; never expose repository/SQL/provider errors.
- [ ] Keep the reader interface read-only and document that database/RLS remains the second enforcement layer.

### Task 3: Build the staff audit-trail surface

**Files:** Modify `packages/ui/src/index.ts`; create `packages/ui/src/audit-trail.ts`; modify `apps/web/src/shell.ts` with a thin adapter; create/update `tests/unit/audit-004-ui.test.mjs`.

**Design direction:** An evidence-room interface: the existing cool slate canvas becomes a quiet ledger surface, with a single teal scope rail, restrained amber integrity indicator, chronological rows, and a compact filter bar. The memorable element is the event timeline spine; cards, gradients, decorative metrics, and unrelated dashboard chrome are excluded.

**Interfaces:** Export locale keys for audit title, scope, filters, event labels, loading, empty, error, and integrity copy; export `createAuditTrailModel(input)` and `renderAuditTrail(model)` with explicit `loading | ready | empty | error` states.

- [ ] Implement semantic heading/navigation/main structure, skip-link compatibility, labelled filter controls, status/live regions, keyboard-focusable event rows, and a reduced-motion-safe timeline renderer.
- [ ] Render actor/action/resource/result/sequence/time and tenant/context scope from the redacted API projection only; do not make filter visibility an authorization decision.
- [ ] Add pagination controls with disabled boundaries and accessible labels; preserve filter state in the model without client-side authorization assumptions.
- [ ] Add English/Hindi catalogs with English fallback and no hard-coded business strings in the renderer.
- [ ] Use existing `designTokens`, focus colors, typography, and shell conventions; keep the surface responsive and readable at narrow widths.

### Task 4: Verify adversarial boundaries and handoff

- [ ] Run frozen install, format, lint, strict typecheck, build, AUDIT-001/002/003 regressions, AUDIT-004 API/UI tests, tenant/security tests, full unit/security suite, structure, production boundary, applicable static security tools, changed-source secret scan, and `git diff --check`.
- [ ] Review for no migration changes, no historical mutation, no IDENTITY-002/REGULATORY-004 edits, no raw payload exposure, and no UI-only authorization.
- [ ] Classify findings A/B/C/D, record unavailable live/static evidence, stage only AUDIT-004 files, and commit `feat(audit): add scoped audit trail`.

## Acceptance Criteria

- Authorized scoped Auditor/DPO reads receive bounded, tenant-filtered, redacted audit summaries with safe pagination.
- Cross-tenant, platform/tenant, malformed/unsupported filter, cursor mismatch, unauthorized, and repository failure cases fail closed without disclosure.
- No read endpoint or UI action mutates audit history or exposes payloads/signing secrets/raw integrity internals.
- Staff audit trail presents chronology, actor/action/resource, scope, result, and integrity status with accessible English/Hindi-compatible states.
- AUDIT-001/002/003 behavior remains green and no AUDIT-005/downstream functionality is added.
