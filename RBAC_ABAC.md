# Default-deny authorization contract

## Permission model

Permission key `<domain>.<resource>.<action>`, with explicit registered resource and action enumerations. Actions: read, create, update, submit, approve, publish, assign, execute, export, download, administer as supported by API_ARCHITECTURE. No wildcard permission or implicit role inheritance in production. A role grants candidate actions only; every request must also satisfy ABAC. Undefined permission/action/attribute or policy evaluation error = DENY. Tenant Admin cannot create permissions or grant powers beyond an approved delegation ceiling.

Decision = valid authenticated identity AND active tenant membership/service grant AND registered permission AND resource.tenant = context.tenant AND resource scope within grant scope AND sensitivity clearance AND operation/state guard AND subject/assignment rule AND separation of duties AND purpose/assurance constraints. Explicit deny overrides allow; union of role grants never overrides a restriction. Field-level allowlists govern read projection and writable DTOs. Caller cannot write owner/tenant/policy/approval fields by mass assignment.

Grant scope binds legal_entity_ids/business_unit_ids/resource_ids or OWN_SUBJECT/ASSIGNED_TASK. An empty scope is no scope, not tenant-wide. Tenant-wide grants require explicit flag. Scope is computed from authoritative hierarchy/version; moving a resource reauthorizes affected grants. Tenant ID is not an ABAC field callers may provide. Sensitive operations require fresh MFA, reason and sometimes a distinct checker. Policy version and decision ID appear in audit.

## Role grants (all subject to above predicates)

| Role | Explicit candidate grants | Restrictions |
|---|---|---|
| Platform Super Admin | platform.tenants provision/suspend, deployment configuration/status, platform service health | No tenant content, principal records, evidence, policy assignment to self or implicit impersonation. Time-bound tenant-approved support grant is a separate identity/session with scoped audit and expiry. |
| Tenant Admin | organisation hierarchy/domain/branding settings; membership invitations, scoped role assignments, tenant settings | No automatic evidence/rights/incident content; cannot grant Platform powers, exceed delegation ceiling, approve own elevation, disable audit/RLS or weaken required MFA. |
| DPO | scoped compliance, inventory, rights, notices, consents, vendors, risk, DPIA, incidents, retention read; rights assign/review/approve/respond; notice publish; applicability review | No own-draft approval, key administration, arbitrary deletion execution, platform corpus publication or external breach submission without separate permission/approval. |
| Privacy Officer | scoped rights casework/verification/tasks, draft notices, consent lookup, inventory and grievance/nomination processing | Cannot approve own response, legal rejection/exemption, publish law or export bulk data without separate grant. |
| CISO | security control implementations/tests, evidence security scope, risk, incident read/update; security remediation assignment | No broad rights/consent content, legal determination alone, or raw principal export. Breach approval requires designated incident authority and Legal review. |
| Compliance Manager | assessments, controls, applicability proposals, test scheduling, evidence metadata, remediation; scoped reporting | No legal-source publication, arbitrary personal data, own exception approval or evidence acceptance outside assigned scope. |
| Legal Reviewer | reviewed legal sources/mappings in separately provisioned corpus-editor scope; tenant legal/applicability review, exemptions, notice/DPIA/rights-rejection rationale, breach track review | Corpus publisher requires distinct global reviewer grant; tenant Legal role does not imply global editing. Cannot execute deletion or independently send regulator notifications. |
| Security Analyst | assigned security tests, incident actions, sanitized logs/evidence; risk proposals | No role management, breach/legal approvals, unrelated units or bulk export. |
| Data Steward | assigned inventory, categories, data elements, systems, flows; assigned rights fulfilment tasks | May view only task-specific subject data; cannot approve responses, change lawful grounds to bypass review or execute general deletion. |
| Business Owner | owned activities/systems, implementation updates, assigned tasks, risk remediation, scoped DPIA answers | Cannot change tenant scope/ownership to gain access, accept own high-risk exception or browse unrelated cases. |
| Processor/Vendor Manager | vendors/processors/services/contracts/subprocessors and review preparation; assigned connector metadata | No connector secrets, deletion capabilities or own processor approval. Approval requires independent designated reviewer (DPO/Compliance Manager with processor.approve grant). |
| Incident Manager | incident declaration, assignment, containment actions, determination proposal, notification draft/dispatch after approved human release | Restricted affected-subject fields; cannot self-approve breach determination/notification, edit legal timers or conceal timeline. |
| Auditor | scoped immutable records, controls/tests, authorized evidence metadata and audit engagements/findings; create audit findings | Read-only on operational records; file download/export separately granted and classification-limited; no unrestricted raw personal data. |
| Executive Read Only | aggregate dashboards, readiness counts, top risks, redacted status reports | No drill-through into principal data/evidence content, no mutation/export unless separately scoped aggregate-export grant. |
| Data Principal | own profile reference, own consents/preferences, requests/responses, grievance, nomination proposal | Subject bound by verified session, not request body; delegation requires verified active grant for exact action/subject. Cannot view employees' queue or another principal by ID. |
| Service accounts | exact registered API capabilities and resource scopes, short-lived client credentials | No interactive staff role inheritance; one tenant per credential binding, no policy/role administration unless explicit audited provisioning service, no self-grant. Destructive capability separate and disabled by default. |

