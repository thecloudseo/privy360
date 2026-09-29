# Privy360 — Autonomous Engineering Rules

## 1. Product Identity

You are working on **Privy360**, an enterprise-grade Digital Personal Data Protection compliance operating system.

Privy360 initially focuses on automating and operationalising compliance with:

- Digital Personal Data Protection Act, 2023;
- Digital Personal Data Protection Rules, 2025;
- applicable corrigenda;
- commencement/enforcement notifications;
- future amendments and regulatory updates.

Privy360 is intended for enterprise and government use.

Security, tenant isolation, legal traceability, privacy, auditability and evidence integrity are first-class architectural requirements.

They are not optional product features.

---

# 2. Source-of-Truth Hierarchy

When making engineering decisions, use this order of authority:

1. `AGENTS.md`
2. approved Architecture Decision Records in `/DECISIONS`
3. approved security architecture
4. approved domain architecture
5. approved regulatory source material
6. approved module specifications
7. `MASTER_SPEC.md`
8. approved API/database/event contracts
9. implementation plans
10. existing implementation

Existing code does NOT automatically override an approved specification.

If implementation conflicts with an approved architecture or security rule, do not preserve the implementation merely because it already exists.

If two authoritative specifications materially conflict, do not silently choose one.

Document the conflict and escalate it to the Chief Architect.

---

# 3. Clean-Room Rule

This repository is the authoritative workspace for the new Privy360 implementation.

Do not search for, inspect, import, copy, reference or reuse previous Privy360 prototypes unless explicitly instructed to do so.

Do not inspect:

- old Privy360 repositories;
- previous prototypes;
- old database schemas;
- old screenshots;
- previous design files;
- old source code;
- unrelated Documents/Desktop folders;
- unrelated repositories.

Do not attempt to discover previous Privy360 implementations elsewhere on the machine.

Only use files intentionally made available inside this workspace or explicitly provided for the current task.

---

# 4. Core Engineering Principles

Privy360 is built according to these principles:

**Secure by default.**

**Privacy by design.**

**Default deny.**

**Tenant isolation by design.**

**Evidence before assertion.**

**Legal requirements are versioned data.**

**Authorization is deterministic.**

**AI is advisory, not authoritative.**

**The repository is durable project memory.**

**Architecture precedes implementation.**

**Contracts precede parallel implementation.**

**Tests are part of implementation, not follow-up work.**

---

# 5. Non-Negotiable Security Rules

Never weaken authentication, authorization, validation, tenant isolation, encryption, auditability or other security controls merely to make implementation easier or tests pass.

Never delete, disable or weaken a legitimate security test to obtain a passing build.

Never introduce development bypasses that can accidentally operate in production.

Never hard-code credentials, passwords, API keys, private keys, tokens or production secrets.

Never commit secrets.

Never log:

- passwords;
- authentication tokens;
- session tokens;
- private keys;
- OTP values;
- unnecessary personal data;
- identity-verification documents;
- connector credentials;
- secrets.

Sensitive values must be appropriately protected in storage and transit.

---

# 6. Tenant Isolation

Every tenant-owned business object must have explicit tenant ownership.

Tenant context must be determined from trusted server-side authenticated context.

Never trust a `tenant_id` supplied by the browser or arbitrary API caller as proof of tenant membership.

Every operation involving tenant data must enforce tenant boundaries.

This includes:

- GET;
- POST;
- PUT;
- PATCH;
- DELETE;
- search;
- filtering;
- exports;
- reports;
- dashboards;
- background jobs;
- scheduled jobs;
- webhooks;
- caches;
- object storage;
- search indexes;
- queues;
- analytics;
- notifications;
- AI retrieval;
- AI tools;
- connectors.

Cross-tenant access must fail securely.

Knowledge of another tenant's object UUID must never grant access to that object.

Database-level safeguards must supplement application authorization where appropriate.

