# Architecture quality and traceability review

Date: 2026-09-30. Review performed by the founding-architect session against repository-local AGENTS.md and MASTER_SPEC.md plus the owner's full-product scope clarification. This is a specification consistency review, not independent security/legal approval or evidence that implementation tests pass.

## Provenance and change boundary

Initial tree: AGENTS.md and MASTER_SPEC.md only; git reported no commits on main. No previous prototype, parent-directory inventory, connected app, cloud drive or external legal source was inspected. Only architecture Markdown documents/ADRs were written in Privy360-Next. Inputs were not edited; no code, migrations, controllers, screens, deployment or application tests were created/run. Filesystem write permission was required because this requested repository lay outside the session's default writable roots.

## MASTER_SPEC coverage matrix

| Sections | Requirement group | Contract / implementation allocation |
|---|---|---|
| 1–4 | Engineering authority, clean room, organisation | ARCHITECTURE; BUILD_PLAN; AGENTS retained |
| 5–10 | Regulatory/atomic IDs, taxonomy and traceability | DOMAIN_MODEL; REGULATORY_INGESTION_SPEC; DATABASE_SPEC; REGULATORY/ATOMIC tickets |
| 11–12 | Core graph and all 84 initial tables | DOMAIN_MODEL; DATABASE_SPEC; typed graph/API contracts |
| 13–16 | Tenancy, authorization, API and event contracts | SECURITY_ARCHITECTURE; RBAC_ABAC; API_ARCHITECTURE; EVENT_MODEL |
| 17 | 80-screen product surface | Screen matrix below; no screens implemented |
| 18–22 | Foundation and reviewed agent implementation workflow | BUILD_PLAN FOUNDATION/TENANT/IDENTITY/AUTHZ/AUDIT and per-ticket plan gate |
| 23–26 | Compliance, inventory, portal, rights, notices/consent | Corresponding module/database/API/workflow contracts and B ticket tracks |
| 27–29 | Vendor/risk/DPIA, breach, retention/deletion | Full contracts; basic bid slices plus P-depth tickets |
| 30–33 | Intelligence, assurance, AI, government hardening | REGULATORY_INGESTION_SPEC; INTEGRATION_AI_SPEC; DEPLOYMENT; P/F tickets |
| 34–36 | Bid breadth, dataset and personas | ROADMAP exact B set; REPORT-003 synthetic acceptance |
| 37–41 | Security gates/tenant/AI/file/audit verification | THREAT_MODEL; SECURITY_ARCHITECTURE; EVENT_MODEL; CI/review tests |
| 42–43 | Evidence graph and non-misleading readiness | DOMAIN_MODEL eight query paths; GRAPH/REPORT tickets; count-based baseline |
| 44–48 | Industry priorities and all sector journeys | INTEGRATION_AI_SPEC full pack inventory; EXTEND-006/007/008/009 |
| 49–51 | Portal builder and four deployment modes | API/portal config, DEPLOYMENT_ARCHITECTURE, PORTAL/DEPLOY/HARDEN tickets |
| 52–57 | Branches, DoD, autonomy, memory and migrations | BUILD_PLAN review gates; DATABASE_SPEC evolution; no model/pricing claims reused |
| 58–60 | Minimisation and connector secrets | SECURITY/DATABASE/INTEGRATION_AI; ADR-017/021/030 |
| 61–67 | Monitoring, backups, performance, availability, assessment and releases | DEPLOYMENT_ARCHITECTURE; HARDEN tickets and OPEN-02/03/06/08 |
| 68–72 | All releases including future product capabilities | ROADMAP; EXTEND/DISCOVERY/AI contracts; no scope silently dropped |
| 73–78 | Epics, ticket size, contract freeze, reviews and defect loop | BUILD_PLAN tickets/test matrix; no subagent implementation invoked |
| 79–81 | Regulatory change loop, four connected systems and release claims | REGULATORY_INGESTION_SPEC; DOMAIN_MODEL; ARCHITECTURE; release gates |

## Screen coverage (MASTER_SPEC §17)

| Screen IDs | Surface | Contract / tickets |
|---|---|---|
| 1–4 | Login/MFA/recovery/SSO | Keycloak/BFF, IDENTITY-001/004; recovery preserves assurance |
| 5–10 | Organisation/entities/units/applicability/readiness/invitation | TENANT-005, IDENTITY-005, ATOMIC-002, COMPLIANCE-006 |
| 11–13 | Executive/DPO/security command centres | COMPLIANCE-006, REPORT-001, RBAC field scopes |
| 14–19 | Library/Act/Rule/requirement/control/change | REGULATORY-004, ATOMIC-003, COMPLIANCE-006, INTELLIGENCE-002 |
| 20–26 | Assessment/control/implementation/evidence/findings/remediation | COMPLIANCE-001–006, GRAPH-002, RISK-001/002 |
| 27–33 | Inventory/activity/catalogue/systems/sources/flows/purposes | INVENTORY-001–004, PROCESSING-001/002; source detail shares system adapter metadata |
| 34–41 | Consent dashboard/purpose/notice/editor/diff/receipt/preferences | CONSENT-001–003, NOTICES-001–003; consent-purpose settings use catalogue contracts |
| 42–48 | Rights queue/detail/verification/fulfilment/grievance/nomination | RIGHTS-001–008 and PORTAL-004 |
| 49–59 | Full Privacy Centre | PORTAL-001–004, RIGHTS, NOTICES, CONSENT; all permanent subject-scoped services |
| 60–63 | Vendor/detail/assessment/subprocessor | VENDOR-001–003 |
| 64–67 | Risk/detail/DPIA/wizard | RISK-001–003, DPIA-001/002 |
| 68–72 | Incident/dashboard/breach/notification/timeline | INCIDENT-001–003 |
| 73–76 | Retention/rules/deletion queue/proof | LIFECYCLE-001–005 |
| 77–80 | Audit dashboard/plan/evidence pack/trail | AUDIT-004/005, GRAPH-002, REPORT-002 |

