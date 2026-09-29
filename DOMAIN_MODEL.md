# Domain model and Compliance Evidence Graph

## Invariants

Tenant is the security boundary; organisation/legal entity/business unit/department are delegated operating scopes within it. A user may have memberships in multiple tenants but one active verified tenant context per request. A principal is a tenant-local subject reference, separate from an employee user. Credential identity belongs in Keycloak; domain identity maps issuer+subject to local IDs. A processor is a role of a vendor within a tenant, not a global vendor account.

Regulatory corpus is global, published, non-customer data; tenant applicability, obligations, implementations, assessments and evidence are tenant-owned. Controls are tenant-owned instantiated versions linked to a published requirement version and optional shared control template. No tenant writes shared law. Tenant custom guidance is explicitly classified as IMPLEMENTATION_CONTROL or RECOMMENDED_GOOD_PRACTICE, never fabricated LEGAL_REQUIREMENT.

Every published definition is immutable. Stable identities (regulation/provision/requirement/control family) and immutable versions are distinct. Effective time (what applies) and recorded time (what the system knew) are separate. Corrigenda, commencement instruments, amendments, repeals and supersession link versions; never overwrite historical tests or consent receipts. Decisions pin their source version, facts version, policy version and evaluation time.

## Structural legal-to-action chain

Regulation → RegulationVersion → Provision → ProvisionVersion → RequirementVersion (stable requirement code) → RequirementApplicability → Obligation → Control → EvidenceRequirement → ControlImplementation → ControlTest → TestEvidence → EvidenceVersion → RiskLink → Risk → RemediationTask.

ApplicabilityRule is a reviewed reusable predicate; RequirementApplicability is a tenant decision with APPLICABLE/NOT_APPLICABLE/UNKNOWN, rationale and reviewer. An Obligation materializes an applicable requirement for a legal entity/activity/scope and interval. An implementation applies a specific control version to a specific system/activity with an accountable owner. Test definition and test execution are separate. Evidence requirement defines type, freshness and sufficiency criteria; a file alone does not establish pass/compliance.

MASTER_SPEC's Rule 6 and DPDP-SEC examples remain illustrative until approved corpus exists. IN-DPDP-* codes are stable legal-reference identifiers; aliases (such as DPDP-SEC-003) map explicitly to canonical requirements and never imply equivalence by string matching. Full taxonomy: GOV, APP, LPU, NOT, CON, CMI, ACC, SEC, BRE, RET, DEL, CTC, CHD, GRD, SDF, DPA, COR, ERS, GRV, NOM, DUT, XBR, EXM, PRC, DPI, AUD, ALG, REG. The 150–250 target is a coverage planning target, not permission to manufacture obligations.

## Graph is relational and first-class

Authoritative graph edges are typed join tables with foreign keys, tenant constraints, provenance, valid_from/valid_to and recorded_at. No unvalidated `(entity_type, entity_id)` bag is the authoritative graph. Resource IDs used in audit are references for history, not integrity substitutes. Optional graph/search projections are derived and reconstructible; authorization is checked before traversal and before returning each node/edge.

Edges: requirement_controls, obligation_controls, control_implementations, implementation_systems, implementation_activities, evidence_requirement_controls, test_evidence, evidence_activities, activity_purposes, activity_data_elements, element_categories, system_data_elements, processing_systems, processing_processors, flow_activities, flow_processors, control_risks, activity_risks, system_risks, evidence_risks, risk_remediations. Each records linking actor, reason/source and effective interval. Cardinality is many-to-many unless the entity dictionary says otherwise. EvidenceRequirement belongs to one control; implementation is linked to one control and one obligation; shared evidence may support multiple tests only through explicit test_evidence links.

| Question | Deterministic traversal / semantics |
|---|---|
| Which controls implement Rule 6? | Selected regulation version → provision_version with reviewed locator → requirement_versions → requirement_controls → tenant controls. Return version and applicability; no hard-coded R06 filter in business logic. |
| Which controls lack evidence? | Applicable active implementations → control evidence_requirements LEFT/ANTI JOIN qualifying current accepted evidence versions via tests. Missing, expired, quarantined, superseded and failed-test evidence are distinct statuses. |
| Which activities are affected by a failed control? | Failed control_tests → implementation_activities; also implementation_systems → processing_systems. Return direct vs inferred impact path. |
| Which systems process Aadhaar-related data? | Approved category label/code → element_categories → system_data_elements and activity_data_elements → processing_systems. Store classification metadata, not Aadhaar numbers. |
| Which processors participate? | Above activities → processing_processors → processor_services; include data_flows/subprocessor paths with cycle/hop limits. |
| Which risks arise from failed controls? | control_tests → findings → control_risks/risk source reference. Distinguish proposed from accepted risk; avoid automatic causal claims. |
| Which remediation tasks are open? | risk_remediations → remediation_tasks excluding CLOSED/CANCELLED with scope and due-state filtering. |
| Why does a control exist? | control → obligation_controls and requirement_controls → immutable requirement/provision/source citation. Return guidance classification and approval provenance. |

