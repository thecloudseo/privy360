# PRIVY360
## Autonomous Build Execution Manual
### Master Product + Legal + Engineering + Security Specification v2.0

**Status:** BUILD AUTHORITY  
**Purpose:** This document is the operating manual for autonomous coding agents and human reviewers building Privy360.

---

# PART I — THE BUILD PHILOSOPHY

## 1. The rule from now on

Privy360 will not be built by asking AI agents to:

> Build a DPDP compliance platform.

It will be built through a controlled autonomous engineering system.

The hierarchy is:

**Master Specification**

→ Product Requirements

→ Legal Requirements

→ Domain Model

→ Security Architecture

→ Epics

→ User Stories

→ Acceptance Criteria

→ Autonomous Implementation

→ Automated Verification

→ Independent Agent Review

→ Human/Security Gate

→ Merge.

AI writes most of the software.

AI does **not** determine whether the software is ready for production.

---

# PART II — SOURCE OF TRUTH

## 2. Create the repository first

Repository:

`privy360`

Structure:

```text
privy360/
│
├── apps/
│   ├── web/
│   ├── api/
│   ├── privacy-centre/
│   ├── worker/
│   └── docs/
│
├── packages/
│   ├── ui/
│   ├── database/
│   ├── auth/
│   ├── regulatory/
│   ├── workflows/
│   ├── audit/
│   ├── integrations/
│   ├── security/
│   ├── notifications/
│   └── ai/
│
├── regulations/
│   └── india/
│       └── dpdp/
│           ├── act-2023/
│           ├── rules-2025/
│           ├── corrigenda/
│           ├── notifications/
│           ├── controls/
│           └── evidence/
│
├── specs/
│   ├── product/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── security/
│   ├── ux/
│   ├── workflows/
│   └── acceptance/
│
├── infra/
│   ├── docker/
│   ├── terraform/
│   ├── kubernetes/
│   └── helm/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── security/
│   ├── tenancy/
│   └── regulatory/
│
├── scripts/
├── docs/
└── AGENTS.md
```

---

# PART III — AGENT TEAM

## 3. Our virtual engineering organisation

We will operate AI agents as if they were members of an engineering team.

### Agent A — Chief Architect

**Model:** GPT-6 Astra  
**Reasoning:** xhigh/max for architecture.

Responsibilities:

- maintain architectural integrity;
- review domain boundaries;
- approve schema changes;
- review security-sensitive components;
- resolve cross-module conflicts;
- review final PRs.

Astra currently supports up to a 1.05M-token context window and 128K output, making it suitable for retaining large portions of the specification/repository context.

---

### Agent B — Primary Implementation Engineer

**Model:** GPT-6 Sol through Codex.

Responsibilities:

- backend implementation;
- frontend implementation;
- tests;
- database migrations;
- APIs;
- refactoring.

OpenAI currently recommends the latest general-purpose models such as GPT-6 Sol for most Codex software-engineering work.

---

### Agent C — Secondary Implementation / Review

**Model:** Claude Sonnet 5.5.

Responsibilities:

- independent code review;
- frontend refinement;
- test creation;
- bug fixing;
- alternative implementation review.

Anthropic positions Sonnet 5.5 as the faster/lower-cost member of its 5.5 family for well-scoped everyday work, debugging and implementation.

---

### Agent D — Adversarial Reviewer

**Model:** Claude Opus 5.5 or GPT-6 Astra in a fresh context.

Responsibilities:

- try to break assumptions;
- identify missing authorization;
- challenge schema;
- inspect race conditions;
- review security-sensitive PRs;
- look for missing DPDP workflows.

This agent must not receive the primary implementation agent's reasoning.

It reviews the actual specification and code independently.

---

### Agent E — Browser/QA Agent

**Platform:** Google Antigravity  
**Model:** Gemini 3.5 Flash.

Responsibilities:

- navigate running application;
- execute end-to-end flows;
- screenshot inconsistencies;
- verify UI states;
- reproduce bugs;
- perform repetitive browser testing.

Google describes Gemini 3.5 Flash as supporting long-horizon agentic work and Antigravity as its agent-first development platform; Gemini 3.5 Flash also includes computer-use functionality.

---

### Agent F — Security Agent

**Models:** Astra + deterministic tools.

Responsibilities:

- threat modelling;
- SAST findings;
- dependency vulnerabilities;
- tenant-isolation testing;
- API authorization review;
- abuse testing.

No model's opinion constitutes security approval.

---

# PART IV — AGENTS.md

## 4. The file every autonomous agent must read

Create:

`/AGENTS.md`

Contents:

```text
You are working on Privy360, an enterprise DPDP Compliance Operating System.

NON-NEGOTIABLE RULES:

1. Never weaken authentication or authorization to make tests pass.
2. Every business object belongs to an explicit tenant.
3. Every API accessing tenant data must enforce tenant context.
4. Never trust tenant_id supplied by the browser.
5. Every sensitive resource requires object-level authorization.
6. Never expose personal data in logs.
7. Never send production personal data to an external LLM.
8. Every sensitive mutation creates an audit event.
9. Every DB schema change requires a migration.
10. Every feature requires automated tests.
11. Every regulatory feature must reference a regulatory requirement ID.
12. Never invent DPDP requirements.
13. Never claim Privy360 certifies an organisation as legally compliant.
14. AI may recommend; deterministic application logic controls authorization.
15. AI may not autonomously reject a Data Principal request.
16. AI may not autonomously determine a statutory exemption.
17. AI may not autonomously send breach notification to a regulator.
18. Never bypass failing security gates.
19. Do not delete failing tests to complete a task.
20. Ask the Chief Architect agent to resolve specification contradictions.

SECURITY ORDER:
Authorization > integrity > privacy > availability > convenience.

QUALITY RULE:
A feature is incomplete until:
- acceptance criteria pass;
- unit tests pass;
- integration tests pass;
- authorization tests pass;
- audit events exist;
- documentation exists.
```