## Contradictions and resolutions

| Issue | Resolution | Authority / record |
|---|---|---|
| Master philosophy diagram could imply MASTER outranks AGENTS; actual AGENTS hierarchy differs | Apply AGENTS §2 permanent hierarchy, retain MASTER product scope; no input rewritten | ARCHITECTURE and user instruction |
| Initial bare rule examples/DPDP-SEC IDs could be mistaken for verified law | Treat examples as illustrative; canonical requirement versions and reviewed aliases only; official corpus missing | ADR-013/028, OPEN-01 |
| Week 4–5 bid needs vendor/risk/incident/report breadth while deeper modules are scheduled later | Permanent basic slices enter B set; complete architecture exists now, later depth has no bid dependency | ADR-029, ROADMAP |
| Numeric epic order places Identity before Tenant while authoritative build order places tenant isolation first | Preserve epic labels but execute dependency/priority order | BUILD_PLAN topological index |
| Evidence graph appears late but tests/compliance need evidence early | Early schema/secure evidence/test links; later graph traversal/history/reporting; no disconnected demo records | ADR-014/019, COMPLIANCE and GRAPH tickets |
| Deletion needs connector execution before continuous assurance phase | Build restricted integration runner prerequisite first; monitoring adapters remain later | CONNECTOR-001→LIFECYCLE-003; assurance separate |
| Master mentions SECURITY.md/DOMAIN.md while user specifies SECURITY_ARCHITECTURE.md/DOMAIN_MODEL.md | Canonical requested names only; no divergent duplicate documents | ARCHITECTURE |
| /deletion namespace vs explicit /deletion-jobs endpoints | Logical domain is deletion; concrete API uses explicit jobs/targets once | API_ARCHITECTURE |
| Immutable evidence/audit vs minimisation/erasure | Immutable within approved retention; holds, minimal pseudonyms, governed purge/anchors/tombstones and restore reconciliation | ADR-012/027/030; OPEN-04 |
| Temporal workflow authority vs revoked human permissions | USER_DELEGATED rechecks current actor; SYSTEM_POLICY requires separate approved scoped service grant | SECURITY/API/WORKFLOW refinements |
| Historical graph corrections could overwrite prior knowledge | Append-only edge assertions, stable identity/revision and known_at selection before valid-time filter | DOMAIN/DATABASE refinements |
| Missing sensitive payload/actor storage definitions | actor_refs, protected_payloads, principal_bindings and platform audit dictionary added; typed references only | DATABASE/API/SECURITY |
| Early auth/grant implementation before audit could expose unaudited changes | Isolated test ports only until AUDIT-001/002; no enabled mutation routes without durable audit, no bypass flag | BUILD_PLAN foundation integration gate |
| Architecture decision vs human critical-area approval | Selected ADRs are baseline engineering choices; crypto/provider/legal/residency/production gates explicitly pending | ADR-018 Proposed; OPEN-01–08 |

No unresolved material product/security contradiction was silently chosen. OPEN decisions are missing deployment/legal/business approvals rather than invented answers. These gates block affected release claims/actions, not the first repository ticket.

## Cross-document invariants reviewed

- Every MASTER initial table (84) appears in DATABASE_SPEC; additional immutable versions, typed edges, actor/payload/approval/job/projection records cover engineering needs.
- All 22 requested modules have owners and ports; authorization is a shared explicit capability. Notices, consent, rights, privacy centre, vendor, risk/DPIA, incidents, lifecycle, audit, notifications, integrations and AI have APIs and state/event contracts.
- All 16 requested actor categories have explicit candidate grants and restrictions; permission registry is default deny with object/field/subject checks.
- RLS covers all tenant tables and composite links; runtime roles cannot bypass ownership; workers/cache/search/files/exports/AI preserve trusted tenant context. SQL-injection and privileged-runtime limitations are documented.
- Graph preserves the full versioned legal→obligation→control→implementation→test→evidence→risk→remediation chain and activity/system/processor links; all eight requested queries have traversal semantics.
- All four deployment profiles share images/contracts, preserve tenant isolation and support portable identity/storage/keys/observability; no cloud-only mandatory runtime dependency.
- Full AI/connector/extension design exists now, while implementation sequence defers automation and AI until prerequisites. No disposable bid schema or security exception.
- Threat matrix includes each requested attack plus legal poisoning, hold race and audit loss, with preventative/detective/recovery controls and verification ownership.

## Validation results and limits

Markdown link existence, required-document presence, MASTER initial-table coverage, ticket uniqueness/dependency existence/cycle detection, bid dependency closure, topological index ordering, all required ticket fields and Markdown-only changes were checked using repository-local read-only validation. A documentation-generation field-count assertion failed before writes during backlog refinement; corrected and rerun, with no partial backlog file update from that failed attempt. No application/security/performance test result is claimed: there is no application yet. No independent reviewer or legal corpus verification occurred in this session.

Before coding each ticket, produce its reviewed exact-file implementation plan and machine-readable operation schemas. The semantic contracts are fixed here; runtime/package versions are intentionally pinned/verified in FOUNDATION-001. Implementers may fill mechanical code details, not change tenant/auth/legal/graph/deployment decisions without ADR review. First assignment: FOUNDATION-001, GPT-6 Sol, branch agent/foundation.

Backlog after coverage review: **119 implementation tickets**, **70 bid-required tickets**, **33 ADRs**. The complete bid set is generated in ROADMAP; all dependencies stay within it.
