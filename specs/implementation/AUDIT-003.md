# AUDIT-003 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or the explicitly selected native execution workflow) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the bounded AUDIT-003 signed-anchor exporter and verifier over the existing audit hash chains, with a key-provider port, durable anchor metadata, and metadata-only integrity status.

**Architecture:** `packages/audit` owns the portable anchor/key-provider contract, canonical anchor bytes, exporter, verifier, and fail-closed result types. `packages/database` owns migration `0006_audit_integrity` for tenant and platform anchor metadata, append-only/runtime write boundaries, RLS, and bounded rollback. The implementation records provider key/signature references rather than private material and does not claim WORM storage, non-repudiation, or tamper-proofness; separately administered external retention-locked storage remains an integration boundary.

**Tech Stack:** TypeScript strict mode, Node built-in test runner, PostgreSQL reviewed SQL migrations, pnpm.

**Spec:** `BUILD_PLAN.md` AUDIT-003, `EVENT_MODEL.md`, `DATABASE_SPEC.md`, `SECURITY_ARCHITECTURE.md`, `RBAC_ABAC.md`, `API_ARCHITECTURE.md`, ADR-012, ADR-015, AUDIT-001 and AUDIT-002 plans/contracts.

## Global Constraints

- Preserve separate tenant and `GLOBAL_CORPUS` platform streams; a tenant anchor cannot be verified as platform scope and missing tenant attribution is not global access.
- Consume the existing canonical hash-chain serialization and stream sequence; do not redesign AUDIT-001 or AUDIT-002 contracts.
- Signing uses a provider-supported asymmetric key through a port; private keys never enter source, database, logs, events, or test fixtures.
- Provider absence, invalid metadata, scope mismatch, sequence gaps, hash mismatch, and signature failure fail closed and produce safe verification evidence.
- Audit anchor write intent/outcome is represented with minimized `AuditAnchorWritten` / `VerificationFailed` semantics without recursive anchor creation or sensitive payloads.
- This ticket does not implement WORM storage, external retention enforcement, key administration/rotation policy, audit query UI, identity, AUTHZ-003, REGULATORY-003, ATOMIC-001, or downstream tickets.

## Review Focus

- Canonicalization drift: identical anchor input must produce identical signed bytes and digest.
- Tenant/platform confusion: verification rejects a tenant anchor supplied for the platform stream and vice versa.
- Partial intervals and gaps: exporter/verifier rejects non-contiguous sequence ranges and wrong start/previous hash.
- Key/provider failures: no anchor is admitted when the signing provider is missing, returns malformed metadata, or verification is unavailable.
- Storage tampering: changing a stored signature, digest, key reference, or anchor range must be detectable without disclosing audit payloads.

## Implementation Tasks

### Task 1: Freeze failing contract and adversarial tests

**Files:** Create `tests/unit/audit-003.test.mjs`; create `tests/integration/audit-003-sql.test.mjs`.

**Interfaces:** Tests define the portable `SigningKeyProvider`, `AuditAnchorInput`, exporter result, verifier result, and metadata response used by later tasks. Cover valid tenant/platform anchors, deterministic canonical bytes, tampered chain/range/signature/key metadata, cross-scope confusion, missing provider, prohibited payloads, unauthorized verification/anchor write boundary, and non-disclosure.

- [ ] Write focused failing tests before production implementation.
- [ ] Run the focused tests and confirm failures are caused by missing AUDIT-003 behavior.
- [ ] Add migration contract assertions for `audit_anchors`, platform separation or scope representation, uniqueness, immutability, RLS, runtime grants, migration ledger, and bounded down migration.

### Task 2: Implement portable anchor and key-provider contract

**Files:** Create `packages/audit/src/integrity.ts`; modify `packages/audit/package.json` exports if needed; keep `index.ts` and `delivery.ts` contracts unchanged.

**Interfaces:** Export `SigningKeyProvider` with `sign(keyRef, bytes)` and `verify(keyRef, bytes, signature)`; `AuditAnchorInput` with explicit scope, optional tenant ID, stream ID, contiguous start/end sequences, start previous hash, end hash, canonicalization version, key reference, signature, and provider metadata; `AuditAnchorExporter`; `AuditAnchorVerifier`; typed fail-closed errors/results.