---

# PART V — REGULATION ENGINE

## 5. Never encode DPDP requirements directly into UI code

The official regulatory sources must be imported as versioned regulatory artefacts.

The foundation is:

**Digital Personal Data Protection Act, 2023**

+

**Digital Personal Data Protection Rules, 2025**

+

**2025 corrigendum**

+

**commencement/enforcement notifications**

+

future amendments.

MeitY currently publishes the final Rules, corrigendum and enforcement timeline together.

---

# PART VI — MACHINE-READABLE LEGAL MODEL

## 6. Regulatory schema

Create these entities:

```text
Regulation
RegulationVersion
Provision
ProvisionVersion
Requirement
RequirementApplicability
Obligation
Control
ControlImplementation
EvidenceRequirement
Evidence
ControlTest
RegulatorySource
RegulatoryChange
RegulatoryImpact
Exemption
```

---

## 7. Requirement ID format

Use:

```text
IN-DPDP-ACT-S04-001
IN-DPDP-ACT-S05-001
IN-DPDP-ACT-S06-001
IN-DPDP-R03-001
IN-DPDP-R06-001
IN-DPDP-R07-001
```

Never use database integers as legal identifiers.

---

# PART VII — ATOMIC CONTROL MODEL

## 8. Required atomic decomposition

A legal provision must be broken into implementable requirements.

Example:

Instead of:

```text
Rule 6 — Security Safeguards
```

create individual requirements such as:

```text
DPDP-SEC-001
Protect personal data using appropriate technical controls.

DPDP-SEC-002
Support encryption or equivalent protective techniques where applicable.

DPDP-SEC-003
Implement access-control measures.

DPDP-SEC-004
Maintain visibility over access through appropriate logging.

DPDP-SEC-005
Implement monitoring capable of identifying unauthorised access.

DPDP-SEC-006
Maintain appropriate backup/resilience measures.

DPDP-SEC-007
Require processors to maintain contractual security safeguards.

DPDP-SEC-008
Maintain relevant security records for required periods.

DPDP-SEC-009
Maintain organisational security measures.

DPDP-SEC-010
Maintain procedures to respond to personal-data breaches.
```

Each atomic requirement maps to:

```text
Legal provision
Control
Implementation guidance
Evidence requirements
Applicable systems
Control owner
Testing method
Testing frequency
Current status
Risk
```

---

# PART VIII — DPDP CONTROL FAMILIES

## 9. Complete top-level control taxonomy

The first control library must contain at least these families:

```text
GOV  Governance
APP  Applicability
LPU  Lawful Purpose / Legitimate Use
NOT  Notice
CON  Consent
CMI  Consent Manager Interoperability
ACC  Accountability
SEC  Security
BRE  Personal Data Breach
RET  Retention
DEL  Erasure / Deletion
CTC  Privacy Contact
CHD  Children
GRD  Guardian
SDF  Significant Data Fiduciary
DPA  Data Principal Access
COR  Correction / Completion / Updating
ERS  Erasure Rights
GRV  Grievance
NOM  Nomination
DUT  Data Principal Duties
XBR  Cross-Border Transfer
EXM  Exemptions
PRC  Processor Governance
DPI  DPIA
AUD  Audit
ALG  Algorithmic Due Diligence
REG  Regulatory Request / Proceedings
```

Target:

**150–250 atomic controls for v1.**

Not 25.

---

# PART IX — LEGAL QA TEST

## 10. Automated legal traceability test

Every control must pass:

```text
control.regulatory_source != null
control.requirement_id != null
control.version != null
control.effective_from != null
control.applicability_rule != null
control.evidence_requirements.length >= 1
```

CI fails if traceability breaks.

---

# PART X — DOMAIN MODEL

## 11. Core graph

The canonical Privy360 graph is:

```text
Regulation
    ↓
Requirement
    ↓
Control
    ↓
Evidence
    ↓
Processing Activity
    ↓
Purpose
    ↓
Personal Data Category
    ↓
Data Element
    ↓
System
    ↓
Processor
    ↓
Data Flow
    ↓
Retention Rule
```

Parallel entities:

```text
Data Principal
Consent
Notice
Rights Request
Risk
Incident
Assessment
Task
Audit
```

---

# PART XI — DATABASE MODEL

## 12. Initial tables

### Identity

```text
tenants
organisations
legal_entities
business_units
departments
users
groups
roles
permissions
role_permissions
user_roles
service_accounts
sessions
```

### Regulatory

```text
regulations
regulation_versions
provisions
provision_versions
requirements
obligations
applicability_rules
controls
control_mappings
evidence_requirements
regulatory_changes
```

### Governance

```text
processing_activities
purposes
data_categories
data_elements
data_subject_categories
systems
data_sources
data_flows
processing_systems
processing_processors
```

### Consent

```text
notices
notice_versions
notice_translations
consent_purposes
consent_events
consent_receipts
preference_profiles
```