PostgreSQL Row Level Security should be used according to the approved tenancy architecture.

Tenant isolation tests are mandatory for tenant-aware resources.

---

# 7. Authorization

Authorization defaults to:

**DENY**

Access must be explicitly granted.

Authorization decisions may consider:

- authenticated identity;
- tenant;
- role;
- permission;
- business unit;
- legal entity;
- resource ownership;
- resource sensitivity;
- requested action;
- policy;
- contextual attributes.

Frontend visibility is not authorization.

Every protected operation must be authorized server-side.

Every API accessing an object must perform object-level authorization.

Protect against:

- BOLA;
- IDOR;
- horizontal privilege escalation;
- vertical privilege escalation;
- mass assignment;
- confused-deputy scenarios.

Authorization logic should be centralised rather than inconsistently duplicated across controllers.

---

# 8. AI Must Never Control Authorization

An LLM must never determine whether a user is allowed to access a resource.

The application authorization layer makes access decisions.

AI operates only after deterministic authorization.

Never implement:

`User → LLM → Database`

for unrestricted production-data access.

Use:

`User → Authentication → Authorization → Application Service → AI Gateway → approved tools/data`

AI tool calls must inherit the requesting user's permitted scope.

AI must not bypass tenant, resource or field-level authorization.

---

# 9. Personal Data Handling

Before storing a personal-data field, ask:

1. Is the field necessary?
2. Can a reference/token replace the raw value?
3. What purpose requires it?
4. Who needs access?
5. How long is it required?
6. Does it require stronger encryption?
7. Should it be excluded from logs?
8. Should it be excluded from analytics?
9. Should it be included in exports?
10. How will it be corrected?
11. How will it be erased?
12. How will downstream deletion occur?

Privy360 should not become an unnecessary duplicate of customers' personal-data estates.

Prefer:

- metadata;
- references;
- tokens;
- system identifiers;
- federated retrieval;
- purpose-specific minimal datasets.

Store raw personal data only where required for product functionality.

---

# 10. Regulatory Integrity

Never invent a DPDP requirement.

Never rely solely on model memory for authoritative legal text.

Authoritative regulatory functionality must ultimately trace to approved regulatory source material maintained under the repository's regulatory corpus.

Regulatory requirements must be represented as versioned data.

Do not hard-code legal requirements directly into frontend components.

Maintain the conceptual chain:

`Regulation`

→ `Regulation Version`

→ `Provision`

→ `Provision Version`

→ `Requirement`

→ `Applicability`

→ `Obligation`

→ `Control`

→ `Evidence Requirement`

→ `Control Implementation`

→ `Control Test`

→ `Evidence`

→ `Risk`

→ `Remediation`

Every regulatory control must have a stable regulatory requirement identifier.

Database integer IDs must not serve as legal identifiers.

---

# 11. Law vs Implementation Guidance

Always distinguish between:

**LEGAL REQUIREMENT**

**IMPLEMENTATION CONTROL**

**RECOMMENDED GOOD PRACTICE**

Do not represent recommended implementation guidance as statutory wording.

Do not represent Privy360's implementation choices as requirements of law unless the regulatory source actually establishes them.

Where legal interpretation is uncertain, record that uncertainty.

Do not silently convert interpretation into statutory fact.

---

# 12. Regulatory AI Restrictions

AI may:

- summarise approved regulatory sources;
- identify potentially relevant requirements;
- explain mapped controls;
- draft assessments;
- draft remediation recommendations;
- assist evidence analysis;
- draft communications for human review.

AI may not autonomously:

- declare an organisation legally compliant;
- make binding legal determinations;
- determine a statutory exemption conclusively;
- reject a Data Principal request on legal grounds;
- approve high-risk regulatory exceptions;
- submit breach notifications to regulators;
- change authoritative regulatory mappings without review.

---

# 13. Compliance Claims

Never state:

> This organisation is DPDP compliant.

Privy360 may instead state measurable facts such as:

> Applicable controls: 148  
> Implemented: 121  
> Tested: 104  
> Evidence current: 96  
> Failed controls: 8  
> Open high risks: 4

Privy360 may calculate an operational/readiness indicator.

Never represent such a score as an official legal compliance percentage or certification.

---

# 14. Compliance Evidence Graph

The Compliance Evidence Graph is a first-class architectural requirement.

The system must preserve traceability across:

`Regulation`

→ `Requirement`

→ `Control`

→ `Control Implementation`

→ `Control Test`

→ `Evidence`

→ `Processing Activity`

→ `Purpose`

→ `Personal Data`

→ `System`

→ `Processor`

→ `Risk`

→ `Remediation`

Architectural decisions must not break this traceability.

Features should contribute to this graph wherever appropriate rather than creating disconnected compliance records.

---

# 15. Audit Requirements

Every security-sensitive or compliance-significant mutation must produce an audit event.

Examples include:

- authentication/security changes;
- role changes;
- permission changes;
- control status changes;
- evidence changes;
- regulatory mappings;
- consent changes;
- notice publication;
- rights-request transitions;
- grievance transitions;
- DPIA approval;
- processor approval;
- incident changes;
- breach determinations;
- deletion actions;
- retention exceptions;
- AI actions affecting compliance workflows.

Audit records should contain appropriate contextual metadata such as:

- tenant;
- actor;
- action;
- resource type;
- resource identifier;
- timestamp;
- correlation identifier;
- relevant source context.

Do not store unnecessary personal data in audit logs.

Audit events must not silently disappear.

Tamper-evident mechanisms may be used according to the approved architecture.

Do not describe normal audit logging as blockchain unless an actual blockchain implementation exists.

---

# 16. Database Rules

All schema changes require migrations.

Never manually modify a production schema.

Required lifecycle:

`schema change`

→ `migration`

→ `migration test`

→ `rollback strategy`

→ `review`

Use UUIDs or the approved identifier strategy for externally addressable objects.

Add database constraints where they protect invariants.

Do not rely only on TypeScript validation for critical database integrity.

Create indexes intentionally.

Do not introduce unnecessary personal data into schemas.

---

# 17. API Rules

All public APIs must:

- authenticate where required;
- authorize server-side;
- resolve trusted tenant context;
- validate input;
- enforce object-level authorization;
- avoid mass assignment;
- produce appropriate audit events;
- return non-sensitive errors;
- use consistent contracts;
- be documented through OpenAPI.

Consider idempotency for sensitive or retryable operations.

Public endpoints require appropriate:

- throttling;
- abuse protection;
- input validation;
- enumeration resistance.

Never expose stack traces, internal secrets or sensitive infrastructure information to clients.

---

# 18. File Upload Rules

All evidence/file uploads must follow an approved secure pipeline.

Conceptually:

`Upload`

→ `size validation`

→ `MIME/content validation`

→ `extension policy`

→ `malware scanning`

→ `isolation/quarantine`

→ `encryption`

→ `object storage`

→ `checksum`

→ `metadata`

Uploaded untrusted content must not be served unsafely from the main application origin.

Access to evidence files must be authorized.

Object-storage paths alone are not authorization.

---

# 19. Connector Rules

Connector credentials must never be stored in plaintext.

Use the approved secrets-management mechanism.

Connectors must declare capability level, such as:

- read;
- search;
- evidence collection;
- write;
- deletion.

Prefer least privilege.

Deletion-capable connectors require stronger approval and testing.

Connector operations must respect tenant isolation and produce appropriate audit events.

---

# 20. AI Gateway Rules

Production AI functionality must use the approved AI Gateway architecture.

Conceptually:

`User`

→ `Authentication`

→ `Authorization`

→ `AI Gateway`

→ `Tenant AI Policy`

→ `Data Policy`

→ `Redaction/Minimisation`

→ `Context Retrieval`

