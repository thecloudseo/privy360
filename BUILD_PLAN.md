# Dependency-ordered engineering build plan

Architecture baseline only; no ticket is implemented in this session. Full product architecture precedes the bid. Every bid ticket produces permanent, production-quality code using the same RLS, authorization, audit, versioning, contracts and review gates as later releases. Release numbers describe enabled breadth, not reduced engineering standards.

## Execution rules

EPIC identifiers preserve MASTER_SPEC §73; scheduling order is the owner's priority, not numeric epic order. Stories group bounded tickets below. Each ticket is independently reviewed and must create its own IMPLEMENTATION_PLAN.md (or scoped specs/implementation/<ticket>.md to avoid parallel overwrites) before code, referencing this baseline and relevant ADRs. Reviewer challenges that plan; Sol implements only after plan review. Human/security production acceptance remains mandatory for AGENTS §40 critical areas. No agent autonomously approves legal material.

Each ticket below explicitly lists dependencies, objective, expected areas, DB/API/auth/audit/security/acceptance/tests. Paths are allowed areas, not an instruction to touch every listed directory; the per-ticket implementation plan names exact files. Every database-changing ticket adds its own migration, migration tests and rollback/forward-fix plan. Every API ticket first adds the matching OpenAPI operation/request/response schemas and examples under packages/contracts and specs/api. Event changes add JSON Schema and compatibility tests. No schema/controller is created by this architecture session.

### Required tests inherited by every ticket

**T0** lint/typecheck and required CI security tools, targeted unit tests and contract/schema validation. **T1** any DB change: migration upgrade/rollback strategy, constraints and actual runtime-role RLS tests. **T2** any API/domain change: positive cases, validation/state conflicts, all denied role/field cases, A actor/B resource GET/POST/PATCH/DELETE/search/filter/export/graph where applicable, audit rollback, idempotency/concurrency. **T3** any worker/external effect: crash/retry/duplicate/revocation/timeout/reconciliation and tenant context. **T4** any UI: intended E2E journey, keyboard/screen reader/contrast, Hindi/English and denied-scope behavior. **T5** security-critical: independent adversarial review against THREAT_MODEL and human/security gate before production acceptance. A test is inapplicable only with a recorded reason, never by silence. Acceptance text per ticket adds targeted checks to these mandatory suites.

### Mandatory security/privacy envelope inherited by every ticket

Trusted tenant context, default deny, typed FK ownership, data minimisation, no real personal data in tests/demo, no secrets/PII in logs, safe error responses, deterministic authorization before side effects, atomic audit for significant mutation, immutable legal/consent/evidence history and approved-source references for any legal assertion. No frontend-only checks. Timers/retention/identity proof/provider policies must not be guessed; OPEN register gates apply. A contract-only or infrastructure ticket must not expose an unsecured temporary business endpoint.

## Priority and release semantics

Execution priority: foundation → tenant security → identity → RBAC/ABAC → audit → regulatory corpus → atomic DPDP control architecture → compliance → inventory → processing graph → Privacy Centre → rights → notices → consent → vendors/processors → risk/DPIA → incidents → retention/deletion → evidence graph → reporting → regulatory intelligence → continuous assurance → AI → government hardening. A phase may have an early permanent baseline and later depth. Basic evidence storage/test links belong to compliance dependencies; advanced evidence traversal follows the graph phase. Backup/security foundation starts early, not at final hardening. Rights/portal contracts are defined before notices/consent implementation, and integrate published notices when available.

Advanced vendor assessment/DPIA/breach notification/retention/deletion are NOT required by the bid. Their complete contracts are already specified. The bid includes permanent basic vendor, risk, incident and report records because MASTER_SPEC §34 requires them. A later-phase integration primitive (CONNECTOR-001) can be implemented when a dependent deletion ticket needs it; continuous assurance adapters remain later. This dependency distinction does not move AI ahead of the graph or weaken foundations.

Bid release is the complete set of tickets marked B below, plus all their dependencies (validated to contain only B tickets). HARDEN-001 is an additional release gate even though REPORT-003 does not depend on it. Legal-labelled DPDP demonstration also requires OPEN-01 approval; without it only a clearly synthetic architecture demonstration is allowed and the legal-labelled bid release remains blocked. No invented 150-control corpus to meet a marketing count.

## Ticket index

This index is a valid topological execution order; priority within ready work follows the phase order above. Detailed cards are grouped by domain for review. Later-release cards are not prerequisites of B cards.