### Rights

```text
data_principals
rights_requests
identity_verifications
rights_tasks
rights_responses
rights_request_events
nominations
grievances
```

### Risk

```text
risks
assessments
assessment_answers
dpias
findings
remediation_tasks
exceptions
```

### Third Party

```text
vendors
processors
processor_services
processor_contracts
processor_assessments
subprocessors
```

### Incident

```text
incidents
breach_assessments
affected_data
affected_principals
notifications
incident_actions
```

### Lifecycle

```text
retention_policies
retention_rules
deletion_jobs
deletion_targets
deletion_confirmations
legal_holds
```

### Assurance

```text
evidence
control_tests
audits
audit_findings
audit_events
```

### Integration

```text
connectors
connector_credentials
connector_runs
webhooks
webhook_deliveries
```

---

# PART XII — TENANCY

## 13. Every tenant record

Every tenant-owned table contains:

```text
id UUID
tenant_id UUID
created_at
created_by
updated_at
updated_by
version
```

Database-level safeguards must supplement application logic.

For PostgreSQL SaaS deployments, use Row Level Security where appropriate.

Tenant isolation tests are mandatory.

---

# PART XIII — AUTHORIZATION

## 14. Authorization equation

Access decision:

```text
User
+
Role
+
Permission
+
Tenant
+
Business Unit
+
Resource Ownership
+
Resource Sensitivity
+
Action
+
Policy
=
ALLOW / DENY
```

Default:

**DENY.**

---

# PART XIV — CORE APIs

## 15. API namespaces

```text
/api/v1/auth
/api/v1/organisations
/api/v1/regulations
/api/v1/controls
/api/v1/evidence
/api/v1/processing-activities
/api/v1/data-inventory
/api/v1/notices
/api/v1/consents
/api/v1/preferences
/api/v1/data-principals
/api/v1/rights-requests
/api/v1/grievances
/api/v1/nominations
/api/v1/vendors
/api/v1/processors
/api/v1/risks
/api/v1/dpias
/api/v1/incidents
/api/v1/retention
/api/v1/deletion
/api/v1/audits
/api/v1/tasks
/api/v1/reports
/api/v1/connectors
/api/v1/ai
```

All APIs documented using OpenAPI.

---

# PART XV — EVENT MODEL

## 16. Domain events

The system must become event-capable early.

Examples:

```text
ConsentGranted
ConsentWithdrawn
NoticePublished
RightsRequestSubmitted
RightsRequestVerified
RightsRequestCompleted
GrievanceSubmitted
ProcessingActivityCreated
ProcessorAdded
RetentionTriggered
DeletionRequested
DeletionCompleted
IncidentDeclared
PersonalDataBreachConfirmed
EvidenceUploaded
ControlFailed
RiskCreated
RegulationChanged
```

---

# PART XVI — UI MAP

## 17. Initial application screen inventory

### Authentication

1. Login
2. MFA
3. Password recovery
4. SSO redirect

### Onboarding

5. Organisation setup
6. Legal entities
7. Business units
8. DPDP applicability
9. Initial readiness
10. User invitation

### Command Centre

11. Executive dashboard
12. DPO dashboard
13. Security dashboard

### Regulatory

14. Regulatory library
15. Act viewer
16. Rule viewer
17. Requirement detail
18. Control detail
19. Regulatory changes

### Compliance

20. Readiness assessment
21. Control library
22. Control implementation
23. Evidence viewer
24. Evidence upload
25. Findings
26. Remediation tasks

### Data Governance

27. Processing inventory
28. Processing activity detail
29. Data catalogue
30. Systems
31. Data source detail
32. Data flow map
33. Purpose catalogue

### Consent

34. Consent dashboard
35. Purpose manager
36. Notice list
37. Notice editor
38. Notice version comparison
39. Consent records
40. Consent receipt
41. Preference configuration

### Rights

42. Rights dashboard
43. Rights queue
44. Request detail
45. Identity verification
46. Fulfilment workflow
47. Grievance queue
48. Nomination management

### Privacy Centre

49. Privacy home
50. Privacy notices
51. My consent
52. My requests
53. Request submission
54. Request tracking
55. Correction
56. Erasure
57. Grievance
58. Nomination
59. Privacy contact

### Vendors

60. Vendor list
61. Vendor detail
62. Processor assessment
63. Subprocessor map

### Risk/DPIA

64. Risk register
65. Risk detail
66. DPIA list
67. DPIA wizard

### Incidents

68. Incident dashboard
69. Incident detail
70. Breach assessment
71. Notification workflow
72. Incident timeline

### Retention

73. Retention policies
74. Retention rule editor
75. Deletion queue
76. Deletion proof

### Audit

77. Audit dashboard
78. Audit plan
79. Audit evidence pack
80. Audit trail.

Initial design target:

**80 primary screens.**

---

# PART XVII — BUILD ORDER

## 18. Sprint Zero — Foundation

Do this before product modules.

Build:

- monorepo;
- frontend;
- API;
- PostgreSQL;
- Redis;
- migrations;
- Docker;
- Keycloak;
- tenant model;
- authentication;
- MFA;
- RBAC/ABAC;
- audit service;
- logging;
- health endpoints;
- CI/CD;
- security scanners.

Nothing else proceeds until tenant isolation and authorization pass.

---

# PART XVIII — AUTONOMOUS WORKFLOW