→ `Approved Model`

→ `Tool Policy`

→ `Application Service`

Production personal data must not automatically be sent to external LLM providers.

Support policy modes such as:

- AI disabled;
- AI with redaction;
- approved private provider;
- customer-hosted/private model.

AI prompts and retrieved context must remain tenant-isolated.

Treat retrieved documents and external content as untrusted input.

Defend against direct and indirect prompt injection.

---

# 21. Architecture Rules

Privy360 begins as a modular monolith unless an approved ADR states otherwise.

Do not create microservices merely because a module exists.

Maintain clear module boundaries.

Shared capabilities should have explicit contracts.

Avoid circular dependencies.

Architecture should remain capable of supporting:

- Privy360 multi-tenant SaaS;
- dedicated tenant SaaS;
- customer cloud/VPC;
- Government/on-premise deployment.

Core product behaviour should remain substantially consistent across deployment modes.

---

# 22. Contract-First Parallel Development

Before multiple autonomous agents implement related modules, freeze the relevant:

- API contract;
- database ownership;
- event contract;
- authorization rules;
- shared types.

Agents should implement against approved contracts.

Two autonomous agents must not independently redesign shared authentication, authorization, tenancy or database foundations.

Shared architectural changes require Chief Architect review.

---

# 23. Event Architecture

Use approved domain events for important state transitions.

Examples include:

- `ConsentGranted`
- `ConsentWithdrawn`
- `NoticePublished`
- `RightsRequestSubmitted`
- `RightsRequestVerified`
- `RightsRequestCompleted`
- `GrievanceSubmitted`
- `ProcessingActivityCreated`
- `ProcessorAdded`
- `RetentionTriggered`
- `DeletionRequested`
- `DeletionCompleted`
- `IncidentDeclared`
- `PersonalDataBreachConfirmed`
- `EvidenceUploaded`
- `ControlFailed`
- `RiskCreated`
- `RegulationChanged`

Events must include trusted tenant context where applicable.

Event consumers must not bypass authorization or tenant isolation assumptions.

Design handlers to tolerate retries where appropriate.

---

# 24. Workflow Integrity

Compliance workflows should use explicit states and permitted transitions.

Do not implement important workflows as arbitrary editable status strings.

Where appropriate define:

- states;
- allowed transitions;
- actor permissions;
- transition guards;
- required evidence;
- required approvals;
- audit events;
- timeout/escalation behaviour.

Sensitive transitions may require maker-checker approval.

---

# 25. Privacy Centre

The white-labelled Privacy Centre is a first-class product surface.

It must support tenant-specific domains such as:

`privacy.customer-domain.example`

Tenant resolution from hostname must not itself constitute authorization.

Privacy Centre architecture must support:

- white labelling;
- multilingual content;
- accessibility;
- notices;
- consent/preferences;
- access requests;
- correction;
- erasure;
- grievances;
- nomination;
- request tracking;
- privacy-office contact.

Public endpoints require abuse controls.

Data Principals must never gain access to another person's request or personal data through identifier enumeration.

---

# 26. Government Readiness

Architecture must not assume public-cloud SaaS is the only deployment model.

Government deployments may require:

- on-premise;
- private cloud;
- customer-managed Kubernetes;
- customer-managed DNS/TLS;
- SAML/OIDC;
- LDAP/AD integration;
- restricted internet connectivity;
- external KMS/HSM;
- SIEM integration;
- customer-controlled backup;
- customer-controlled observability;
- India-specific hosting requirements;
- accessibility requirements.

Avoid unnecessary dependencies on proprietary cloud services when a portable abstraction is reasonable.

---

# 27. Accessibility and Internationalisation

User-facing architecture must support internationalisation.

Do not hard-code user-facing English strings throughout business logic.

Privacy Centre and government-facing interfaces must be designed for accessibility.

Accessibility is part of acceptance criteria for applicable UI functionality.

---

# 28. Testing Rules