`as_of` answers use valid-time intervals and pinned immutable versions. `known_at` additionally filters recorded-time; corrections append superseding records. Edge identities have assertion revisions; as-of queries select the latest assertion known at the requested recorded time before applying the valid interval (DATABASE_SPEC). All traversal limits apply to each request and exports; missing permissions redact paths without leaking hidden labels/counts. Graph metadata includes observed_at and source reliability. A failed control does not automatically establish an incident, legal violation or statutory duty.

## Other aggregate contracts

- ProcessingActivity: versioned purpose, lawful-ground reference, data/category/subject scopes, systems, processors, flows, geography, retention policy and accountable owner. Ground/exemption references are reviewed data, not arbitrary labels proving legality.
- Notice: stable identity, immutable published version, translations pinned to content digest, mapped purposes/categories, audience/channel and publication interval. Material changes never mutate a consent's notice reference.
- Consent: append-only decision events partitioned by tenant/principal/purpose. Receipt pins notice version, scope, channel, actor/delegation proof, event sequence and recorded/effective time. Withdrawal is a new event. Current state is a reconstructible projection with concurrency control.
- RightsRequest: request type, verified subject/delegation, scoped tasks and immutable response versions. Access/correction/erasure, grievance and nomination have explicit workflows. Legal rejection requires authorized human review and a cited basis; no AI decision.
- Vendor/Processor: services, processing relationships, contracts and subprocessors with effective intervals; assessment/approval does not certify compliance.
- Assessment/DPIA: immutable questionnaire versions, typed answers, findings, risk links, reviewers and approval history. Significant change creates a revision/reassessment.
- Incident: timeline, scoped affected metadata/principal references, human breach determination and parallel notification tracks (DPDP/CERT-In/sector/contractual). Deadlines come only from approved rule versions; unknown deadlines visibly require legal review.
- Retention/Deletion: approved policy version evaluates due candidates; legal holds and exceptions block execution. A deletion job has independently retryable targets and proof. Partial completion is never COMPLETE. Restore reconciliation prevents resurrecting deleted data.
- Evidence: immutable versions and custody history, checksum, classification, origin, capture time, scan state, retention, expiry, provenance and legal hold. Access is separate from evidence metadata access.
- Audit: append-only transactionally captured security/compliance history, externally anchored integrity, authorized review. Redaction/pseudonymization policy is designed before collection; audit is not an excuse to retain raw personal data indefinitely.

## Data minimisation and extensions

Principal-system references store opaque subject handles and category-presence metadata; connector-side retrieval is preferred to copying source datasets. Verification stores method, assurance, result and provider reference; raw documents require separately approved necessity/retention and restricted evidence classification. Children/guardians/nominees are scoped relationships with verification, expiry/revocation and permitted actions; a relationship cannot give broad tenant access.

Future discovery assets/classifications/lineage observations are proposals with confidence and evidence; a human or deterministic approved policy promotes them to authoritative inventory. Simulation snapshots never write live controls. Privacy CI/CD evaluation returns versioned findings against an approved policy bundle; AI cannot approve deployments or policy exceptions.

## International and sector extension semantics

Jurisdiction packs carry territorial scope, legal-entity applicability, effective date semantics, language, source authority, legal-ground vocabulary and deadlines as reviewed data. Core request types remain extensible via registered typed schemas/state machines; a new jurisdiction may add a request kind without changing ownership or authorization. One activity/control can relate to multiple obligations from different regimes; report results separately and preserve conflict/escalation, never pick the easiest jurisdiction. Cross-border transfer assessments, children/guardian safeguards, SDF assessments, algorithmic due diligence and regulatory proceedings use typed assessment templates plus source-version references; no pack silently declares an exemption or special status. New executable workflow semantics require an ADR/contract change, not arbitrary tenant script.