## 19. Every development ticket follows this cycle

### Step 1 — Architect

Astra reads:

- master specification;
- module specification;
- related schema;
- current architecture.

Astra creates:

`IMPLEMENTATION_PLAN.md`

No coding.

---

### Step 2 — Challenge plan

Independent reviewer checks:

- missing authorization;
- missing audit logging;
- bad domain assumptions;
- missing tests;
- DPDP mismatch.

---

### Step 3 — Implement

GPT-6 Sol/Codex receives approved implementation plan.

It may modify only declared areas unless dependency changes are documented.

---

### Step 4 — Automated checks

Run:

```text
lint
typecheck
unit tests
integration tests
authorization tests
tenant-isolation tests
SAST
SCA
secret scan
```

---

### Step 5 — Adversarial review

Claude Opus/Astra reviews Git diff.

Review specifically for:

```text
BOLA / IDOR
broken tenancy
mass assignment
SQL injection
XSS
CSRF
race conditions
unsafe deserialization
secret exposure
PII logs
authorization bypass
audit bypass
SSRF
path traversal
unsafe file upload
```

---

### Step 6 — Browser verification

Antigravity executes acceptance flow against staging.

---

### Step 7 — Final architect review

Only then merge.

---

# PART XIX — MASTER AGENT PROMPT

## 20. Prompt used to initialise Astra

```text
You are the Chief Architect and Lead Autonomous Engineer for Privy360.

Privy360 is an enterprise-grade Digital Personal Data Protection compliance operating system focused initially on India's Digital Personal Data Protection Act, 2023 and Digital Personal Data Protection Rules, 2025.

Your objective is not merely to generate software.

Your objective is to implement the repository according to the supplied Master Specification while preserving:

1. legal traceability;
2. tenant isolation;
3. enterprise security;
4. auditable operations;
5. modular architecture;
6. testability;
7. government deployment readiness.

YOU MUST:

- read AGENTS.md before making any change;
- inspect existing architecture before implementing;
- produce an implementation plan before coding;
- reference requirement IDs for regulatory functionality;
- enforce tenant context server-side;
- enforce object-level authorization;
- generate audit events for sensitive mutations;
- write tests before considering work complete;
- never weaken security controls to make tests pass;
- never put secrets into source code;
- never expose production personal data to an LLM;
- never invent legal requirements;
- never describe an automated score as official legal compliance certification.

When a requirement is ambiguous:
1. inspect the Master Specification;
2. inspect regulatory source data;
3. choose the safest architecturally reversible implementation;
4. document the assumption.

For every task produce:

IMPLEMENTATION PLAN
FILES TO MODIFY
DATABASE CHANGES
API CHANGES
AUTHORIZATION RULES
AUDIT EVENTS
TEST PLAN
SECURITY CONSIDERATIONS
IMPLEMENTATION
VERIFICATION RESULTS

Do not mark work complete if any mandatory check fails.
```

---

# PART XX — FEATURE PROMPT TEMPLATE

## 21. Every module prompt

Example:

```text
TASK: Implement Data Principal Access Request workflow.

REGULATORY REFERENCES:
IN-DPDP-ACT-S11-001
IN-DPDP-R14-001

USER:
Data Principal.

GOAL:
Allow verified Data Principals to submit access requests and allow authorised tenant personnel to fulfil them.

REQUIRED WORKFLOW:
SUBMITTED
→ IDENTITY_PENDING
→ VERIFIED
→ DISCOVERY
→ FULFILMENT
→ REVIEW
→ APPROVED
→ RESPONDED
→ CLOSED.

PERMISSIONS:
Data Principal may access only own request.
DPO may view tenant requests.
Business owner may view tasks assigned to authorised business units.
Auditor may view metadata/evidence but cannot modify.

AUDIT EVENTS:
RightsRequestSubmitted
IdentityVerificationCompleted
RightsRequestAssigned
RightsRequestApproved
RightsRequestResponded
RightsRequestClosed.

SECURITY:
Prevent request-ID enumeration.
Rate limit public submission.
Never expose another Data Principal's data.
Encrypt uploaded identity evidence.
Do not write identity evidence into logs.

ACCEPTANCE:
All API, UI, audit, security and workflow tests pass.
```

This is how agents are used.

Never:

> "Make the rights module."

---

# PART XXI — BUILD SEQUENCE

## 22. Week 1 — Platform foundation

Deliver:

### Days 1–2

Repository  
Docker  
PostgreSQL  
Redis  
Keycloak  
CI/CD  
secret management.

### Days 3–4

Tenant hierarchy  
users  
roles  
permissions  
RBAC  
ABAC.

### Day 5

Audit subsystem  
security logging  
test framework  
API framework.

Acceptance:

A malicious user belonging to Tenant A cannot retrieve Tenant B objects even if IDs are known.

---

# PART XXII — WEEK 2

## 23. Regulatory + Compliance Engine

Build:

- regulation database;
- provisions;
- atomic requirements;
- controls;
- evidence requirements;
- applicability rules;
- control implementation;
- assessments;
- evidence upload;
- remediation tasks.

Import initial DPDP corpus.

Privy360 can now answer:

> Which controls implement Rule 6?

---

# PART XXIII — WEEK 3

## 24. Data Governance

Build:

- processing activities;
- purposes;
- data categories;
- systems;
- processors;
- data flows;
- retention metadata;
- lawful-ground mapping.

Implement Processing Activity wizard.

