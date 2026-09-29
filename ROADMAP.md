# Full-product roadmap and release gates

## Permanent architecture before release sequencing

The full domain, graph, APIs, event/workflow, security, integration, AI and deployment contracts are established in this baseline. Nothing is a disposable bid prototype. Calendar references in MASTER_SPEC are planning aspirations, not justification for omitting reviews or architecture. All enabled functionality must meet AGENTS.md Definition of Done. Release 0.1 is an early Government Bid milestone within the complete product roadmap, not the product's architectural scope.

| Stage | Product outcome | Entry/exit gates |
|---|---|---|
| Architecture baseline (this session) | Complete permanent production design, ADRs, source/approval gaps and executable backlog | Cross-document/spec review; no application implementation |
| Production-quality foundation | Repository, tenant/RLS isolation, identity, deterministic authorization, atomic audit/events, key/secret ports, backup foundation | Tenant escape and role matrix pass; fail-closed audit; independent critical review; no unprotected temporary endpoints |
| Release 0.1 — Government Bid | Compliance dashboard/library/assessment/controls/evidence, inventory/systems/vendors, notice/basic consent, rights/Privacy Centre/grievance, risk/incident registers, audit and reports | All B tickets; synthetic prescribed dataset and five journeys; included-feature tests/accessibility/security; OPEN-01 before legal-labelled content; no assertion of production readiness |
| Release 0.5 — Pilot | DPIA, processor assessment/contracts/subprocessors, federation, nomination/guardian delegation, retention/holds/deletion, deeper breach/notification and regulatory intelligence workflows | P tickets, approved real-person assurance/retention for pilot scope; integration runner contract; controlled customer deployment readiness; no unapproved destructive operations |
| Release 1.0 — Production | Continuous monitoring/connectors, safe AI if approved/enabled, HA/DR, government/customer deployment conformance, audit/support package | F tickets plus implemented scope prerequisites; external assessment/remediation; measured SLO/DR; signed release and human/security approval. AI may stay disabled under policy, without claiming implemented AI acceptance |
| Release 1.5 | Discovery, classification, lineage, advanced deletion scale, government/BFSI/health/EdTech packs | Reviewed observation promotion, provenance, adapter-by-adapter scope and performance tests |
| Release 2.0 | Digital Twin, Privacy CI/CD, advanced regulatory intelligence/advisory agents, Consent Manager interoperability | Pinned graph/policy simulations; same tool/auth gates; approved external protocol/conformance requirements |

The four deployment profiles are designed now. Baseline portability is tested during foundation and pilot; comprehensive HA/disconnected/customer conformance and procurement hardening culminate before production. Government hardening adds assurance and operational maturity, not missing tenant security. Pilot deployment may use a single approved profile while other production profile conformance is completed; do not advertise untested profiles as delivered.

## Exact bid ticket set

FOUNDATION-001, FOUNDATION-002, FOUNDATION-003, FOUNDATION-004, FOUNDATION-005, FOUNDATION-006, TENANT-001, TENANT-002, TENANT-003, IDENTITY-001, IDENTITY-002, IDENTITY-003, AUTHZ-001, AUTHZ-002, AUTHZ-003, AUDIT-001, AUDIT-002, AUDIT-003, AUDIT-004, REGULATORY-001, REGULATORY-002, REGULATORY-003, REGULATORY-004, ATOMIC-001, ATOMIC-002, ATOMIC-003, COMPLIANCE-001, SECURITY-001, COMPLIANCE-002, COMPLIANCE-003, COMPLIANCE-004, COMPLIANCE-005, COMPLIANCE-006, INVENTORY-001, INVENTORY-002, INVENTORY-003, INVENTORY-004, PROCESSING-001, PROCESSING-002, PORTAL-001, PORTAL-002, PORTAL-003, RIGHTS-001, RIGHTS-002, RIGHTS-003, RIGHTS-004, RIGHTS-005, RIGHTS-006, RIGHTS-007, NOTICES-001, NOTICES-002, NOTICES-003, CONSENT-001, CONSENT-002, CONSENT-003, VENDOR-001, VENDOR-002, RISK-001, RISK-002, INCIDENT-001, GRAPH-001, GRAPH-002, REPORT-001, REPORT-002, REPORT-003, HARDEN-001, TENANT-004, TENANT-005, IDENTITY-005, NOTIFY-001.

All dependencies of these tickets are in the same set. Final release requires REPORT-003 **and** HARDEN-001, the common release gates and relevant approvals. The broader backlog includes complete later modules without making their deeper workflows dependencies of the bid. Manual fulfilment is allowed only through the permanent auditable task workflow, never by editing database rows or simulating success.

## Bid acceptance script

Use fictional “Rajasthan Citizen Services Department”, 50,000 synthetic principals, 25 systems, 18 processors, 42 activities, 85 fields, 150 controls, 12 open risks, 6 requests and 2 incidents. Controls may be synthetic fixtures for structural testing; approved legal-labelled controls require source review and cannot be invented to reach 150. Clearly distinguish fixture IDs from canonical IN-DPDP legal IDs. The optional demo hostname is configuration requiring owner DNS authorization; this session does not register it.

Citizen reads Hindi/English notice, authenticates, submits access/correction and receives tracking. DPO sees scoped identity/activity/system/processor/tasks, assigns, approves and closes after delivery. Auditor traverses rule/requirement/control/test/evidence/activity with provenance. CISO sees source-version-selected Rule 6 mapping (only after verified corpus), evidence freshness, failed control/risk/remediation. Executive sees scoped aggregate programme/risks/rights/breach-readiness/evidence status. No persona receives permissions merely to make a demo work.

## Human decisions and missing inputs

OPEN-01 official corpus/legal mappings; OPEN-02 key/secret/cryptography profile; OPEN-03 residency/hosting/procurement; OPEN-04 retention and holds; OPEN-05 identity/guardian/nominee assurance; OPEN-06 load/SLO/RPO/RTO/budget; OPEN-07 AI providers/data terms; OPEN-08 release authority/independent assessment. ARCHITECTURE.md specifies safe defaults and exact affected gates. Foundation work can begin after its implementation-plan review while these decisions are resolved in parallel; legal assertions and production acceptance cannot bypass them.