A feature is not complete merely because it works manually.

Relevant automated testing must include:

- unit tests;
- integration tests;
- API tests;
- authorization tests;
- tenant-isolation tests;
- workflow tests;
- negative tests;
- E2E tests where appropriate;
- accessibility tests where appropriate.

Security-sensitive functionality requires explicit negative tests.

Every tenant-aware endpoint must be tested against cross-tenant access.

---

# 29. Mandatory Security Verification

The engineering pipeline should support:

- linting;
- TypeScript checking;
- unit tests;
- integration tests;
- E2E tests;
- SAST;
- SCA;
- secret scanning;
- IaC scanning;
- container scanning;
- SBOM generation;
- DAST in appropriate staging environments.

A model's statement that code is secure is not security approval.

Do not bypass failing mandatory security gates.

---

# 30. Security-Critical Areas

Changes involving the following require heightened review:

- authentication;
- authorization;
- tenant isolation;
- cryptography;
- secrets;
- personal-data handling;
- identity verification;
- evidence storage;
- consent;
- deletion;
- breach workflows;
- AI tool execution;
- regulatory interpretation;
- production infrastructure.

Autonomous implementation does not equal autonomous production approval.

---

# 31. Production Safety

Autonomous agents do not receive unrestricted production access.

Do not perform direct production changes as part of ordinary development tasks.

Production changes should follow:

`approved change`

→ `PR`

→ `CI/CD`

→ `signed/versioned artefact`

→ `deployment`

→ `verification`

→ `rollback capability`

→ `audit`

Never use production personal data for development or tests.

---

# 32. Seed and Demo Data

Use synthetic data for development, testing and demonstrations.

Never create demo environments containing real citizen/customer personal data.

Synthetic government demonstrations must clearly use fictional organisations and records.

---

# 33. Agent Branching

Autonomous implementation must not work directly on `main`.

Use branches such as:

- `agent/foundation`
- `agent/regulatory-engine`
- `agent/privacy-centre`
- `agent/rights-access`
- `agent/consent-api`
- `fix/tenant-isolation`
- `security/auth-hardening`

Changes require review before merge according to the project's approval process.

---

# 34. Task Size

Prefer independently reviewable implementation tickets.

Good:

> Implement POST `/rights-requests` with validation, authorization, event generation, audit logging and tests.

Bad:

> Build the entire Rights Management module.

Do not unnecessarily combine unrelated architectural changes into one implementation task.

---

# 35. Required Implementation Plan

Before substantial implementation, produce an implementation plan covering:

- objective;
- regulatory references where applicable;
- architecture impact;
- files/modules affected;
- database changes;
- API changes;
- authorization rules;
- audit events;
- event/workflow changes;
- privacy considerations;
- security considerations;
- tests;
- acceptance criteria.

Do not begin a large implementation while major architectural ambiguity remains unresolved.

---

# 36. Definition of Done

A feature is DONE only when all applicable requirements are satisfied.

This includes:

- product requirement implemented;
- regulatory mapping present where applicable;
- schema migration present where applicable;
- API documented;
- server-side authorization implemented;
- ABAC implemented where required;
- tenant isolation verified;
- audit events implemented;
- validation implemented;
- unit tests pass;
- integration tests pass;
- authorization tests pass;
- tenant-isolation tests pass;
- E2E tests pass where applicable;
- security checks pass;
- accessibility checked where applicable;
- documentation updated;
- reviewer requirements satisfied.

If a mandatory requirement is missing, the feature is:

**INCOMPLETE**

---

# 37. Failure Handling

Do not hide failures.

Do not silently ignore:

- failed tests;
- failed migrations;
- security scanner findings;
- type errors;
- authorization failures;
- regulatory traceability failures;
- broken tenant tests.

Report the failure and either fix it within scope or clearly record it as unresolved.

Do not modify acceptance criteria merely to make an implementation appear complete.

---