Output:

**Processing Inventory**

and

**Data Map.**

---

# PART XXIV — WEEK 4

## 25. Privacy Centre + Rights

This is the government-bid differentiator.

Build:

`privacy.clientdomain.com`

Features:

- notice publication;
- authentication;
- access request;
- correction;
- erasure;
- grievance;
- nomination;
- tracking;
- privacy contact.

Build white-labelling and CNAME support.

---

# PART XXV — WEEK 5

## 26. Notice + Consent

Build:

Notice editor  
versions  
translations  
purpose mapping  
publication.

Consent:

Consent SDK  
Consent API  
Consent ledger  
withdrawal  
preference centre  
receipt.

Consent data model:

```text
WHO
WHAT DATA
WHICH PURPOSE
WHICH NOTICE
WHICH VERSION
WHICH CHANNEL
WHEN
WHAT ACTION
CURRENT STATE
```

---

# PART XXVI — WEEK 6

## 27. Vendor + Risk + DPIA

Build:

Vendor inventory  
processor inventory  
contracts  
subprocessors  
assessment engine  
risk register  
DPIA workflow  
findings.

---

# PART XXVII — WEEK 7

## 28. Breach Command Centre

Build:

Incident intake  
breach determination  
affected data  
affected Data Principals  
processor involvement  
timeline  
notification workflows  
regulatory timers  
remediation.

Include parallel compliance tracks where applicable:

```text
DPDP
CERT-In
Sector Regulator
Contractual Notification
```

---

# PART XXVIII — WEEK 8

## 29. Retention + Deletion

Build:

Retention policies  
triggers  
exceptions  
legal holds  
deletion workflow  
downstream tasks  
proof.

Deletion API:

```text
POST /deletion-jobs
GET /deletion-jobs/:id
POST /deletion-jobs/:id/targets
POST /deletion-targets/:id/confirm
```

---

# PART XXIX — WEEK 9

## 30. Regulatory intelligence

Build:

regulatory change ingestion;

version comparison;

requirement impact;

affected controls;

tenant impact;

remediation suggestion.

---

# PART XXX — WEEK 10

## 31. Continuous assurance

Build initial control connectors.

Examples:

IAM → MFA check.

AWS/Azure → encryption configuration.

Backup system → backup success.

SIEM → logging status.

Each produces machine evidence.

---

# PART XXXI — WEEK 11

## 32. AI Copilot

Only now.

Never before the compliance graph exists.

Architecture:

```text
User
↓
API
↓
Authorization
↓
AI Gateway
↓
Data Policy
↓
Redaction
↓
Context Retrieval
↓
LLM
↓
Tool Policy
↓
Application Service
```

Never:

```text
LLM → Production Database
```

---

# PART XXXII — WEEK 12

## 33. Government hardening

Focus entirely on:

- access control;
- session security;
- deployment;
- monitoring;
- backup;
- recovery;
- accessibility;
- audit documentation;
- VA/PT;
- performance;
- support documentation.

No major product scope introduced.

---

# PART XXXIII — BID BUILD

## 34. First sellable version

The government bid release does **not** wait for Week 12.

A polished bid build exists at approximately Week 4–5 containing:

```text
Compliance Dashboard
Regulatory Library
DPDP Assessment
Controls
Evidence
Processing Inventory
Systems
Vendors
Notice Management
Basic Consent
Rights Management
Privacy Centre
Grievance
Risk
Incident Register
Audit Trail
Reports
```

Advanced automation remains progressively enabled.

---

# PART XXXIV — GOVERNMENT DEMO

## 35. Demo dataset

Create fictional entity:

**Rajasthan Citizen Services Department**

Never use real citizen records.

Seed:

50,000 synthetic Data Principals  
25 systems  
18 processors  
42 processing activities  
85 data fields  
150 controls  
12 open risks  
6 rights requests  
2 fictional incidents.

---

## 36. Demo flow

### Citizen

Open:

`privacy.demo.privy360.in`

Hindi/English notice.

Authenticate.

Ask:

> What personal data do you process about me?

Receive tracking number.

Submit correction.

---

### DPO

Open request.

See:

Identity  
Processing Activities  
Systems  
Processors  
Tasks.

Assign fulfilment.

Approve response.

Close.

---

### Auditor

Open:

Rule → requirement → control → test → evidence → activity.

---

### CISO

Open Rule 6.

See:

security controls;

evidence freshness;

failed control;

associated risk;

remediation.

---

### Executive

See:

Compliance programme  
Top risks  
Rights requests  
Breach readiness  
Evidence status.

---

# PART XXXV — SECURITY PIPELINE

## 37. Mandatory tools

Every PR runs:

```text
ESLint
TypeScript compiler
Vitest/Jest
Playwright
Semgrep
CodeQL
Trivy
Gitleaks
OWASP Dependency-Check / ecosystem equivalent
npm audit / pnpm audit
Checkov
Docker image scanning
SBOM generation
```

Use independent DAST for staging.

---

# PART XXXVI — TENANT ESCAPE TEST SUITE

## 38. Mandatory negative tests

For every tenant resource:

Create:

Tenant A user  
Tenant B resource.

Attempt:

GET  
POST  
PATCH  
DELETE  
export  
search  
filter  
Graph/query traversal.

Every action must return:

`403`

or equivalent non-disclosing response.

Run this automatically for every tenant-aware endpoint.

---