- [ ] Implement strict UUID/scope/range/hash/signature/key-reference validation and recursive prohibited-key checks for any diagnostic metadata.
- [ ] Implement versioned canonical serialization over metadata only, excluding audit payloads and private key material.
- [ ] Implement exporter checks for contiguous interval and supplied chain boundary, then sign through the provider; provider failure returns no admissible anchor.
- [ ] Implement verifier checks for scope, interval, digest, signature, and chain boundary using the provider; invalid input returns `verified: false` with a safe reason code.
- [ ] Add metadata-only integrity status mapping suitable for `GET /audit-integrity`; do not expose event payloads or raw signatures beyond approved metadata.
- [ ] Run focused unit tests, then refactor only while green.

### Task 3: Add reviewed PostgreSQL anchor migration

**Files:** Create `packages/database/migrations/0006_audit_integrity.up.sql`; create `packages/database/migrations/0006_audit_integrity.down.sql`.

**Interfaces:** Persist anchor metadata needed to re-run verification: scope/tenant, stream ID, interval, previous/end hashes, canonicalization version, key reference, signature digest/reference, provider metadata digest, verification state/timestamps, and audit/outbox linkage where supported by existing schema. No raw audit payload or private key.

- [ ] Add tenant-scoped `audit.audit_anchors` with composite stream/tenant integrity and unique stream/end sequence; add a separate platform anchor table or an explicit non-tenant scope matching the existing platform schema without weakening isolation.
- [ ] Add checks/FKs/indexes for sequence ranges, scope/tenant invariants, immutable metadata, and safe provider references; preserve runtime append/write identity separation.
- [ ] Add append-only trigger/grants and FORCE RLS policies that cannot turn absent tenant context into access.
- [ ] Add migration ledger entry and a down migration that removes only AUDIT-003 objects.
- [ ] Extend SQL contract tests and run AUDIT-001/002 SQL regressions.

### Task 4: Add metadata-only integrity adapter and adversarial runtime evidence

**Files:** Modify `packages/audit/src/integrity.ts` or add a focused adapter; create/update `tests/security/audit-003-integrity.test.mjs` only if the repository’s security-test convention requires it.

- [ ] Prove an external-anchor comparison detects a changed chain head/history and reports `VerificationFailed` semantics without claiming the database was made immutable against privileged rewrite.
- [ ] Prove missing/invalid provider metadata blocks anchor admission and leaves no partially persisted anchor in the test transaction model.
- [ ] Prove tenant/platform, replay/idempotency, mutation/deletion, and prohibited-data cases fail closed.
- [ ] Verify the metadata endpoint contract is read-only, scoped, and non-disclosing; no controller or identity implementation is invented if the API package is still a scaffold.

### Task 5: Verification and bounded handoff

- [ ] Run frozen install, format, lint, strict typecheck, AUDIT-001/002 regressions, AUDIT-003 focused and adversarial tests, migration validation, live PostgreSQL tests where the reviewed service/admission is available, full unit/security suite, build, structure, production-boundary checks, relevant Semgrep/static checks, secret scan, and `git diff --check`.
- [ ] Classify findings A/B/C/D; document unavailable live evidence instead of simulating it.
- [ ] Review the staged diff for migration/package collisions and out-of-scope changes.
- [ ] Commit as `feat(audit): complete audit integrity foundation` only after verification evidence is recorded.

## Acceptance Criteria

- A signed anchor can be exported only for a validated contiguous tenant or platform stream interval through the key-provider port.
- Verification detects altered chain history or anchor metadata and fails closed.
- Missing signing provider blocks anchor creation and emits safe failure/alert semantics.
- Anchor metadata is tenant/platform separated, append-only, RLS protected, and rollback-bounded.
- AUDIT-001 and AUDIT-002 contracts/regressions remain green; no later ticket or parallel-boundary implementation is introduced.

## Explicit Non-Claims

This ticket does not prove WORM retention, external storage administration, cryptographic non-repudiation, compromise resistance after key compromise, legal compliance, production security approval, or that Privy360 is secure. It establishes signed anchor evidence and detects mismatches when verified against the configured provider and trusted anchor metadata.