## Enforcement locations

API guard authenticates and resolves tenant; application service authorizes command and loads object under RLS; repository scopes list/search/count; response mapper removes forbidden fields. Workers/tools invoke the same services with delegated/service context. Object download, report export, webhook replay and graph queries do not bypass object checks. Frontend permission responses only improve UX.

Object permissions cannot be established solely after fetching a full cross-tenant record. Load minimal authorized attributes under RLS, evaluate policy, then fetch permitted payload. List predicates are compiled from approved policy expressions and tested against per-object decisions; unsupported predicate fails closed. Apply authorization before pagination/counting. No cache of ALLOW beyond policy/session epochs; high-risk actions re-read current membership and approvals.

## Separation of duties and support

Maker != checker for corpus publication, authoritative mapping changes, notice publication, DPIA approval, high-risk exception acceptance, rights response/legal rejection, breach notification and deletion execution approval. Checking identity compares underlying human identity, not two roles/sessions. A small tenant must appoint a second authorized reviewer; no silent self-approval fallback. Low-risk draft CRUD needs no checker.

Support access: tenant approver + operator approver, explicit scope/purpose, maximum one hour, step-up, banner, session recording metadata and audit, immediate revocation. No data access by default during incident response. Emergency procedures require separately approved customer policy; never mint a blanket superuser token.

## Authorization tests

Generate a role × resource × action matrix from permission registry and this table. Verify positive intended grants and every ungranted action. Include multi-role deny precedence, unit hierarchy change, subject delegation expiry, assignee mismatch, sensitivity, revoked session, stale policy, forged tenant/owner, self-approval through second role, worker retry after revocation and platform-admin tenant escape. Failure returns non-disclosing errors and auditable policy reason code without confidential attributes.

## Explicit lifecycle and integration grants

There is no implicit “Lifecycle Manager” super-role. DPO may propose/approve retention policies and deletion plans within assigned scope, subject to distinct maker/checker and Legal review for legal basis/hold release. Privacy Officer may request a deletion plan only for an assigned verified rights case. Data Steward/Business Owner may enumerate targets and provide fulfilment proof only for assigned systems/tasks; they cannot approve or execute arbitrary erasure. Legal Reviewer may approve/release scoped holds with a distinct maker and reviewed rationale. Deletion execution belongs only to a separately granted service capability bound to an approved exact plan and live hold check. Tenant Admin may configure connector metadata/secret provisioning if explicitly granted integrations.connector.administer but cannot read secret values or receive deletion capability through that grant. CISO reviews connector security; destructive enablement additionally requires DPO/Legal policy approval. These grants remain default-deny unless explicitly assigned.