| Ticket | Epic | Story | Release | Depends on |
|---|---|---|---|---|
| [FOUNDATION-001](#foundation-001) | E00 | Repository contract foundation | B | — |
| [FOUNDATION-002](#foundation-002) | E00 | Verification foundation | B | FOUNDATION-001 |
| [FOUNDATION-003](#foundation-003) | E00 | Local portable services | B | FOUNDATION-002 |
| [FOUNDATION-004](#foundation-004) | E00 | Security infrastructure | B | FOUNDATION-003 |
| [FOUNDATION-005](#foundation-005) | E00 | API contract foundation | B | FOUNDATION-004 |
| [FOUNDATION-006](#foundation-006) | E00 | Design foundation | B | FOUNDATION-005 |
| [TENANT-001](#tenant-001) | E02 | Tenant data foundation | B | FOUNDATION-005 |
| [TENANT-002](#tenant-002) | E02 | Trusted transaction context | B | TENANT-001 |
| [TENANT-003](#tenant-003) | E02 | Cross-surface context | B | TENANT-002 |
| [IDENTITY-001](#identity-001) | E01 | Staff authentication | B | TENANT-003,FOUNDATION-003 |
| [IDENTITY-002](#identity-002) | E01 | Tenant membership selection | B | IDENTITY-001 |
| [IDENTITY-003](#identity-003) | E01 | Principal identity | B | IDENTITY-002 |
| [IDENTITY-004](#identity-004) | E01 | Enterprise federation | P | IDENTITY-002 |
| [AUTHZ-001](#authz-001) | E01 | Permission foundation | B | IDENTITY-003 |
| [AUTHZ-002](#authz-002) | E01 | Grant administration | B | AUTHZ-001 |
| [AUTHZ-003](#authz-003) | E01 | Service and worker authorization | B | AUTHZ-002 |
| [AUTHZ-004](#authz-004) | E01 | Support governance | P | AUTHZ-003 |
| [AUDIT-001](#audit-001) | E17 | Atomic audit foundation | B | AUTHZ-003 |
| [AUDIT-002](#audit-002) | E17 | Durable delivery | B | AUDIT-001 |
| [AUDIT-003](#audit-003) | E17 | Audit integrity | B | AUDIT-002 |
| [AUDIT-004](#audit-004) | E17 | Audit inspection | B | AUDIT-003 |
| [REGULATORY-001](#regulatory-001) | E03 | Corpus foundation | B | AUDIT-004 |
| [REGULATORY-002](#regulatory-002) | E03 | Corpus intake | B | REGULATORY-001 |
| [REGULATORY-003](#regulatory-003) | E03 | Corpus publication | B | REGULATORY-002 |
| [REGULATORY-004](#regulatory-004) | E03 | Regulatory library | B | REGULATORY-003 |
| [ATOMIC-001](#atomic-001) | E04 | Atomic controls | B | REGULATORY-004 |
| [ATOMIC-002](#atomic-002) | E04 | Applicability decisions | B | ATOMIC-001 |
| [ATOMIC-003](#atomic-003) | E04 | Control instantiation | B | ATOMIC-002 |
| [COMPLIANCE-001](#compliance-001) | E04/E16 | Implementations | B | ATOMIC-003 |
| [SECURITY-001](#security-001) | E22 | Protected payload encryption | B | FOUNDATION-004,TENANT-002,AUTHZ-001,AUDIT-001 |
| [COMPLIANCE-002](#compliance-002) | E04/E16 | Evidence foundation | B | COMPLIANCE-001,SECURITY-001 |
| [COMPLIANCE-003](#compliance-003) | E04/E16 | Evidence availability | B | COMPLIANCE-002 |
| [COMPLIANCE-004](#compliance-004) | E04/E16 | Test execution | B | COMPLIANCE-003 |
| [COMPLIANCE-005](#compliance-005) | E04/E16 | Assessment workflow | B | COMPLIANCE-004 |
| [COMPLIANCE-006](#compliance-006) | E04/E16 | Compliance surfaces | B | COMPLIANCE-005 |
| [INVENTORY-001](#inventory-001) | E05 | Catalogue foundation | B | COMPLIANCE-006 |
| [INVENTORY-002](#inventory-002) | E05 | System inventory | B | INVENTORY-001 |
| [INVENTORY-003](#inventory-003) | E05 | Data catalogue | B | INVENTORY-002 |
| [INVENTORY-004](#inventory-004) | E05 | Activity record | B | INVENTORY-003 |
| [PROCESSING-001](#processing-001) | E05 | Processing graph foundation | B | INVENTORY-004 |
| [PROCESSING-002](#processing-002) | E05 | Data flow map | B | PROCESSING-001 |
| [PORTAL-001](#portal-001) | E08 | Privacy Centre configuration | B | PROCESSING-002 |
| [PORTAL-002](#portal-002) | E08 | Public portal shell | B | PORTAL-001 |
| [PORTAL-003](#portal-003) | E08 | Principal portal session | B | PORTAL-002,IDENTITY-003 |
| [RIGHTS-001](#rights-001) | E09 | Rights record foundation | B | PORTAL-003 |
| [RIGHTS-002](#rights-002) | E09 | Request submission | B | RIGHTS-001 |
| [RIGHTS-003](#rights-003) | E09 | Verification and assignment | B | RIGHTS-002 |
| [RIGHTS-004](#rights-004) | E09 | Fulfilment | B | RIGHTS-003 |
| [RIGHTS-005](#rights-005) | E09 | Response approval and delivery | B | RIGHTS-004 |
| [RIGHTS-006](#rights-006) | E09 | Grievance | B | RIGHTS-005 |
| [RIGHTS-007](#rights-007) | E09 | Rights user journeys | B | RIGHTS-006 |
| [RIGHTS-008](#rights-008) | E09 | Nomination and guardian delegation | P | RIGHTS-007 |
| [NOTICES-001](#notices-001) | E06 | Notice versions | B | RIGHTS-007 |
| [NOTICES-002](#notices-002) | E06 | Notice publication | B | NOTICES-001 |
| [NOTICES-003](#notices-003) | E06 | Notice surfaces | B | NOTICES-002 |
| [CONSENT-001](#consent-001) | E07 | Consent ledger | B | NOTICES-003 |
| [CONSENT-002](#consent-002) | E07 | Consent decision | B | CONSENT-001 |
| [CONSENT-003](#consent-003) | E07 | Preference surface | B | CONSENT-002 |
| [CONSENT-004](#consent-004) | E07 | Consent SDK | P | CONSENT-003 |
| [VENDOR-001](#vendor-001) | E10 | Vendor register | B | CONSENT-003 |
| [VENDOR-002](#vendor-002) | E10 | Vendor surfaces | B | VENDOR-001 |
| [VENDOR-003](#vendor-003) | E10 | Processor governance | P | VENDOR-002,COMPLIANCE-005 |
| [RISK-001](#risk-001) | E11 | Risk and remediation register | B | VENDOR-002 |
| [RISK-002](#risk-002) | E11 | Risk surfaces | B | RISK-001 |
| [RISK-003](#risk-003) | E11 | Risk acceptance | P | RISK-002 |
| [DPIA-001](#dpia-001) | E12 | DPIA record | P | RISK-003,COMPLIANCE-005 |
| [DPIA-002](#dpia-002) | E12 | DPIA review | P | DPIA-001 |
| [INCIDENT-001](#incident-001) | E13 | Incident register | B | RISK-002 |
| [INCIDENT-002](#incident-002) | E13 | Breach determination | P | INCIDENT-001 |
| [INCIDENT-003](#incident-003) | E13 | Parallel notification tracks | P | INCIDENT-002,RIGHTS-005 |
| [LIFECYCLE-001](#lifecycle-001) | E14/E15 | Retention policy | P | INCIDENT-003 |
| [LIFECYCLE-002](#lifecycle-002) | E14/E15 | Deletion planning | P | LIFECYCLE-001 |
| [CONNECTOR-001](#connector-001) | E19 | Connector execution foundation | P | AUDIT-002,VENDOR-002 |
| [LIFECYCLE-003](#lifecycle-003) | E14/E15 | Deletion execution | P | LIFECYCLE-002,CONNECTOR-001 |
| [LIFECYCLE-004](#lifecycle-004) | E14/E15 | Lifecycle surfaces | P | LIFECYCLE-003 |
| [GRAPH-001](#graph-001) | E16 | Evidence graph queries | B | INCIDENT-001,PROCESSING-002,COMPLIANCE-004,RISK-001,VENDOR-001 |
| [GRAPH-002](#graph-002) | E16 | Evidence traceability surface | B | GRAPH-001 |
| [GRAPH-003](#graph-003) | E16 | Temporal graph snapshots | P | GRAPH-002 |
| [REPORT-001](#report-001) | E18/E21 | Dashboard and report read models | B | GRAPH-002 |
| [REPORT-002](#report-002) | E18/E21 | Report export | B | REPORT-001 |
| [REPORT-003](#report-003) | E18/E21 | Government Bid acceptance | B | REPORT-002 |
| [INTELLIGENCE-001](#intelligence-001) | E03 | Regulatory change intelligence | P | REGULATORY-003,GRAPH-003 |
| [INTELLIGENCE-002](#intelligence-002) | E03 | Impact review | P | INTELLIGENCE-001 |
| [ASSURANCE-001](#assurance-001) | E19/E04 | Continuous assurance | F | CONNECTOR-001,COMPLIANCE-004,INTELLIGENCE-002 |
| [ASSURANCE-002](#assurance-002) | E19/E04 | Security evidence adapters | F | ASSURANCE-001 |
| [ASSURANCE-003](#assurance-003) | E19/E04 | Backup and SIEM assurance | F | ASSURANCE-002 |
| [ASSURANCE-004](#assurance-004) | E19/E04 | Webhook delivery | F | ASSURANCE-003 |
| [AI-001](#ai-001) | E20 | AI policy gateway | F | ASSURANCE-004,GRAPH-003 |
| [AI-002](#ai-002) | E20 | Scoped retrieval | F | AI-001 |
| [AI-003](#ai-003) | E20 | Tool proposal safety | F | AI-002 |
| [AI-004](#ai-004) | E20 | Copilot surface | F | AI-003 |
| [HARDEN-001](#harden-001) | E21/E22 | Recovery foundation | B | AUDIT-003,FOUNDATION-004 |
| [DEPLOY-001](#deploy-001) | E21 | Customer pilot deployment | P | HARDEN-001,IDENTITY-004,CONNECTOR-001 |
| [HARDEN-002](#harden-002) | E21/E22 | Four-profile deployment | F | HARDEN-001,LIFECYCLE-003,AI-004,DEPLOY-001 |
| [HARDEN-003](#harden-003) | E21/E22 | HA and disaster recovery | F | HARDEN-002 |
| [HARDEN-004](#harden-004) | E21/E22 | Observability and response | F | HARDEN-003 |
| [HARDEN-005](#harden-005) | E21/E22 | Enterprise release verification | F | HARDEN-004 |
| [ASSURANCE-005](#assurance-005) | E19 | SIEM assurance | F | ASSURANCE-003 |
| [AUDIT-005](#audit-005) | E17 | Audit engagement workflow | P | AUDIT-004,RISK-003 |
| [EVIDENCE-001](#evidence-001) | E16 | Evidence lifecycle | P | GRAPH-003,LIFECYCLE-003 |
| [PORTAL-004](#portal-004) | E08 | Complete principal journeys | P | RIGHTS-008,NOTICES-003,CONSENT-003 |
| [GOVERNANCE-001](#governance-001) | E04 | Special regulatory assessments | P | RIGHTS-008,ATOMIC-003 |
| [TENANT-004](#tenant-004) | E02 | Audited tenant provisioning | B | AUDIT-002,TENANT-003,AUTHZ-003 |
| [TENANT-005](#tenant-005) | E02 | Organisation onboarding | B | TENANT-004 |
| [IDENTITY-005](#identity-005) | E01 | Membership invitation | B | AUDIT-002,AUTHZ-002,TENANT-005 |
| [IDENTITY-006](#identity-006) | E01 | Service credential lifecycle | P | IDENTITY-005,AUTHZ-003 |
| [HARDEN-006](#harden-006) | E21/E22 | Production release governance | F | HARDEN-005,ASSURANCE-005,AUDIT-005,EVIDENCE-001,PORTAL-004,GOVERNANCE-001,IDENTITY-006 |
| [EXTEND-001](#extend-001) | E05/E19/E20/E21 | Discovery and classification | L | CONNECTOR-001,GRAPH-003 |
| [EXTEND-002](#extend-002) | E05/E19/E20/E21 | Sector packs | L | EXTEND-001 |
| [EXTEND-003](#extend-003) | E05/E19/E20/E21 | Consent Manager interoperability | L | CONSENT-004,ASSURANCE-004 |
| [EXTEND-004](#extend-004) | E05/E19/E20/E21 | Digital Twin and Privacy CI/CD | L | EXTEND-001,GRAPH-003,AI-003 |
| [EXTEND-005](#extend-005) | E05/E19/E20/E21 | Advanced agents | L | EXTEND-004 |
| [NOTIFY-001](#notify-001) | E09 | Notification template safety | B | RIGHTS-005 |
| [EXTEND-006](#extend-006) | E21 | Government pack | L | EXTEND-002,REGULATORY-003 |
| [EXTEND-007](#extend-007) | E21 | BFSI pack | L | EXTEND-002,REGULATORY-003 |
| [EXTEND-008](#extend-008) | E21 | Healthcare pack | L | EXTEND-002,RIGHTS-008 |
| [EXTEND-009](#extend-009) | E21 | EdTech pack | L | EXTEND-002,RIGHTS-008 |
| [EXTEND-010](#extend-010) | E19 | Privacy CI/CD | L | EXTEND-004,CONNECTOR-001 |
| [LIFECYCLE-005](#lifecycle-005) | E15 | Advanced deletion scale | L | LIFECYCLE-004,EXTEND-001 |

## Epic E00 — Repository and foundation

### FOUNDATION-001

- **Story:** Repository contract foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Create the empty pnpm/TypeScript workspace and architecture contract directory skeleton; no product modules.
- **Dependencies:** —. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** apps/{web,api,privacy-centre,worker}, packages/contracts, package.json, pnpm-workspace.yaml, tsconfig, CI and tests; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** None; no migrations.
- **API impact:** None; no controllers. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** No runtime authorization surface. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** None; repository changes reviewed in PR. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Workspace install/lint/typecheck succeeds with pinned supported versions; all MASTER_SPEC target paths represented; architecture documents preserved; branch agent/foundation; no application screen or business behavior.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### FOUNDATION-002

- **Story:** Verification foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Configure CI quality/security gates and deterministic synthetic test harness.
- **Dependencies:** FOUNDATION-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** apps/{web,api,privacy-centre,worker}, packages/contracts, package.json, pnpm-workspace.yaml, tsconfig, CI and tests; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Disposable test DB setup only.
- **API impact:** No public API. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** CI least-privilege identity. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** CI provenance and security findings. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** ESLint/typecheck/unit/Playwright harness/Semgrep/CodeQL/Trivy/Gitleaks/dependency audit/Checkov/SBOM jobs report explicit results; injected secret and vulnerable fixture fail appropriately.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### FOUNDATION-003

- **Story:** Local portable services.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Define local container service composition and health checks for PostgreSQL Redis Keycloak Temporal and S3-compatible storage.
- **Dependencies:** FOUNDATION-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** apps/{web,api,privacy-centre,worker}, packages/contracts, package.json, pnpm-workspace.yaml, tsconfig, CI and tests; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Separate IdP/Temporal/app databases; no business schema.
- **API impact:** Private liveness/readiness only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Workload credentials isolated; no public admin ports. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** Service startup/config events without secrets. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Local startup/shutdown repeatable; storage/IdP/Temporal readiness failures visible; no fixed production credentials.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### FOUNDATION-004

- **Story:** Security infrastructure.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement secrets/KMS port and fake test adapter plus approved-provider configuration contract.
- **Dependencies:** FOUNDATION-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** apps/{web,api,privacy-centre,worker}, packages/contracts, package.json, pnpm-workspace.yaml, tsconfig, CI and tests; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Secret references only; no personal data.
- **API impact:** None. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Workload identity and deny unavailable secret provider. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** SecretAccessDenied/RotationRequested metadata. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Secrets cannot appear in logs/errors; missing provider fails closed; OPEN-02 remains production gate.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### FOUNDATION-005

- **Story:** API contract foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement error validation correlation and pagination middleware skeleton.
- **Dependencies:** FOUNDATION-004. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** apps/{web,api,privacy-centre,worker}, packages/contracts, package.json, pnpm-workspace.yaml, tsconfig, CI and tests; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** None.
- **API impact:** Common response/error contract; health only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Protected routes default deny before feature registration. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** Security denial event port (durable implementation follows AUDIT-001). Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Unknown route permission denied; DTO rejects extra tenant/actor fields; limits and non-disclosing errors verified.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### FOUNDATION-006

- **Story:** Design foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Create accessible UI tokens locale infrastructure and empty staff/portal app shells.
- **Dependencies:** FOUNDATION-005. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** apps/{web,api,privacy-centre,worker}, packages/contracts, package.json, pnpm-workspace.yaml, tsconfig, CI and tests; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** None.
- **API impact:** BFF plumbing skeleton only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** No business access until identity/authorization gates. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** None beyond operational errors. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Keyboard/screen-reader shell and Hindi/English locale switching pass; no fake dashboard data or frontend-only security.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E02 — Tenant security

### TENANT-001

- **Story:** Tenant data foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Create tenant registry and tenant-owned organisation schema migration.
- **Dependencies:** FOUNDATION-005. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/database, packages/security/tenant-context, apps/api tenancy adapters, tests/tenancy; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** tenants deployments organisations legal_entities business_units departments actor_refs resource_registry; FK/index/RLS conventions.
- **API impact:** No business endpoint yet. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Separate platform/runtime/migration DB roles. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** Migration/provisioning intent through audit port. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Migration rollback/upgrade tests; app role cannot own/bypass RLS; hierarchy cycle and restricted bootstrap-actor constraint tests.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### TENANT-002

- **Story:** Trusted transaction context.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement transaction-local tenant context adapter and composite tenant FK test fixture.
- **Dependencies:** TENANT-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/database, packages/security/tenant-context, apps/api tenancy adapters, tests/tenancy; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** RLS policies and tenant immutability for fixture/tenant tables.
- **API impact:** No endpoint. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** TrustedContext construction internal only. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** TenantContextDenied. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Tenant A cannot read/write/link Tenant B; absent context denied; pool reuse rollback/nesting tests pass.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### TENANT-003

- **Story:** Cross-surface context.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Define scoped work-item/cache/object-key context helpers and deployment routing port.
- **Dependencies:** TENANT-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/database, packages/security/tenant-context, apps/api tenancy adapters, tests/tenancy; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** work_items contract; migration deferred to audit/workflow owner.
- **API impact:** No public tenant-header routing. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** One verified tenant per context and work item. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ContextRejected. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Forged tenant payload/header cannot alter context; cache keys separate tenant/scope; routing accepts registry output only.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E01 — Identity

### IDENTITY-001

- **Story:** Staff authentication.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement staff OIDC login callback and server-side session/logout.
- **Dependencies:** TENANT-003,FOUNDATION-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/auth, apps/web and privacy-centre BFF auth, apps/api identity, tests/security/auth; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** users sessions; issuer-subject uniqueness and RLS.
- **API impact:** BFF auth login/callback/logout and GET auth/me. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** OIDC issuer/audience PKCE state nonce; mandatory MFA. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** LoginSucceeded/Failed/SessionRevoked via durable-ready port. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Invalid issuer/audience/replay rejected; secure cookies; no browser token storage; logout revokes server session.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### IDENTITY-002

- **Story:** Tenant membership selection.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement verified membership selection and suspension checks.
- **Dependencies:** IDENTITY-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/auth, apps/web and privacy-centre BFF auth, apps/api identity, tests/security/auth; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** user membership/security epoch fields.
- **API impact:** POST auth/tenant-selection. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Membership lookup plus active tenant; no client tenant trust. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** SessionSelected/TenantAccessDenied. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Multi-tenant user can switch only valid memberships; revoked/suspended membership rejected on next request.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### IDENTITY-003

- **Story:** Principal identity.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement separate principal audience and subject-bound session adapter.
- **Dependencies:** IDENTITY-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/auth, apps/web and privacy-centre BFF auth, apps/api identity, tests/security/auth; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** data_principals principal_bindings sessions identity_verifications minimal metadata.
- **API impact:** Portal authentication binding contract. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Own verified subject; no email-only linking. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** PrincipalAuthenticated/VerificationRecorded. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Staff tokens cannot become principal session; subject UUID alone insufficient; synthetic verification only until OPEN-05.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### IDENTITY-004

- **Story:** Enterprise federation.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Configure SAML/OIDC and AD/LDAP federation integration contract and tests.
- **Dependencies:** IDENTITY-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/auth, apps/web and privacy-centre BFF auth, apps/api identity, tests/security/auth; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Identity metadata only.
- **API impact:** No new business API. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Customer IdP mapping and assurance policy. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** FederationConfigured. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Federated logout/revocation/MFA claims tested; disconnected local federation supported.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E01 — RBAC and ABAC

### AUTHZ-001

- **Story:** Permission foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement registered permissions roles scoped grants and policy evaluator.
- **Dependencies:** IDENTITY-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/auth/authorization, packages/contracts/permissions, apps/api authorization, tests/security/authorization; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** roles permissions role_permissions user_roles group_roles grant_scopes policy_versions service_accounts service_grants.
- **API impact:** Internal authorize/filterScope port only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Default deny all undefined actions; role matrix RBAC_ABAC. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** PolicyDecision/GrantChanged. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Positive/negative tests for every required role; multi-role deny, hierarchy and sensitivity checks.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### AUTHZ-002

- **Story:** Grant administration.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement one role-assignment command and revocation.
- **Dependencies:** AUTHZ-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/auth/authorization, packages/contracts/permissions, apps/api authorization, tests/security/authorization; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** user_roles approval_records.
- **API impact:** POST users/:id/role-assignments and revoke. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Delegation ceiling step-up and distinct checker. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RoleAssigned/Revoked. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Tenant Admin cannot self-elevate or grant platform powers; revocation invalidates subsequent access.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### AUTHZ-003

- **Story:** Service and worker authorization.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement scoped service token and worker reauthorization guard.
- **Dependencies:** AUTHZ-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/auth/authorization, packages/contracts/permissions, apps/api authorization, tests/security/authorization; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** service_accounts service_grants.
- **API impact:** Service guard; no arbitrary worker endpoint. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Exact tenant capability; current policy at execution. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ServiceAccessDenied. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Revoked service/actor cannot execute queued task; role wildcard and wrong audience denied.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### AUTHZ-004

- **Story:** Support governance.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement expiring dual-approved support grants.
- **Dependencies:** AUTHZ-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/auth/authorization, packages/contracts/permissions, apps/api authorization, tests/security/authorization; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** support_grants.
- **API impact:** POST support-grants approve/revoke and scoped session exchange. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Tenant approver plus operator approver; fresh MFA. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** SupportGrantApproved/Used/Revoked. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Platform admin cannot read tenant content without grant; expiry and revocation terminate access.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E17 — Audit architecture

### AUDIT-001

- **Story:** Atomic audit foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement append-only audit stream with transactional audit/outbox boundary.
- **Dependencies:** AUTHZ-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/audit, packages/database, apps/worker/outbox, apps/api/audit, apps/web/audit, tests/integration/audit; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** audit_streams audit_events platform_audit_streams platform_audit_events outbox_events idempotency_records.
- **API impact:** Internal append and unit-of-work ports. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Runtime INSERT-only audit; no bypass owner credential. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** Canonical mutation audit. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Injected audit failure rolls back business fixture; stream concurrency produces valid unique hash chain.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### AUDIT-002

- **Story:** Durable delivery.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement outbox dispatcher inbox dedupe and dead-letter replay.
- **Dependencies:** AUDIT-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/audit, packages/database, apps/worker/outbox, apps/api/audit, apps/web/audit, tests/integration/audit; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** inbox_receipts work_items/outbox states.
- **API impact:** Scoped internal replay command. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Worker capability and current tenant state. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** EventDispatched/ReplayRequested. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Crash after publish produces one consumer effect; poison event visible; Redis outage loses no event.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### AUDIT-003

- **Story:** Audit integrity.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement signed anchor exporter and verifier using key-provider port.
- **Dependencies:** AUDIT-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/audit, packages/database, apps/worker/outbox, apps/api/audit, apps/web/audit, tests/integration/audit; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** audit_anchors.
- **API impact:** GET audit-integrity (metadata only). Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped Auditor; independent storage write identity. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** AuditAnchorWritten/VerificationFailed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** DB history tamper detected against external anchor; missing signing provider blocks anchor and alerts.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### AUDIT-004

- **Story:** Audit inspection.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement audit query API and paginated staff audit-trail view.
- **Dependencies:** AUDIT-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/audit, packages/database, apps/worker/outbox, apps/api/audit, apps/web/audit, tests/integration/audit; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Read existing audit tables.
- **API impact:** GET audit-events. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Auditor/DPO scoped read; no raw PD diffs. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** AuditViewed/ExportRequested. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Scope filtered before counts/pagination; two-tenant UI/API tests; no mutation route.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E03 — Regulatory corpus

### REGULATORY-001

- **Story:** Corpus foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement immutable regulatory source/version schema and bundle validator.
- **Dependencies:** AUDIT-004. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/regulatory, regulations/india/dpdp, apps/api/regulatory, apps/web/regulatory, tests/regulatory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** All Regulatory G tables except changes; no legal seed.
- **API impact:** Contract schemas only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Separate corpus publisher role; tenant runtime read-only. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** CorpusValidationFailed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No publication without checksum/citation/version/effective interval/reviewer; illustrative source rejected as authoritative.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### REGULATORY-002

- **Story:** Corpus intake.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement offline manifest import to quarantined draft corpus.
- **Dependencies:** REGULATORY-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/regulatory, regulations/india/dpdp, apps/api/regulatory, apps/web/regulatory, tests/regulatory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** regulatory_sources publication_manifests drafts.
- **API impact:** POST regulatory-sources/import. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Global source editor; no arbitrary URL fetch. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RegulatorySourceImported. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Tampered manifest rejected; duplicate checksum idempotent; no published visibility before review.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### REGULATORY-003

- **Story:** Corpus publication.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement reviewed atomic bundle publication and supersession.
- **Dependencies:** REGULATORY-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/regulatory, regulations/india/dpdp, apps/api/regulatory, apps/web/regulatory, tests/regulatory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** regulatory_reviews immutable versions publication state.
- **API impact:** POST regulatory-bundles/:id/publish. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Distinct Legal publisher; approved sources OPEN-01. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RegulationChanged. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Incomplete source set cannot publish; old versions remain queryable; legal corpus is missing until humans provide/approve it.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### REGULATORY-004

- **Story:** Regulatory library.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement published regulation/provision/requirement read APIs and library/detail UI.
- **Dependencies:** REGULATORY-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/regulatory, regulations/india/dpdp, apps/api/regulatory, apps/web/regulatory, tests/regulatory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Read-only corpus.
- **API impact:** GET regulations/provisions/requirements versions. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** S/C published read; scoped tenant joins. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RegulatoryLibraryViewed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Version/effective-date/source citations displayed; drafts hidden; no fabricated legal text.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E04 — Atomic control architecture

### ATOMIC-001

- **Story:** Atomic controls.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement tenant control and evidence-requirement schema with traceability validator.
- **Dependencies:** REGULATORY-004. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/compliance, packages/regulatory, apps/api/compliance, tests/regulatory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** controls control_templates control_mappings evidence_requirements obligations applicability.
- **API impact:** Contract schemas only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped Compliance draft; Legal review for mapping. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ControlValidationFailed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** All taxonomy families supported; missing requirement/source/effective/applicability/evidence fails validation.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### ATOMIC-002

- **Story:** Applicability decisions.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement deterministic tri-state applicability evaluate/review command.
- **Dependencies:** ATOMIC-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/compliance, packages/regulatory, apps/api/compliance, tests/regulatory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** applicability_rules requirement_applicability obligations exemptions.
- **API impact:** POST applicability-assessments/evaluate and approve. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Compliance proposes; DPO/Legal checks; no self-review. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ApplicabilityReviewed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Missing fact yields UNKNOWN; decision pins source/facts/rule versions; no inferred exemption.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### ATOMIC-003

- **Story:** Control instantiation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement create and approve one atomic control with requirement links.
- **Dependencies:** ATOMIC-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/compliance, packages/regulatory, apps/api/compliance, tests/regulatory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** controls mappings evidence_requirements.
- **API impact:** POST controls and controls/:id/approve. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped Compliance and independent mapping approver. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ControlApproved. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Approved control always has complete traceability; cross-tenant obligation rejected; canonical ID/alias semantics preserved.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E04/E16 — Compliance and evidence foundation

### COMPLIANCE-001

- **Story:** Implementations.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement create/update control implementation command.
- **Dependencies:** ATOMIC-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/compliance, packages/domain/evidence, apps/api/compliance and evidence, apps/worker/scanner, apps/web/compliance, tests/integration; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** control_implementations implementation link schemas.
- **API impact:** POST/PATCH control-implementations. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped accountable owner; legal obligation link required. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ImplementationChanged. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Invalid control-obligation pairing rejected; If-Match conflict tested; scope cannot be broadened by owner.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### COMPLIANCE-002

- **Story:** Evidence foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement upload reservation and encrypted quarantine ingress.
- **Dependencies:** COMPLIANCE-001,SECURITY-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/compliance, packages/domain/evidence, apps/api/compliance and evidence, apps/worker/scanner, apps/web/compliance, tests/integration; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** evidence evidence_versions upload_reservations.
- **API impact:** POST evidence/uploads; PUT content; POST complete. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped uploader and bounded reservation. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** UploadReserved/Quarantined. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Oversize/hash mismatch/reused reservation rejected; bytes never publicly available before scan.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### COMPLIANCE-003

- **Story:** Evidence availability.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement isolated scan result acceptance and authorized download.
- **Dependencies:** COMPLIANCE-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/compliance, packages/domain/evidence, apps/api/compliance and evidence, apps/worker/scanner, apps/web/compliance, tests/integration; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** evidence_custody version scan states.
- **API impact:** GET evidence metadata and versions/:id/download. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scanner identity; download permission separate from metadata. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** EvidenceUploaded/Rejected/Downloaded. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Scanner outage remains quarantine; malicious file denied; immutable scanned hash checked at download; cross-tenant access denied.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### COMPLIANCE-004

- **Story:** Test execution.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement one manual test-result command with evidence qualification.
- **Dependencies:** COMPLIANCE-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/compliance, packages/domain/evidence, apps/api/compliance and evidence, apps/worker/scanner, apps/web/compliance, tests/integration; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** test_definitions control_tests test_evidence findings.
- **API impact:** POST control-tests/:id/record-result. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Assigned tester; required evidence present/current. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ControlTestRecorded/ControlFailed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Fail/inconclusive/pass semantics tested; expired/quarantined evidence cannot satisfy test; duplicate run no duplicate finding.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### COMPLIANCE-005

- **Story:** Assessment workflow.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement typed assessment answer submission and completion checks.
- **Dependencies:** COMPLIANCE-004. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/compliance, packages/domain/evidence, apps/api/compliance and evidence, apps/worker/scanner, apps/web/compliance, tests/integration; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** assessment_templates assessments assessment_answers.
- **API impact:** PUT assessments/:id/answers/:questionCode; POST submit. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped assessor; template pinned. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** AssessmentSubmitted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Unknown question/type rejected; incomplete required answers cannot submit; version conflict tested.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### COMPLIANCE-006

- **Story:** Compliance surfaces.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement control/implementation/assessment views and count-based readiness dashboard.
- **Dependencies:** COMPLIANCE-005. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/compliance, packages/domain/evidence, apps/api/compliance and evidence, apps/worker/scanner, apps/web/compliance, tests/integration; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Read projections only.
- **API impact:** GET controls/implementations/assessment and scoped counts. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Compliance/DPO/CISO/Executive field-scoped views. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DashboardViewed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Counts distinguish implemented/tested/current evidence/failure; no legal certification or unapproved percentage; accessible views.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E05 — Data inventory

### INVENTORY-001

- **Story:** Catalogue foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement systems and data-category/element schema and contract.
- **Dependencies:** COMPLIANCE-006. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, apps/api/data-governance, apps/web/inventory, tests/tenancy/inventory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** systems data_sources data_categories data_elements subject_categories.
- **API impact:** Contract schemas only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped Steward. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** InventorySchemaChanged via migration record. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Composite FKs/RLS and classification-only storage tests; no raw Aadhaar data field.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### INVENTORY-002

- **Story:** System inventory.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement create/update/list system API and system inventory view.
- **Dependencies:** INVENTORY-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, apps/api/data-governance, apps/web/inventory, tests/tenancy/inventory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** systems.
- **API impact:** POST/PATCH/GET systems. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped Data Steward/Business Owner. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** SystemCreated/Changed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No credential-bearing locator accepted; unauthorized scope move denied; paginated accessible list.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### INVENTORY-003

- **Story:** Data catalogue.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement data element/category and purpose catalogue operations.
- **Dependencies:** INVENTORY-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, apps/api/data-governance, apps/web/inventory, tests/tenancy/inventory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** data_elements data_categories purposes element_categories.
- **API impact:** GET/POST data-inventory elements/categories and purposes. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped Steward. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DataElementCreated/CategoryLinked. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Typed schema and FK ownership validated; category query can identify Aadhaar-related metadata without values.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### INVENTORY-004

- **Story:** Activity record.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement processing activity create/update and wizard.
- **Dependencies:** INVENTORY-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, apps/api/data-governance, apps/web/inventory, tests/tenancy/inventory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** processing_activities activity_subject_categories.
- **API impact:** POST/PATCH processing-activities. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped Business Owner/Steward. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ProcessingActivityCreated/Changed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Purpose/ground/retention review status visible; no automatic lawful-ground determination; optimistic conflict and accessibility tests.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E05 — Processing graph

### PROCESSING-001

- **Story:** Processing graph foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement typed activity/system/purpose/element edges and reverse queries.
- **Dependencies:** INVENTORY-004. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, packages/database/graph, apps/api/graph, apps/web/data-map, tests/integration/graph; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** processing_systems activity_purposes activity_data_elements system_data_elements implementation links.
- **API impact:** PUT activity link endpoints; read bounded activity map. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Read/update both endpoints within scope. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** EdgeLinked/Unlinked. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Cross-tenant/scope endpoint rejected; temporal intervals and reverse traversal tested.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### PROCESSING-002

- **Story:** Data flow map.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement data flow metadata and bounded graph view.
- **Dependencies:** PROCESSING-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, packages/database/graph, apps/api/graph, apps/web/data-map, tests/integration/graph; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** data_flows flow_activities.
- **API impact:** POST/GET data-flows. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped Steward and authorized viewer. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DataFlowCreated. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No arbitrary remote URL execution; cycles bounded in view; inaccessible node labels/counts not leaked.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E08 — Privacy Centre

### PORTAL-001

- **Story:** Privacy Centre configuration.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement verified-domain registry and versioned safe branding config.
- **Dependencies:** PROCESSING-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/privacy-centre, apps/privacy-centre, apps/api/portal, packages/ui, tests/e2e/portal; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** tenant_domains domain_reservations privacy_centre_configs.
- **API impact:** POST domain registration/verification and config publish. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Tenant Admin; proof of domain ownership. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DomainVerified/ConfigurationPublished. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Forged Host/forwarded headers rejected; duplicate hostname reserved globally; client-managed TLS mode supported.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### PORTAL-002

- **Story:** Public portal shell.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement anonymous config/contact API and accessible Hindi/English portal shell.
- **Dependencies:** PORTAL-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/privacy-centre, apps/privacy-centre, apps/api/portal, packages/ui, tests/e2e/portal; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Published config read only.
- **API impact:** GET portal/config and contact. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** U verified-host published fields only. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** PublicAbuseDetected. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No staff/principal data or draft content in public responses/cache; keyboard and screen-reader tests.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### PORTAL-003

- **Story:** Principal portal session.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Connect separate principal login and own-subject navigation to portal.
- **Dependencies:** PORTAL-002,IDENTITY-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/privacy-centre, apps/privacy-centre, apps/api/portal, packages/ui, tests/e2e/portal; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Session metadata only.
- **API impact:** GET portal session context. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** D own subject only. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** PrincipalSessionStarted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Another subject ID cannot select identity; session origin separation and generic recovery response tests.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E09 — Rights and grievance

### RIGHTS-001

- **Story:** Rights record foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement rights case/task/response and delegation schema contracts.
- **Dependencies:** PORTAL-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/rights, packages/workflows/rights, packages/notifications, apps/api/rights, apps/web/rights, apps/privacy-centre/requests, tests/rights; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** rights_requests rights_tasks rights_responses events grievances nominations delegation_grants principal_system_refs.
- **API impact:** Contract schemas only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Principal/staff scopes defined. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** Migration record. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** RLS and typed state constraints tested; no tracking-code-only access.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### RIGHTS-002

- **Story:** Request submission.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement own-subject access/correction/erasure request submission.
- **Dependencies:** RIGHTS-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/rights, packages/workflows/rights, packages/notifications, apps/api/rights, apps/web/rights, apps/privacy-centre/requests, tests/rights; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** rights_requests rights_request_events.
- **API impact:** POST portal/requests and scoped GET tracking. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** D verified subject; attachment ownership. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RightsRequestSubmitted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Tracking number returned within target; foreign request indistinguishable from absent; idempotent retry and rate tests.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### RIGHTS-003

- **Story:** Verification and assignment.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement staff verify/assign command and scoped task creation.
- **Dependencies:** RIGHTS-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/rights, packages/workflows/rights, packages/notifications, apps/api/rights, apps/web/rights, apps/privacy-centre/requests, tests/rights; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** identity_verifications rights_tasks.
- **API impact:** POST rights-requests/:id/verify and assign. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Officer verification/DPO assignment; assurance policy. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RightsRequestVerified/Assigned. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Verification proof cannot be logged; assigned task exposes only needed subject fields; unverified request cannot fulfil.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### RIGHTS-004

- **Story:** Fulfilment.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement task completion with system/activity/processor references.
- **Dependencies:** RIGHTS-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/rights, packages/workflows/rights, packages/notifications, apps/api/rights, apps/web/rights, apps/privacy-centre/requests, tests/rights; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** rights_tasks response draft reference.
- **API impact:** POST rights-tasks/:id/complete. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Assigned Steward/Business Owner exact task scope. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RightsTaskCompleted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** All required tasks/proofs checked before REVIEW; principal data outside task scope denied.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### RIGHTS-005

- **Story:** Response approval and delivery.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement immutable response approval/send/close workflow with durable notifications.
- **Dependencies:** RIGHTS-004. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/rights, packages/workflows/rights, packages/notifications, apps/api/rights, apps/web/rights, apps/privacy-centre/requests, tests/rights; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** rights_responses notifications templates approval_records.
- **API impact:** POST rights-responses/:id/approve/send and case transition. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Distinct DPO checker; transport service approved message only. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RightsRequestApproved/Responded/Completed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Changed response invalidates approval; ambiguous send reconciled; closure requires receipt; duplicate signal sends once logically.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### RIGHTS-006

- **Story:** Grievance.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement own grievance submission and reviewed resolution.
- **Dependencies:** RIGHTS-005. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/rights, packages/workflows/rights, packages/notifications, apps/api/rights, apps/web/rights, apps/privacy-centre/requests, tests/rights; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** grievances.
- **API impact:** POST portal/grievances; staff transition. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Own principal/assigned officer/distinct reviewer. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** GrievanceSubmitted/Resolved. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No auto legal rejection or expiry closure; unauthorized request link denied.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### RIGHTS-007

- **Story:** Rights user journeys.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement staff queue/detail and portal submission/tracking/response screens.
- **Dependencies:** RIGHTS-006. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/rights, packages/workflows/rights, packages/notifications, apps/api/rights, apps/web/rights, apps/privacy-centre/requests, tests/rights; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Read existing tables.
- **API impact:** Consumes existing rights contracts only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Same API roles, no frontend-only gates. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** SensitiveView events through API. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Citizen access and correction and DPO assign/approve/close E2E pass; Hindi/English and accessibility verified.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### RIGHTS-008

- **Story:** Nomination and guardian delegation.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement verified action-scoped nomination/guardian activation and revocation.
- **Dependencies:** RIGHTS-007. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/rights, packages/workflows/rights, packages/notifications, apps/api/rights, apps/web/rights, apps/privacy-centre/requests, tests/rights; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** nominations delegation_grants verification.
- **API impact:** POST portal/nominations and verify/revoke. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** OPEN-05 proof policy; independent designated reviewer. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** NominationActivated/Revoked. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Pending/expired delegation gives no access; revocation stops existing session action; legal interpretation reviewed.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E06 — Notices

### NOTICES-001

- **Story:** Notice versions.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement notice draft/version/translation schema and editing APIs.
- **Dependencies:** RIGHTS-007. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/notices, apps/api/notices, apps/web/notices, apps/privacy-centre/notices, tests/notices; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** notices notice_versions translations notice_purposes.
- **API impact:** POST notices/versions; PUT translations. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Privacy Officer draft; tenant scopes. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** NoticeDraftChanged. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Published versions immutable; sanitized content and required locale checks; purpose foreign tenant denied.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### NOTICES-002

- **Story:** Notice publication.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement independent approve/publish and public published read.
- **Dependencies:** NOTICES-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/notices, apps/api/notices, apps/web/notices, apps/privacy-centre/notices, tests/notices; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Publication state/approval records.
- **API impact:** POST notice-versions approve/publish; GET portal/notices. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Legal review and DPO checker; U published read. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** NoticePublished. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Atomic locale publication; public cache invalidated; old versions remain for receipts; no unreviewed statutory text.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### NOTICES-003

- **Story:** Notice surfaces.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement editor/version comparison and bilingual portal notice display.
- **Dependencies:** NOTICES-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/notices, apps/api/notices, apps/web/notices, apps/privacy-centre/notices, tests/notices; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Read/update via existing APIs.
- **API impact:** No new domain API. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** API-defined draft/publish grants. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** NoticeViewed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Stored XSS rejected; language/version shown; keyboard accessible editor and public display.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E07 — Consent

### CONSENT-001

- **Story:** Consent ledger.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement append-only consent events receipts and preference projection.
- **Dependencies:** NOTICES-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/consent, packages/contracts/consent, apps/api/consent, apps/privacy-centre/preferences, packages/integrations/consent-sdk, tests/consent; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** consent_purposes events receipts preference_profiles/options.
- **API impact:** Contract schemas only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Principal/collection client binding. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** Consent ledger migration record. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Per-subject/purpose ordering/uniqueness; no UPDATE/DELETE ledger grant; state reconstructs deterministically.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### CONSENT-002

- **Story:** Consent decision.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement grant/withdraw event command and receipt read.
- **Dependencies:** CONSENT-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/consent, packages/contracts/consent, apps/api/consent, apps/privacy-centre/preferences, packages/integrations/consent-sdk, tests/consent; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Consent ledger plus transactional outbox.
- **API impact:** POST consents/events; GET receipts; portal equivalents. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** D own or C verified proof; exact published notice/purpose. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ConsentGranted/Withdrawn. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Duplicate key returns same receipt; scope mismatch rejected; concurrent events ordered; withdrawal never overwrites grant.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### CONSENT-003

- **Story:** Preference surface.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement portal consent/preferences and scoped staff receipt view.
- **Dependencies:** CONSENT-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/consent, packages/contracts/consent, apps/api/consent, apps/privacy-centre/preferences, packages/integrations/consent-sdk, tests/consent; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Projection read/update through event commands.
- **API impact:** GET/PATCH preferences/portal preferences. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Own principal; staff case-scoped read. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** PreferenceChanged/ReceiptViewed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No bundled implicit consent; UI reflects ledger; revoked principal session blocked.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### CONSENT-004

- **Story:** Consent SDK.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Publish thin typed browser/server consent SDK with contract tests.
- **Dependencies:** CONSENT-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/consent, packages/contracts/consent, apps/api/consent, apps/privacy-centre/preferences, packages/integrations/consent-sdk, tests/consent; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** None.
- **API impact:** Existing consent APIs only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** No privileged browser secret; subject proof validated server-side. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** Existing consent events. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** SDK retries keep key; origin is not authority; notice and receipt versions round-trip.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E10 — Vendor and processor

### VENDOR-001

- **Story:** Vendor register.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement vendor/processor/service inventory schema and create/read APIs.
- **Dependencies:** CONSENT-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/vendors, apps/api/vendors, apps/web/vendors, tests/vendors; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** vendors processors processor_services processing_processors flow_processors.
- **API impact:** POST/GET vendors/processors/services and activity links. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Vendor Manager scope; both graph endpoints checked. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ProcessorAdded/VendorCreated. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Processor appears in activity→system→processor graph; duplicate/foreign vendor link rejected.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### VENDOR-002

- **Story:** Vendor surfaces.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement vendor list/detail and processor participation view.
- **Dependencies:** VENDOR-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/vendors, apps/api/vendors, apps/web/vendors, tests/vendors; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Read existing schema.
- **API impact:** Existing vendor/list graph APIs. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped manager/auditor metadata. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** VendorViewed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Bid inventory has permanent records; no claim of advanced review completion; scoped accessible view.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### VENDOR-003

- **Story:** Processor governance.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement contract/subprocessor edges and independent processor assessment approval.
- **Dependencies:** VENDOR-002,COMPLIANCE-005. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/vendors, apps/api/vendors, apps/web/vendors, tests/vendors; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** processor_contracts assessments subprocessors.
- **API impact:** POST contracts/subprocessors/assessments and approve. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Manager maker; independent scoped approver. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ProcessorApproved. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Subprocessor cycles denied; contract evidence current; expiry triggers review; no self-approval.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E11 — Risk

### RISK-001

- **Story:** Risk and remediation register.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement risk/finding/remediation schema and create/update commands.
- **Dependencies:** VENDOR-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/risk, apps/api/risks, apps/web/risks, tests/risk; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** risks methodologies findings remediation_tasks typed risk links.
- **API impact:** POST/GET/PATCH risks and remediation-tasks. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped risk owner; source refs authorized. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RiskCreated/RemediationChanged. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Failed test links to risk and open task; rating bound to methodology; source tenant mismatch denied.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### RISK-002

- **Story:** Risk surfaces.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement risk register/detail and remediation status UI.
- **Dependencies:** RISK-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/risk, apps/api/risks, apps/web/risks, tests/risk; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Read existing tables.
- **API impact:** Existing risk API. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** DPO/CISO/Executive field scopes. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RiskViewed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Executive sees aggregate/redacted risk only; evidence/path provenance visible to authorized reviewer.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### RISK-003

- **Story:** Risk acceptance.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement high-risk exception approval expiry and remediation closure proof.
- **Dependencies:** RISK-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/risk, apps/api/risks, apps/web/risks, tests/risk; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** exceptions approval_records.
- **API impact:** POST risks/:id/accept; exceptions approve; tasks close. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Distinct qualified checker; Legal when legal exception. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RiskAccepted/RemediationClosed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Expired acceptance reopens; own approval blocked; no override of tenant controls/holds.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E12 — DPIA

### DPIA-001

- **Story:** DPIA record.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement versioned DPIA assessment and typed answers.
- **Dependencies:** RISK-003,COMPLIANCE-005. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/dpia, apps/api/dpias, apps/web/dpias, tests/dpia; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** dpias assessments answers.
- **API impact:** POST dpias; PUT answers. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Business Owner answers scoped activity. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DpiaStarted/AnswerRecorded. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Template pinned; scope cannot include foreign activity; risk links retained.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### DPIA-002

- **Story:** DPIA review.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement reviewer stages approval/reassessment and wizard.
- **Dependencies:** DPIA-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/dpia, apps/api/dpias, apps/web/dpias, tests/dpia; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** DPIA state/approval history.
- **API impact:** POST dpias submit/approve/reopen. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Privacy/Legal/CISO review and independent DPO. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DpiaApproved/ReassessmentRequired. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Unresolved high-risk decision surfaced; significant activity change proposes reassessment; accessible wizard.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E13 — Incident and breach

### INCIDENT-001

- **Story:** Incident register.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement basic incident intake scoped metadata timeline and register view.
- **Dependencies:** RISK-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/incidents, packages/workflows/incidents, apps/api/incidents, apps/web/incidents, tests/incidents; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** incidents incident_actions affected_data.
- **API impact:** POST/GET/PATCH incidents. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Incident Manager/assigned responder. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** IncidentDeclared/Changed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Synthetic incident tracked with immutable actions; sensitive fields restricted; no automatic breach declaration.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### INCIDENT-002

- **Story:** Breach determination.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement affected-principal scope and human breach assessment approval.
- **Dependencies:** INCIDENT-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/incidents, packages/workflows/incidents, apps/api/incidents, apps/web/incidents, tests/incidents; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** affected_principals breach_assessments.
- **API impact:** POST incident affected-principals/assessments and approve. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Incident Manager proposes; DPO/Legal checker. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** PersonalDataBreachConfirmed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No AI confirmation; unknown remains visible; restricted subject counts/lists and no own approval.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### INCIDENT-003

- **Story:** Parallel notification tracks.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement version-pinned notification tracks draft/approve/send and timer escalation.
- **Dependencies:** INCIDENT-002,RIGHTS-005. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/incidents, packages/workflows/incidents, apps/api/incidents, apps/web/incidents, tests/incidents; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** notification_tracks notifications incident actions.
- **API impact:** POST track draft/approve/send. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Authorized human release; transport exact approved digest. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** NotificationApproved/Delivered/Failed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** DPDP/CERT-In/sector/contract tracks distinct; missing legal timer flagged; ambiguous send reconciles.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E14/E15 — Retention and deletion

### LIFECYCLE-001

- **Story:** Retention policy.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement reviewed retention rule and hold schemas/commands.
- **Dependencies:** INCIDENT-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/retention and deletion, packages/workflows/deletion, apps/api/retention and deletion, apps/web/lifecycle, tests/lifecycle; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** retention_policies rules legal_holds exceptions evaluations.
- **API impact:** POST retention policies approve; holds apply/release. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped lifecycle role with Legal/DPO review. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** HoldApplied/Released/RetentionTriggered. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No duration invented; hold scope verified; release cannot self-approve; evaluation pins policy.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### LIFECYCLE-002

- **Story:** Deletion planning.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement deletion plan/targets and digest-bound approval.
- **Dependencies:** LIFECYCLE-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/retention and deletion, packages/workflows/deletion, apps/api/retention and deletion, apps/web/lifecycle, tests/lifecycle; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** deletion_jobs targets approvals.
- **API impact:** POST deletion-jobs/targets/plan/approve. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Requester/checker separation and source authority. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DeletionRequested/Approved. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Changed target set invalidates approval; holds surface as blocked targets; no execution in this ticket.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### LIFECYCLE-003

- **Story:** Deletion execution.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement one synthetic deletion adapter execution and confirmation reconciliation.
- **Dependencies:** LIFECYCLE-002,CONNECTOR-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/retention and deletion, packages/workflows/deletion, apps/api/retention and deletion, apps/web/lifecycle, tests/lifecycle; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** deletion_confirmations erasure_tombstones.
- **API impact:** POST deletion-jobs/:id/execute; targets confirm. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Explicit destructive service capability; live hold check. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DeletionTargetConfirmed/DeletionCompleted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Unknown effect not retried blindly; partial failure never complete; restore tombstones generated.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### LIFECYCLE-004

- **Story:** Lifecycle surfaces.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement retention policy/hold views deletion queue and proof view.
- **Dependencies:** LIFECYCLE-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/retention and deletion, packages/workflows/deletion, apps/api/retention and deletion, apps/web/lifecycle, tests/lifecycle; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Existing schemas.
- **API impact:** Existing lifecycle APIs. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped lifecycle grants. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** LifecycleViewed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** All incomplete/held/unknown targets visible; no UI bypass for deletion approval; accessible views.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E16 — Compliance Evidence Graph

### GRAPH-001

- **Story:** Evidence graph queries.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement eight bounded query templates from DOMAIN_MODEL.
- **Dependencies:** INCIDENT-001,PROCESSING-002,COMPLIANCE-004,RISK-001,VENDOR-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/database/graph, packages/domain/evidence, apps/api/graph, apps/web/evidence-graph, tests/graph; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Remaining typed edges and graph snapshot contract.
- **API impact:** POST graph/queries. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Authorize each node/edge before counts/paths. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** GraphQueried. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** All eight mandated questions answered on synthetic versioned graph; cross-tenant/inaccessible node sentinel never returned.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### GRAPH-002

- **Story:** Evidence traceability surface.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement auditor/CISO evidence path and freshness views.
- **Dependencies:** GRAPH-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/database/graph, packages/domain/evidence, apps/api/graph, apps/web/evidence-graph, tests/graph; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Read graph and evidence only.
- **API impact:** Existing graph/evidence APIs. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped Auditor/CISO; file download separate. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** EvidencePathViewed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Rule→requirement→control→test→evidence→activity path and failed control→risk→remediation shown with version/provenance.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### GRAPH-003

- **Story:** Temporal graph snapshots.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement asOf/knownAt snapshot query and evidence expiry invalidation.
- **Dependencies:** GRAPH-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/database/graph, packages/domain/evidence, apps/api/graph, apps/web/evidence-graph, tests/graph; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** graph_snapshots temporal edges.
- **API impact:** Graph historical query options. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Current viewer permissions applied to historical data. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** GraphSnapshotCreated. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Historical answer uses pinned law/data versions; expired evidence changes current readiness; revoked access stays denied historically.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E18/E21 — Reporting and bid release

### REPORT-001

- **Story:** Dashboard and report read models.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement scoped dashboard count projection with watermark.
- **Dependencies:** GRAPH-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/reporting, apps/api/reports, apps/web/dashboards, apps/worker/reports, tests/e2e/demo, scripts/synthetic-seed; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Report/readiness projections.
- **API impact:** GET reports/dashboard. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** DPO/CISO/Executive scoped fields. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DashboardViewed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Staleness visible; no misleading legal score; counts match authoritative fixture and tenant filter.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### REPORT-002

- **Story:** Report export.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement one evidence-pack report job authorized download and report UI.
- **Dependencies:** REPORT-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/reporting, apps/api/reports, apps/web/dashboards, apps/worker/reports, tests/e2e/demo, scripts/synthetic-seed; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** report_jobs report_objects.
- **API impact:** POST reports; GET status/download. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped export plus download reauthorization. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ReportGenerated/Downloaded. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** CSV formula neutralization; encrypted expiring object; revoked access blocked; PDF/HTML safe rendering and missing evidence reported.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### REPORT-003

- **Story:** Government Bid acceptance.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Create prescribed synthetic dataset and automate five demo journeys/release gate.
- **Dependencies:** REPORT-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/reporting, apps/api/reports, apps/web/dashboards, apps/worker/reports, tests/e2e/demo, scripts/synthetic-seed; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Synthetic seed through permanent domain services; no real citizen data.
- **API impact:** No new API. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** All production authorization remains enabled. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** Normal domain audit; seed provenance. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** 50000 principals/25 systems/18 processors/42 activities/85 fields/150 controls/12 open risks/6 rights requests/2 incidents; fictional Rajasthan Citizen Services Department; citizen/DPO/auditor/CISO/executive journeys pass; unverified law clearly labelled and cannot be presented as approved DPDP release.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E03 — Regulatory intelligence

### INTELLIGENCE-001

- **Story:** Regulatory change intelligence.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement approved-source version diff and tenant impact proposal.
- **Dependencies:** REGULATORY-003,GRAPH-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/regulatory/changes, apps/api/regulatory-impacts, apps/web/regulatory-changes, tests/regulatory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** regulatory_changes regulatory_impacts.
- **API impact:** POST regulatory-impacts/evaluate and GET changes. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Global reviewed corpus; tenant Compliance/Legal scope. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RegulatoryImpactProposed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Diff identifies affected pinned obligations/controls; no automatic customer law/control rewrite.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### INTELLIGENCE-002

- **Story:** Impact review.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement impact approval and remediation proposal UI.
- **Dependencies:** INTELLIGENCE-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/regulatory/changes, apps/api/regulatory-impacts, apps/web/regulatory-changes, tests/regulatory; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** impact decisions/remediation links.
- **API impact:** POST regulatory-impacts/:id/approve. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Independent scoped reviewer. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** RegulatoryImpactApproved. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Old version remains reproducible; approved change generates review work and provenance.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E19 — Integration platform

### CONNECTOR-001

- **Story:** Connector execution foundation.
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement signed adapter manifest restricted runner credential reference and one read-only test adapter.
- **Dependencies:** AUDIT-002,VENDOR-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/integrations, apps/worker/connectors, apps/api/connectors, tests/integrations; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** connectors credentials runs webhooks delivery schema.
- **API impact:** POST connectors and runs; GET status. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Exact capability/tenant; approved egress; secrets refs. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ConnectorRunRequested/Completed/Failed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** SSRF/rebinding/metadata endpoint blocked; invalid signatures rejected; runner cannot access other tenant secrets.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E19/E04 — Continuous assurance

### ASSURANCE-001

- **Story:** Continuous assurance.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement IAM MFA evidence collector adapter.
- **Dependencies:** CONNECTOR-001,COMPLIANCE-004,INTELLIGENCE-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/integrations/adapters, packages/domain/compliance, apps/worker/assurance, tests/integrations; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Connector/test metadata only.
- **API impact:** Existing connector/test/evidence APIs. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Read-only IAM scope and authorized test definition. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** EvidenceUploaded/ControlTestRecorded. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Machine evidence preserves source/time/digest; inconclusive on unavailable provider; no assertion of legal compliance.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### ASSURANCE-002

- **Story:** Security evidence adapters.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement encryption-configuration collector for one approved provider.
- **Dependencies:** ASSURANCE-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/integrations/adapters, packages/domain/compliance, apps/worker/assurance, tests/integrations; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Connector metadata only.
- **API impact:** Existing run APIs. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Read-only approved cloud scope. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ConnectorRunCompleted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Fixture encryption cases produce deterministic pass/fail/inconclusive; provider creds and source payload minimized.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### ASSURANCE-003

- **Story:** Backup assurance.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement one backup-success collector adapter with contract fixtures.
- **Dependencies:** ASSURANCE-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/integrations/adapters, packages/domain/compliance, apps/worker/assurance, tests/integrations; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Connector/test metadata only.
- **API impact:** Existing run APIs. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Least read-only capabilities. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** EvidenceUploaded. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Backup collector staleness and missing data yield FAIL/INCONCLUSIVE; no write capabilities.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### ASSURANCE-004

- **Story:** Webhook delivery.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement signed outbound delivery and validated inbound endpoint.
- **Dependencies:** ASSURANCE-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/integrations/adapters, packages/domain/compliance, apps/worker/assurance, tests/integrations; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** webhooks webhook_deliveries inbox.
- **API impact:** Inbound registration endpoint and replay command. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Signature resolves tenant; replay scoped operator. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** WebhookDelivered/Failed/Replayed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Forgery/replay/cross-tenant payload tests; bounded retries and ambiguous side-effect handling.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E20 — AI Copilot

### AI-001

- **Story:** AI policy gateway.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement disabled-by-default provider/data policy gateway and redaction.
- **Dependencies:** ASSURANCE-004,GRAPH-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/ai, apps/api/ai, apps/worker/ai, apps/web/copilot, tests/security/ai; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** ai_policies ai_runs.
- **API impact:** POST ai/runs; GET status/policy. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Tenant policy intersect operator provider/data allowlist. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** AiRunRequested/Refused. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Disabled denies; no unapproved external PD; OPEN-07 provider approval; no DB/model direct access.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### AI-002

- **Story:** Scoped retrieval.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement authorized graph/document retrieval with provenance and scoped embeddings.
- **Dependencies:** AI-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/ai, apps/api/ai, apps/worker/ai, apps/web/copilot, tests/security/ai; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** ai_retrieval_refs embedding_chunks.
- **API impact:** Internal retrieval port only. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Original actor/tenant/object/field scope before retrieval. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** AiContextRetrieved. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Cross-tenant nearest-neighbour sentinel denied; revocation purges/blocks cached chunks; indirect injection corpus tested.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### AI-003

- **Story:** Tool proposal safety.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement one read-only tool and digest-bound human-reviewed harmless action proposal.
- **Dependencies:** AI-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/ai, apps/api/ai, apps/worker/ai, apps/web/copilot, tests/security/ai; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** ai_action_proposals approval_records.
- **API impact:** POST proposal approve/execute. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Original actor reauthorization; approved tool schema. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** AiActionProposed/ToolDenied/Executed. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Prompt injection cannot grant power; forbidden SQL/delete/rights rejection/breach-send rejected; argument mutation invalidates approval.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### AI-004

- **Story:** Copilot surface.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement cited advisory response UI and attack regression suite.
- **Dependencies:** AI-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/ai, apps/api/ai, apps/worker/ai, apps/web/copilot, tests/security/ai; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** No additional PD store.
- **API impact:** Existing AI APIs. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** AI grants plus underlying data scope. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** AiRunCompleted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No legal compliance claims; citations pin versions; uncertainty shown; complete MASTER_SPEC AI attack suite passes.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E21/E22 — Enterprise/government hardening

### HARDEN-001

- **Story:** Recovery foundation.
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement encrypted backup and isolated restore smoke-test tooling for local/staging profile.
- **Dependencies:** AUDIT-003,FOUNDATION-004. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** infra/{docker,terraform,kubernetes,helm}, packages/security, docs/operations, tests/security and deployment; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Backup manifests/restore ledger contract.
- **API impact:** No business API. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Separate backup credentials/keys. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** BackupCreated/RestoreVerified. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Restore verifies audit anchors and tenant data, erasure replay interface present; app cannot delete backups.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### HARDEN-002

- **Story:** Four-profile deployment.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement portable Helm/provider contracts and all four deployment conformance suites.
- **Dependencies:** HARDEN-001,LIFECYCLE-003,AI-004,DEPLOY-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** infra/{docker,terraform,kubernetes,helm}, packages/security, docs/operations, tests/security and deployment; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Deployment config/migration jobs only.
- **API impact:** Health/readiness and customer endpoint config. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Default-deny networks; separate workload roles. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DeploymentChanged. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** SaaS/dedicated/customer VPC/disconnected government boot with same images; no mandatory public dependency.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### HARDEN-003

- **Story:** HA and disaster recovery.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement HA/failover and full coordinated restore runbook/drill.
- **Dependencies:** HARDEN-002. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** infra/{docker,terraform,kubernetes,helm}, packages/security, docs/operations, tests/security and deployment; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Replication/backup infrastructure.
- **API impact:** No business API. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Dual-controlled restore access. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** Failover/Restore audit. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Measured RPO/RTO documented; erased data not resurrected; in-flight workflows reconciled; customer target approval required.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### HARDEN-004

- **Story:** Observability and response.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement redacted OTEL/SIEM telemetry alerts and operator runbooks.
- **Dependencies:** HARDEN-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** infra/{docker,terraform,kubernetes,helm}, packages/security, docs/operations, tests/security and deployment; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Operational metadata only.
- **API impact:** Scoped operational status. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** No tenant data in public health; scoped diagnostics. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** SecurityAlert/IncidentResponse actions. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Audit/outbox/backup/connector/deletion/webhook/AI failure alarms exercised; no secret/PII payload logs.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### HARDEN-005

- **Story:** Enterprise release verification.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Run load accessibility and independent security assessment remediation cycle.
- **Dependencies:** HARDEN-004. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** infra/{docker,terraform,kubernetes,helm}, packages/security, docs/operations, tests/security and deployment; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** None except synthetic benchmark data.
- **API impact:** All deployed API contracts under authorized test. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** All role/tenant matrices and support scope. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** Assessment evidence and remediation audit. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** p95/dashboard/rights targets benchmarked; independent VA/PT/API/tenant/config/container/source review and fixes verified; no claim without results.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### HARDEN-006

- **Story:** Production release governance.
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Assemble signed release evidence operations/support docs and approval checklist.
- **Dependencies:** HARDEN-005,ASSURANCE-005,AUDIT-005,EVIDENCE-001,PORTAL-004,GOVERNANCE-001,IDENTITY-006. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** infra/{docker,terraform,kubernetes,helm}, packages/security, docs/operations, tests/security and deployment; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** No business schema.
- **API impact:** No new API. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Human/security release authority OPEN-08. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** ReleaseApproved/Promoted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** All OPEN gates relevant to enabled capabilities closed; approved PR/pipeline rollback and change audit; no autonomous production access.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## Epic E05/E19/E20/E21 — Product extensions

### EXTEND-001

- **Story:** Discovery and classification.
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Implement metadata-only discovery observation review/promotion for one adapter.
- **Dependencies:** CONNECTOR-001,GRAPH-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, packages/integrations, packages/ai, packages/contracts/extensions, apps/api/extensions, tests/extensions; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** discovery_runs observations lineage_edges.
- **API impact:** POST discovery-runs and promote. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Steward review; connector read-only. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** DiscoveryPromoted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No source values retained by default; confidence/provenance visible; promotion versioned and authorized.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### EXTEND-002

- **Story:** Sector packs.
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Implement signed template install/diff/upgrade contracts for government BFSI health and EdTech.
- **Dependencies:** EXTEND-001. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, packages/integrations, packages/ai, packages/contracts/extensions, apps/api/extensions, tests/extensions; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** sector_pack_installs custom_field_definitions/values.
- **API impact:** POST sector-pack-installs and custom definitions. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Tenant Admin plus domain reviewers. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** SectorPackInstalled. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** All MASTER_SPEC journeys catalogued; retention questions not invented rules; install creates drafts; rollback preserves tenant edits.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### EXTEND-003

- **Story:** Consent Manager interoperability.
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Implement versioned adapter contract and synthetic interoperability harness.
- **Dependencies:** CONSENT-004,ASSURANCE-004. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, packages/integrations, packages/ai, packages/contracts/extensions, apps/api/extensions, tests/extensions; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Connector/consent linkage metadata.
- **API impact:** Existing adapter/consent APIs. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Approved service capabilities and verified subject proof. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** InteroperabilityEventAccepted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** No claim of external registration/conformance; unknown protocol/version denied; consent provenance and revocation preserved.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### EXTEND-004

- **Story:** Digital Twin simulation.
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Implement read-only graph simulation contract with one synthetic scenario.
- **Dependencies:** EXTEND-001,GRAPH-003,AI-003. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, packages/integrations, packages/ai, packages/contracts/extensions, apps/api/extensions, tests/extensions; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** simulation_runs.
- **API impact:** POST simulation-runs. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Scoped snapshot read; no live mutation. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** SimulationCompleted. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Scenario cannot change live controls; policy bundle and graph snapshot pinned; no live mutation permission.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

### EXTEND-005

- **Story:** Advanced agents.
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Extend approved tool proposal orchestration for multi-step advisory work.
- **Dependencies:** EXTEND-004. Review relevant ADRs and contracts before coding.
- **Expected files/modules:** packages/domain/data-governance, packages/integrations, packages/ai, packages/contracts/extensions, apps/api/extensions, tests/extensions; packages/contracts and corresponding specs/tests only when relevant.
- **Database impact:** Existing AI work/proposal records.
- **API impact:** Existing AI API with versioned task type. Follow API_ARCHITECTURE common contracts; no arbitrary status patching.
- **Authorization:** Same original actor scope and per-step approvals. RBAC_ABAC and scope/field checks are mandatory.
- **Audit/events:** AiProposalStepRecorded. Apply EVENT_MODEL atomicity, payload minimisation and dedupe.
- **Security/privacy:** Mandatory envelope above; inspect threat rows for this surface; unresolved OPEN gates cannot be self-approved.
- **Acceptance:** Every step reauthorized; no expansion of legal/destructive authority; bounded cost/retries and cancellation tested.
- **Required tests:** T0 always; T1–T5 wherever the declared DB/API/workflow/UI/security impacts apply, plus explicit tests of every acceptance condition above. Add regression tests for discovered defects.

## First assignment to GPT-6 Sol

**FOUNDATION-001 — Create the empty pnpm/TypeScript workspace and architecture contract directory skeleton.** Read AGENTS.md, ARCHITECTURE.md, ADR-001/002/003/004/029 and this ticket. Create branch `agent/foundation`, prepare its implementation plan for independent review, pin supported dependencies and scaffold only repository/tooling/contracts. Do not begin product screens or domain business modules. No database migration or domain endpoint is part of this first ticket. Architecture-only session stops before assigning or executing it.

## Later expansion allocation

EXTEND-001/002/006/007/008/009 and LIFECYCLE-005 are Release 1.5 (discovery/classification/lineage/sector packs and extensibility). EXTEND-003/004/005/010 are Release 2.0 (Consent Manager interoperability, Digital Twin, Privacy CI/CD and advanced advisory agents). Advanced deletion in 1.5 extends the same reviewed target/proof model, not a new lifecycle. Provider-specific adapters or scenario packs beyond the first contract-tested implementation require one independently reviewable ticket per adapter/scenario using the same fields; no agent may treat an epic as authorization to build an unbounded integration catalog.

## Coverage-completion stories (scheduled by dependencies)

### TENANT-004

- **Story:** Audited tenant provisioning (Epic E02).
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement restricted platform tenant provision/suspend command and bootstrap actor registration.
- **Dependencies:** AUDIT-002,TENANT-003,AUTHZ-003.
- **Expected files/modules:** packages/domain/tenancy, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** tenants deployment routing actor_refs platform audit streams; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** POST platform/tenants and suspend; OpenAPI schemas precede endpoint code.
- **Authorization:** Platform provision capability; no tenant business access; RBAC_ABAC common constraints apply.
- **Audit/events:** TenantProvisioned/Suspended; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Suspension blocks sessions/jobs; signed bootstrap creates no permanent bypass user; state and platform audit atomic.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### TENANT-005

- **Story:** Organisation onboarding (Epic E02).
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement hierarchy administration and onboarding view.
- **Dependencies:** TENANT-004.
- **Expected files/modules:** packages/domain/tenancy, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** organisations legal_entities business_units departments resource_registry; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** GET/POST/PATCH organisation hierarchy; OpenAPI schemas precede endpoint code.
- **Authorization:** Tenant Admin scoped manage; RBAC_ABAC common constraints apply.
- **Audit/events:** OrganisationConfigured/ScopeChanged; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** No DB edits for onboarding; cycle rejected; hierarchy move updates authorization epoch and descendant scope atomically.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### IDENTITY-005

- **Story:** Membership invitation (Epic E01).
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement invitation acceptance and scoped user/group membership administration.
- **Dependencies:** AUDIT-002,AUTHZ-002,TENANT-005.
- **Expected files/modules:** packages/domain/identity, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** users groups group_members actor_refs; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** POST invitations and group membership commands; OpenAPI schemas precede endpoint code.
- **Authorization:** Tenant Admin ceiling; verified invite identity; RBAC_ABAC common constraints apply.
- **Audit/events:** UserInvited/MembershipChanged; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Expired/replayed invite denied; no email-only linking; group changes recheck scope and invalidate stale authority.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### IDENTITY-006

- **Story:** Service credential lifecycle (Epic E01).
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement service-account create/revoke/rotate with one-time secret provisioning.
- **Dependencies:** IDENTITY-005,AUTHZ-003.
- **Expected files/modules:** packages/domain/identity, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** service_accounts grants secret references; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** POST service-accounts and rotate/revoke; OpenAPI schemas precede endpoint code.
- **Authorization:** Explicit admin capability and step-up; RBAC_ABAC common constraints apply.
- **Audit/events:** ServiceCredentialRotated/Revoked; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Old credentials denied after rotation window; no secret in list/audit/log; no self-grant.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### GOVERNANCE-001

- **Story:** Special regulatory assessments (Epic E04).
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement typed templates for child guardian SDF cross-border algorithmic diligence and regulatory proceedings.
- **Dependencies:** RIGHTS-008,ATOMIC-003.
- **Expected files/modules:** packages/domain/compliance, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** assessment_templates approved requirement mappings; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Existing assessments API; OpenAPI schemas precede endpoint code.
- **Authorization:** Compliance/Legal review of source-bound applicability; RBAC_ABAC common constraints apply.
- **Audit/events:** AssessmentTemplatePublished; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Six use cases represented as reviewed questions; no invented legal threshold or exemption.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### AUDIT-005

- **Story:** Audit engagement workflow (Epic E17).
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement audit plan findings and independent closure view.
- **Dependencies:** AUDIT-004,RISK-003.
- **Expected files/modules:** packages/domain/audit, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** audits audit_findings findings; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** POST/GET audits and findings; close; OpenAPI schemas precede endpoint code.
- **Authorization:** Scoped Auditor creates; independent checker closes; RBAC_ABAC common constraints apply.
- **Audit/events:** AuditFindingCreated/Closed; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Auditor cannot modify operational history; proof required; audit plan and evidence pack navigation accessible.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### NOTIFY-001

- **Story:** Notification template safety (Epic E09).
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement versioned Hindi/English templates and approved-dispatch retry.
- **Dependencies:** RIGHTS-005.
- **Expected files/modules:** packages/domain/notifications, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** notification_templates protected_payloads; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Templates publish; notification status/retry; OpenAPI schemas precede endpoint code.
- **Authorization:** Explicit template grant and owner message approval; RBAC_ABAC common constraints apply.
- **Audit/events:** TemplatePublished/NotificationRetried; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Injection escaped; retry cannot change recipient/content digest; no arbitrary send endpoint.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### SECURITY-001

- **Story:** Protected payload encryption (Epic E22).
- **Release:** 0.1 Government Bid — REQUIRED.
- **Objective:** Implement reviewed envelope-encryption port and typed payload storage using test provider.
- **Dependencies:** FOUNDATION-004,TENANT-002,AUTHZ-001,AUDIT-001.
- **Expected files/modules:** packages/domain/security, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** protected_payloads key metadata; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Internal payload port only; OpenAPI schemas precede endpoint code.
- **Authorization:** Owner/field scope before decrypt; OPEN-02 production gate; RBAC_ABAC common constraints apply.
- **Audit/events:** ProtectedPayloadAccessed/Denied; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Cross-tenant authenticated context cannot decrypt; library nonce uniqueness; no plaintext log/DB; rotation fixture passes.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### EVIDENCE-001

- **Story:** Evidence lifecycle (Epic E16).
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement evidence expiry revocation hold-aware purge and custody inspection.
- **Dependencies:** GRAPH-003,LIFECYCLE-003.
- **Expected files/modules:** packages/domain/evidence, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** evidence_versions custody retention links; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** POST evidence revoke; GET custody; expiry/purge activity; OpenAPI schemas precede endpoint code.
- **Authorization:** Evidence owner and scoped deletion service; live hold check; RBAC_ABAC common constraints apply.
- **Audit/events:** EvidenceExpired/Revoked/Purged; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Readiness invalidated; held bytes retained; derived previews/embeddings purged with proof.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### PORTAL-004

- **Story:** Complete principal journeys (Epic E08).
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement nomination/delegation and erasure/grievance navigation.
- **Dependencies:** RIGHTS-008,NOTICES-003,CONSENT-003.
- **Expected files/modules:** packages/domain/privacy-centre, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** No new business tables; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Existing portal APIs; OpenAPI schemas precede endpoint code.
- **Authorization:** Own subject or verified action-specific delegate; RBAC_ABAC common constraints apply.
- **Audit/events:** Existing case/relationship audit; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** All portal screens 49–59 covered; expired/revoked delegates blocked; Hindi/English accessibility passes.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### DEPLOY-001

- **Story:** Customer pilot deployment (Epic E21).
- **Release:** 0.5 Pilot — NOT a bid dependency.
- **Objective:** Implement reference private/customer Kubernetes pilot profile and runbook.
- **Dependencies:** HARDEN-001,IDENTITY-004,CONNECTOR-001.
- **Expected files/modules:** packages/domain/deployment, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** Infrastructure only; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Private health/config only; OpenAPI schemas precede endpoint code.
- **Authorization:** Default-deny network and customer keys/identity; RBAC_ABAC common constraints apply.
- **Audit/events:** PilotDeploymentValidated; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Same images run without mandatory public dependency; no premature HA/SLA claim.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### ASSURANCE-005

- **Story:** SIEM assurance (Epic E19).
- **Release:** 1.0 Production — NOT a bid dependency.
- **Objective:** Implement one SIEM log-health read-only collector.
- **Dependencies:** ASSURANCE-003.
- **Expected files/modules:** packages/domain/integrations, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** Connector/test metadata; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Existing run/test APIs; OpenAPI schemas precede endpoint code.
- **Authorization:** Read-only SIEM scope; RBAC_ABAC common constraints apply.
- **Audit/events:** EvidenceUploaded/ControlTestRecorded; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Missing/stale health inconclusive/fail; no raw log payloads; tenant credential isolation tested.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### EXTEND-006

- **Story:** Government pack (Epic E21).
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Author versioned government templates and signed pack tests.
- **Dependencies:** EXTEND-002,REGULATORY-003.
- **Expected files/modules:** packages/domain/extensions, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** Draft template installation only; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Existing pack API; OpenAPI schemas precede endpoint code.
- **Authorization:** Tenant install plus domain/legal review; RBAC_ABAC common constraints apply.
- **Audit/events:** SectorPackInstalled; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Benefits scholarships licences certificates municipal exams grievance recruitment websites public-health journeys covered; synthetic data only.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### EXTEND-007

- **Story:** BFSI pack (Epic E21).
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Author BFSI templates and signed pack tests.
- **Dependencies:** EXTEND-002,REGULATORY-003.
- **Expected files/modules:** packages/domain/extensions, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** Draft templates only; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Existing pack API; OpenAPI schemas precede endpoint code.
- **Authorization:** Reviewed scoped install; RBAC_ABAC common constraints apply.
- **Audit/events:** SectorPackInstalled; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Onboarding KYC loans credit collections servicing marketing fraud support employees vendors covered; legal mappings separately approved.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### EXTEND-008

- **Story:** Healthcare pack (Epic E21).
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Author healthcare and minor/guardian templates.
- **Dependencies:** EXTEND-002,RIGHTS-008.
- **Expected files/modules:** packages/domain/extensions, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** Draft templates only; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Existing pack API; OpenAPI schemas precede endpoint code.
- **Authorization:** Reviewed install and special-data scope; RBAC_ABAC common constraints apply.
- **Audit/events:** SectorPackInstalled; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Registration appointments diagnostics insurance sharing research telemedicine minors covered; no sensitive source values.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### EXTEND-009

- **Story:** EdTech pack (Epic E21).
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Author child/guardian learning-processing templates.
- **Dependencies:** EXTEND-002,RIGHTS-008.
- **Expected files/modules:** packages/domain/extensions, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** Draft templates only; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Existing pack API; OpenAPI schemas precede endpoint code.
- **Authorization:** Reviewed install and delegation policy; RBAC_ABAC common constraints apply.
- **Audit/events:** SectorPackInstalled; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Registration parent verification consent analytics video advertising assessment erasure covered; no invented age exemptions.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### EXTEND-010

- **Story:** Privacy CI/CD (Epic E19).
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Implement versioned policy evaluation for one synthetic CI manifest.
- **Dependencies:** EXTEND-004,CONNECTOR-001.
- **Expected files/modules:** packages/domain/extensions, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** policy_evaluations; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** POST policy-evaluations; OpenAPI schemas precede endpoint code.
- **Authorization:** Service grant bound to tenant/project/bundle; RBAC_ABAC common constraints apply.
- **Audit/events:** PolicyEvaluated; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Result pins build/bundle/graph; CI cannot self-approve exceptions or mutate live controls.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

### LIFECYCLE-005

- **Story:** Advanced deletion scale (Epic E15).
- **Release:** 1.5/2.0 Expansion — NOT a bid dependency.
- **Objective:** Implement checkpointed bulk planning from reviewed discovery references.
- **Dependencies:** LIFECYCLE-004,EXTEND-001.
- **Expected files/modules:** packages/domain/deletion, packages/contracts, owning API/UI/worker adapters from MODULE_BOUNDARIES, associated tests; infrastructure tickets only infra and docs/operations. Implementation plan must name exact files.
- **Database impact:** Existing jobs targets checkpoints; migrations, RLS and rollback/forward plan where schema changes.
- **API impact:** Bounded batch contract on existing deletion APIs; OpenAPI schemas precede endpoint code.
- **Authorization:** Same exact-plan approval and per-target hold checks; RBAC_ABAC common constraints apply.
- **Audit/events:** Existing deletion proof events; EVENT_MODEL transaction/idempotency rules apply.
- **Security/privacy:** Mandatory envelope and applicable THREAT_MODEL rows; no production secrets/data or self-approved OPEN decisions.
- **Acceptance:** Bounded fan-out/cancellation; mixed unknown/held targets never complete; restore ledger preserved.
- **Required tests:** T0–T5 as applicable plus explicit positive/negative/concurrent/failure tests for every acceptance condition; record reasons for inapplicability.

## Foundation integration gate

Before any non-test deployment enables business/identity/grant mutations, AUDIT-001/002 must be wired and fail closed; TENANT-004/005 and IDENTITY-005 provide audited provisioning/onboarding rather than manual database edits. SECURITY-001 supplies protected payload/key handling before real sensitive-data use. Synthetic harnesses may test earlier ports in isolation, but no runtime skip-audit/auth flag exists. All B tickets, including coverage-completion stories, are release requirements. Post-schema tickets must include actor_refs/protected_payloads/principal_bindings refinements where referenced; do not create untyped URI/actor fields.