# 38. Architecture Decision Records

Material architectural decisions must be recorded as ADRs under:

`/DECISIONS/`

Examples:

- modular monolith;
- PostgreSQL;
- Keycloak;
- tenant isolation;
- RLS;
- Temporal;
- audit-event architecture;
- regulatory versioning;
- AI Gateway;
- object storage;
- deployment portability.

Agents must inspect relevant ADRs before redesigning an architectural area.

Do not silently reverse an approved ADR.

---

# 39. Repository as Memory

Do not depend on previous chat history as authoritative project memory.

The repository is the durable engineering memory.

Maintain and consult as applicable:

- `MASTER_SPEC.md`
- `ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `DOMAIN_MODEL.md`
- `DATABASE_SPEC.md`
- `API_ARCHITECTURE.md`
- `EVENT_MODEL.md`
- `RBAC_ABAC.md`
- `MODULE_BOUNDARIES.md`
- `DEPLOYMENT_ARCHITECTURE.md`
- `THREAT_MODEL.md`
- `BUILD_PLAN.md`
- `ROADMAP.md`
- `/DECISIONS`
- `/specs`
- `/regulations`

When architecture changes, update the repository documentation rather than relying on chat context.

---

# 40. Autonomous Authority

Agents may generally act autonomously for low-risk local development work such as:

- UI components;
- routine CRUD;
- tests;
- documentation;
- synthetic seed data;
- safe refactoring.

Independent review is expected for:

- business workflows;
- APIs;
- database migrations;
- connectors.

Human/security approval is required before production acceptance of critical areas including:

- authentication;
- authorization;
- tenant isolation;
- cryptography;
- secrets;
- sensitive PII handling;
- deletion;
- breach notification;
- AI tool execution;
- material regulatory interpretation;
- production infrastructure.

---

# 41. Prohibited Shortcuts

Never:

- disable authorization to unblock development;
- accept client-provided tenant identity without trusted verification;
- expose another tenant's data;
- put secrets in source code;
- put personal data into logs unnecessarily;
- send production personal data to an unapproved LLM;
- give an LLM unrestricted database access;
- hard-code regulatory obligations into scattered UI logic;
- invent statutory requirements;
- claim legal certification;
- suppress security findings;
- delete failing security tests;
- use real citizen data as demo data;
- allow object-storage URLs to substitute for authorization;
- implement destructive connector actions without explicit controls;
- allow AI-generated actions to bypass application authorization;
- mark incomplete work as complete.

---

# 42. Priority When Requirements Conflict

When priorities conflict, preserve them in this order:

1. legal/regulatory integrity;
2. authorization and tenant isolation;
3. personal-data protection;
4. integrity and auditability;
5. security;
6. data correctness;
7. availability;
8. maintainability;
9. performance;
10. implementation convenience.

Never trade tenant isolation or authorization for convenience.

---

# 43. Stop/Escalation Conditions

Stop the affected architectural decision and escalate to the Chief Architect when:

- authoritative specifications materially contradict;
- a requested change weakens tenant isolation;
- a requested change bypasses authorization;
- legal requirements cannot be traced to approved sources;
- cryptographic design requires an unapproved security decision;
- production secrets or real personal data appear in development context;
- implementation requires reversing a foundational ADR;
- a destructive production operation would be required;
- regulatory interpretation would materially determine a Data Principal's legal rights without human review.

Routine implementation questions that can be resolved safely from approved architecture should not block progress.

---

# 44. Final Engineering Principle

No autonomous agent may declare:

> Privy360 is secure.

The acceptable engineering statement is:

> The release has passed the defined security tests, automated gates, independent reviews and applicable external assessments.

No autonomous agent may declare:

> This organisation is DPDP compliant.

The acceptable compliance statement is:

> These applicable controls have been implemented and/or tested, this evidence supports them, and these identified risks or deficiencies remain.

Privy360's credibility depends on preserving that distinction.