# PART XXXVII — AI SECURITY TESTS

## 39. Copilot attack suite

Test:

Prompt injection.

Indirect prompt injection.

Cross-tenant extraction.

Hidden-system-prompt requests.

Unauthorized tool calling.

SQL requests.

PII extraction.

Privilege escalation.

Evidence manipulation.

Delete requests.

Regulatory hallucination.

The LLM cannot bypass application permissions.

---

# PART XXXVIII — FILE UPLOAD SECURITY

## 40. Evidence uploads

Pipeline:

```text
Upload
→ MIME detection
→ extension validation
→ size validation
→ malware scan
→ isolate
→ encrypt
→ object storage
→ checksum
→ evidence metadata.
```

Never serve arbitrary uploaded content from the application origin.

---

# PART XXXIX — IMMUTABLE AUDIT

## 41. Audit event structure

```json
{
  "event_id": "uuid",
  "tenant_id": "uuid",
  "actor": "uuid",
  "action": "RIGHTS_REQUEST_APPROVED",
  "resource_type": "rights_request",
  "resource_id": "uuid",
  "timestamp": "...",
  "ip": "...",
  "correlation_id": "...",
  "previous_hash": "...",
  "event_hash": "..."
}
```

Hash chaining may be used to make tampering detectable.

Do not market ordinary audit logging as blockchain unless an actual blockchain design is implemented.

---

# PART XL — EVIDENCE GRAPH

## 42. This is our moat

Example:

```text
DPDP Rule 6
↓
Requirement DPDP-SEC-003
↓
Control IAM-001
↓
System HRMS
↓
Implementation Keycloak
↓
Test MFAEnabled
↓
Result PASS
↓
Evidence API snapshot
↓
Timestamp
↓
Owner CISO
```

No competitor comparison matters if Privy360 executes this exceptionally well.

---

# PART XLI — COMPLIANCE SCORE

## 43. Never create a misleading legal score

We may calculate:

**Operational Readiness Index**

based on:

control implementation;

control testing;

evidence freshness;

risk;

overdue remediation.

Display:

> Privy360 Operational Readiness: 82%

Never:

> You are 82% legally compliant.

---

# PART XLII — HIGH-PRIORITY INDUSTRIES

## 44. Market order

### Tier A

Government/public sector.

Banking/NBFC/fintech.

Insurance.

### Tier B

Healthcare.

Telecom.

Education/EdTech.

### Tier C

E-commerce.

Large enterprises.

SaaS/BPO.

---

# PART XLIII — GOVERNMENT USE CASES

## 45. Product packs

Government Edition should ship templates for:

Citizen-benefit programmes.

Scholarships.

Licences.

Certificates.

Municipal services.

Public examinations.

Citizen grievance systems.

Government recruitment.

Department websites.

Public health programmes.

Each template pre-configures:

processing activities;

data categories;

purpose;

controls;

retention questions;

Privacy Centre.

---

# PART XLIV — BFSI PACK

## 46. Prebuilt journeys

Customer onboarding.

KYC.

Loan application.

Credit assessment.

Collections.

Account servicing.

Marketing.

Fraud detection.

Customer support.

Employee processing.

Vendor processing.

---

# PART XLV — HEALTH PACK

## 47. Prebuilt workflows

Patient registration.

Appointment.

Diagnostics.

Insurance.

Hospital sharing.

Research.

Telemedicine.

Minor/guardian.

---

# PART XLVI — EDTECH PACK

## 48. Prebuilt child privacy workflows

Student registration.

Parent verification.

Guardian consent.

Learning analytics.

Video classes.

Advertising/tracking assessment.

Student erasure.

---

# PART XLVII — PRIVACY CENTRE BUILDER

## 49. Configuration

Admin chooses:

```text
Subdomain
Logo
Favicon
Theme
Languages
Privacy Office
Request Types
Authentication Method
Notice Content
Terms
Contact Details
```

DNS:

```text
privacy.customer.gov.in
CNAME
privacy-edge.privy360.in
```

Certificate provisioning automated.

For government on-premise, client-managed DNS/TLS must also work.

---

# PART XLVIII — DEPLOYMENT MODES

## 50. Four deployment targets

### Privy360 SaaS

Multi-tenant.

### Dedicated SaaS

Dedicated DB / namespace.

### Customer Cloud

Customer AWS/Azure/GCP environment.

### On-Premise Government

Kubernetes / customer infrastructure.

Core application code stays substantially identical.

---

# PART XLIX — INFRASTRUCTURE

## 51. Reference deployment

```text
WAF
↓
Load Balancer
↓
Next.js
↓
API Gateway
↓
NestJS
↓
PostgreSQL
Redis
Temporal
MinIO
Keycloak
↓
Observability
```

For cloud deployments:

managed equivalents allowed.

---

# PART L — BRANCHING

## 52. Agent branches

Never allow multiple autonomous agents directly on `main`.

Format:

```text
agent/regulatory-engine
agent/privacy-centre
agent/rights-access
agent/consent-api
fix/tenant-isolation
security/auth-hardening
```

Pull request mandatory.

---

# PART LI — DEFINITION OF DONE

## 53. A feature is DONE only if

Product requirement implemented.

Regulatory mapping exists.

Schema migration exists.

API documented.

RBAC implemented.

ABAC implemented where required.

Tenant isolation verified.

Audit events exist.

Unit tests pass.

Integration tests pass.

E2E passes.

Security scan passes.

Accessibility tested where applicable.

Documentation updated.

Reviewer agent approves.

Human/security gate approves critical functions.

Anything else is:

**INCOMPLETE.**

---

# PART LII — AUTONOMY LEVELS

## 54. What agents may do autonomously

### Level 1 — Full autonomy

UI components.

CRUD.

Tests.

Docs.

Seed data.

Refactoring.

### Level 2 — Autonomous + independent review

Business workflows.

APIs.

Database migrations.

Connectors.

### Level 3 — Human/security approval required

Authentication.

Authorization.

Tenant isolation.

Cryptography.

Secrets.

PII handling.

Deletion.

Breach notification.

AI tool execution.

Regulatory interpretation.

Production infrastructure.

---

# PART LIII — AGENT MEMORY STRATEGY

## 55. Don't depend on chat history

The repository is memory.

Maintain:

```text
/ARCHITECTURE.md
/SECURITY.md
/DOMAIN.md
/ROADMAP.md
/DECISIONS/
/specs/
/regulations/
```

Every architectural decision becomes an ADR:

```text
ADR-001 Modular monolith
ADR-002 PostgreSQL
ADR-003 Keycloak
ADR-004 Tenant isolation
ADR-005 Temporal
ADR-006 Audit event architecture
```

Agents read ADRs.

Agents don't reinvent architecture.

---

# PART LIV — CONTEXT MANAGEMENT

## 56. Astra prompt hierarchy

Do not send 1M tokens every time.

Stable prefix:

```text
AGENTS.md
Master Spec
Architecture
Security Policy
Relevant module spec
Relevant domain model
Relevant tests
```

Then task.

Use Astra for architecture/review.

Use Sol for implementation.

This substantially lowers token cost; current API pricing places Astra above Sol and Luna, making task routing economically important.

---

# PART LV — DATABASE MIGRATION RULE

## 57. Agents may never modify production schema manually

Always:

```text
schema change
→ migration
→ migration test
→ rollback strategy
→ review
```

No `db push` against production.

---

# PART LVI — PRIVACY BY DESIGN

## 58. Every entity asks

Does this require personal data?

Can an identifier/token replace raw data?

How long is it required?

Who can access it?

Should it be encrypted separately?

Should it appear in audit logs?

Should it be included in exports?

How is it erased?

---

# PART LVII — PRIVY360'S OWN DATA MINIMISATION

## 59. Important architectural choice

Privy360 should not become a giant copy of every customer's personal-data estate.

Prefer:

references;

metadata;

tokens;

system identifiers;

federated queries.

Store full Data Principal data only where functionally required.

This reduces Privy360's breach impact.

---

# PART LVIII — CONNECTOR SECURITY

## 60. Connector credentials

Never store plaintext credentials.

Use:

Vault/KMS.

Allow:

read-only connectors.

search connectors.

deletion-capable connectors.

Classify permissions.

A deletion connector requires additional approval.

---

# PART LIX — OBSERVABILITY

## 61. Monitor

API latency.

5xx rate.

login failures.

privileged actions.

cross-tenant denials.

rights volume.

connector failures.

deletion failures.

webhook failures.

AI failures.

audit pipeline health.

Database health.

---

# PART LX — BACKUPS

## 62. Build disaster recovery early

Automated backup.

Encrypted.

Separate credential plane.

Restore tests.

Document:

RPO.

RTO.

Customer-selectable enterprise values.

A backup without a tested restore process is not considered compliant infrastructure.

---

# PART LXI — PERFORMANCE TARGETS

## 63. Baselines

Normal API:

P95 < 500 ms excluding external integrations.

Dashboard:

interactive < 3 seconds under standard enterprise dataset.

Rights submission:

P95 < 2 seconds.

Consent write:

design for high-throughput event ingestion.

Audit logging:

must not silently drop sensitive events.

---

# PART LXII — AVAILABILITY

## 64. Product target

Initial SaaS target:

99.9%.

Enterprise architecture:

capable of 99.95%+.

Do not promise availability before infrastructure supports it.

---

# PART LXIII — EXTERNAL SECURITY ASSESSMENT

## 65. Before government production

Perform:

independent VA/PT;

API penetration test;

tenant escape testing;

cloud configuration review;

container review;

source-code review for critical areas;

remediation verification.

Autonomous agents assist.

They do not replace independent assessment.

---

# PART LXIV — RELEASE PIPELINE

## 66. Environments

```text
Local
↓
Development
↓
Integration
↓
Staging
↓
Security Staging
↓
Production
```

No agent receives unrestricted production access.

---

# PART LXV — PRODUCTION CHANGE POLICY

## 67. Production changes

Infrastructure-as-code.

Approved PR.

CI/CD.

Signed artefact.

Rollback.

Audit event.

No direct SSH-based production changes under normal operations.

---

# PART LXVI — PRODUCT RELEASES

## 68. Release 0.1 — Bid Demo

Compliance engine.

Data inventory.

Evidence.

Rights.

Privacy Centre.

Notice.

Consent basics.

Risk.

Incident basics.

Reports.

---

## 69. Release 0.5 — Pilot

DPIA.

Processors.

Retention.

Deletion.

SSO.

Advanced workflows.

Government deployment.

---

## 70. Release 1.0 — Production

VA/PT completed.

HA.

DR.

Advanced RBAC.

Audit package.

Control monitoring.

Connectors.

Operational documentation.

---

## 71. Release 1.5

Discovery.

Classification.

Lineage.

Advanced deletion.

Sector packs.

---

## 72. Release 2.0

Compliance Digital Twin.

Privacy CI/CD.

Advanced regulatory intelligence.

Advanced AI agents.

Consent Manager interoperability.

---

# PART LXVII — PROJECT MANAGEMENT

## 73. Epic structure

```text
E00 Foundation
E01 Identity
E02 Tenant Security
E03 Regulatory Engine
E04 Compliance Controls
E05 Data Inventory
E06 Notices
E07 Consent
E08 Privacy Centre
E09 Rights
E10 Vendor Governance
E11 Risk
E12 DPIA
E13 Incidents
E14 Retention
E15 Deletion
E16 Evidence
E17 Audit
E18 Reporting
E19 Integrations
E20 AI
E21 Government Edition
E22 Security Hardening
```

Each epic contains autonomous-agent-ready tickets.

---

# PART LXVIII — TICKET SIZE

## 74. Do not give agents gigantic epics

Good task:

> Implement `POST /rights-requests` including authorization, validation, event creation and tests.

Bad task:

> Implement the whole rights management system.

Aim for changes that can be independently reviewed.

---

# PART LXIX — PARALLEL AGENTS

## 75. Safe parallelism

Agents may work simultaneously when domains do not overlap.

Example:

Agent 1 Regulatory engine.

Agent 2 UI design system.

Agent 3 Privacy Centre.

Agent 4 infrastructure.

Do not let two agents independently redesign shared authentication/database architecture.

Chief Architect owns shared contracts.

---

# PART LXX — CONFLICT PREVENTION

## 76. Contract-first work

Before parallel implementation define:

API contract.

database ownership.

event contract.

permissions.

Shared types.

Agents implement against frozen contracts.

---

# PART LXXI — SECURITY ATTACK AGENT

## 77. Dedicated red-team phase

For staging, tell an authorised security agent:

```text
You are reviewing Privy360 staging under explicit authorization.

Your purpose is defensive testing.

Attempt to identify:
- cross-tenant object access;
- broken object authorization;
- privilege escalation;
- authentication weaknesses;
- injection;
- insecure file handling;
- unsafe API behavior.

Do not perform destructive actions.

Report:
finding
severity
reproduction
affected endpoint
root cause
recommended fix.
```

Security verification remains controlled and authorised.

---

# PART LXXII — AUTONOMOUS BUG LOOP

## 78. Automated defect lifecycle

Browser agent finds bug.

Creates reproduction.

Implementation agent writes failing test.

Fixes bug.

Reviewer verifies.

CI passes.

Browser agent retests.

Close.

Never fix without regression test where feasible.

---

# PART LXXIII — REGULATORY CHANGE LOOP

## 79. When Indian DPDP requirements change

Legal source update.

Human/legal verification.

Regulatory agent generates diff.

Creates proposed requirement changes.

Architect reviews affected controls.

Product identifies workflows affected.

Engineering tickets generated.

Tests updated.

Customer impact produced.

That capability eventually becomes a Privy360 customer feature itself.

---

# PART LXXIV — COMPETITIVE MOAT

## 80. What we are really building

Not 80 screens.

We are building four deeply linked systems:

```text
System of Regulation
+
System of Record
+
System of Action
+
System of Evidence
```

Most competitors can replicate features.

The moat is:

**the graph connecting them.**

---

# PART LXXV — FINAL ENGINEERING COMMANDMENT

## 81. Privy360 release decision

No autonomous agent may say:

> Privy360 is secure.

The measurable statement is:

> The release has passed the defined security tests, automated gates, independent review and applicable external assessment.

No autonomous agent may say:

> This organisation is DPDP compliant.

The defensible statement is:

> These applicable controls are implemented/tested, and this is the supporting evidence and unresolved risk.

That distinction keeps both our product architecture and our commercial claims credible.

---

# BUILD AUTHORITY SUMMARY

The execution sequence is therefore fixed:

```text
01 Repository
02 Architecture
03 Security foundation
04 Tenant isolation
05 Identity/RBAC/ABAC
06 Audit architecture
07 Regulatory corpus
08 Atomic DPDP controls
09 Compliance engine
10 Data inventory
11 Processing graph
12 Privacy Centre
13 Rights workflows
14 Notice engine
15 Consent engine
16 Vendor/processor governance
17 Risk/DPIA
18 Incident/breach
19 Retention/deletion
20 Evidence graph
21 Reports
22 Regulatory intelligence
23 Continuous control monitoring
24 AI Copilot
25 Government hardening
26 External security validation
27 Production release
```

**This sequence is authoritative for the initial Privy360 build.**

The legal corpus is maintained from the official DPDP Act/Rules/corrigendum/commencement material rather than relying on model memory; the final Rules and associated enforcement material are currently published through MeitY.

The coding organisation uses **GPT-6 Astra for architecture and critical review, GPT-6 Sol/Codex for primary implementation, Claude Sonnet 5.5 for secondary implementation/review, Claude Opus 5.5 or a fresh Astra context for adversarial review, and Gemini 3.5 Flash/Antigravity for browser-driven QA.** Astra's current documentation explicitly supports complex coding, multi-step workflows and agent orchestration, while Google and Anthropic currently position the named models for the corresponding agentic roles described here.

## END — PRIVY360 AUTONOMOUS BUILD EXECUTION MANUAL v2.0