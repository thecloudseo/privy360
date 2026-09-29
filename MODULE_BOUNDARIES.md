# Module ownership and contracts

All modules are within the modular monolith unless an adapter worker is explicitly isolated. `read`, `command` and `event` interfaces receive a TrustedContext. A module may read its own tables only through repositories enforcing tenant isolation; cross-domain joins for the evidence graph are owned by the Reporting/Evidence query layer with reviewed SQL, not ad hoc module writes. Domain events carry IDs/version references, not entire entities. Shared task views are projections of owner-specific tasks, never a second writable workflow store.

| Module / package slug | Owns / authoritative responsibility | Public ports and permitted dependencies | Events / consumers |
|---|---|---|---|
| Identity / identity | users, memberships, groups, sessions, service accounts; IdP mapping | resolveActor, verifyService; Organisation membership references, Keycloak adapter | IdentityChanged → session/policy invalidation |
| Organisation/Tenancy / tenancy | tenant hierarchy, domains, deployment routing, subscriptions/settings | resolveTenant, hierarchyScope; control-plane provisioning | TenantSuspended → all execution gateways |
| Authorization / authorization | roles, grants, permission registry, policy versions | authorize, filterScope; trusted identity/hierarchy attributes | PolicyChanged → cache invalidation |
| Regulatory / regulatory | sources, corpus versions, provisions, requirements, applicability definitions, changes, exemptions | publishedCorpus, evaluateRule, propose/approveCorpus; no tenant data reads | RegulationChanged → tenant impact jobs |
| Compliance / compliance | obligations, tenant applicability decisions, controls, implementations, tests, assessments | evaluateApplicability, recordTest, assessReadiness; Regulatory read, Evidence metadata | ControlFailed → Risk proposal, Reporting |
| Data Governance / data-governance | activities, purposes, inventory, systems, flows, subject references, discovery proposals | inventoryRead, activityCommand, processingGraph; Vendor/Retention IDs | ProcessingActivityCreated → Reporting |
| Notices / notices | notice drafts, immutable versions/translations/publications | publish, publishedNotice; Governance purpose read, Legal review | NoticePublished → Privacy Centre/Consent |
| Consent / consent | consent purposes, immutable decisions/receipts, preferences | recordDecision, currentPreference; Notices published read, principal binding | ConsentGranted/Withdrawn → configured integrations |
| Rights / rights | principals, verification metadata, requests/tasks/responses, grievances, nominations | submit, verify, transition, ownRequest; Governance discovery, Evidence, Notifications | RightsRequest* / GrievanceSubmitted |
| Privacy Centre / privacy-centre | versioned branding/configuration; composition of public/principal journeys | publicConfig, ownedRequest views; Tenancy verified domain, Notices, Consent, Rights | ConfigurationPublished → cache purge |
| Vendor/Processor / vendors | vendors, processors, services, contracts, subprocessors, reviews | processorRead, approveProcessor; Evidence and Compliance read | ProcessorAdded/Approved → Governance |
| Risk / risk | risk registers, findings, remediation, exceptions | proposeRisk, acceptRisk, remediation commands; Compliance/Governance reference | RiskCreated/RemediationClosed → Reporting |
| DPIA / dpia | DPIA records and versioned assessments/answers for impact review | startDpia, approveDpia; Governance, Risk, Compliance read | DpiaApproved → Compliance/Reporting |
| Incident/Breach / incidents | incidents, determinations, affected scope, response actions, notification tracks | declare, determineBreach, approveNotification; Governance, Rights principal IDs | IncidentDeclared/PersonalDataBreachConfirmed |
| Retention / retention | policies/rules, holds, exceptions, lifecycle decisions | evaluateRetention, checkHold; Governance scope read | RetentionTriggered → Deletion proposal |
| Deletion / deletion | jobs/targets/confirmation/proofs | request, approve, execute, reconcile; Retention check, Integration capability | DeletionRequested/Completed → Reporting |
| Evidence / evidence | upload lifecycle, immutable versions, evidence links, access and custody | initiateUpload, authorizeDownload, attachEvidence; Storage/scanner adapters | EvidenceUploaded/Rejected/Expired → Compliance |
| Audit / audit | append-only events, audit engagements/findings, integrity anchors | append(tx), inspect, verifyChain; security-limited storage exporter | AuditAnchorWritten → operations |
| Reporting / reporting | scoped projections, graph query API, readiness calculations, report/export jobs | graphQuery, dashboard, export; read ports of all domains | consumes approved business events |
| Integrations / integrations | connector definitions, credential references, runs, webhook endpoints/deliveries | executeCapability, collectEvidence; secrets, egress policy, owning domain command | ConnectorRunCompleted/WebhookFailed |
| Notifications / notifications | templates, dispatch records, delivery status | enqueueApprovedMessage; request/incident scoped payload refs | NotificationDelivered/Failed |
| AI / ai | tenant AI policies, runs, retrieval provenance, proposed actions | assist, retrieveScoped, proposeTool; approved read ports/tool adapters only | AiRunCompleted/AiActionProposed |

## Dependency constraints

Identity/authentication and tenancy context must be initialized without invoking business modules. Authorization consumes trusted resource attributes supplied by owner repositories, not client assertions. Regulatory shared corpus never depends on tenant modules. Compliance control/test aggregates reference Governance resources through typed association tables; Governance does not call Compliance on writes. Reporting and Privacy Centre are downstream composition layers. Temporal workflow packages orchestrate module ports without giving modules a reverse dependency on workers.

Notifications do not decide whether a breach must be notified or which deadline is law; Incidents owns that decision. Evidence stores bytes/custody; Compliance determines sufficiency/freshness against an evidence requirement. Audit owns activity history, not business status. Risk owns risk acceptance; findings from audits/tests/DPIAs retain originating IDs. The same assessment engine library supplies typed questionnaires, while assessments have a discriminator and exactly one owning domain aggregate; no module edits another domain's answers.

## Extension contracts

Connector manifest: adapter_id, semantic_version, signed_digest, supported_operations, input/output_schema_version, required_scopes, permitted_egress, timeout, pagination/checkpoint policy, rate budget, destructive flag, data classification. Unsupported capability is denied. Plugins execute outside the API process with restricted credentials and network; no customer-supplied executable code is loaded into NestJS.

Policy bundle: id, version, jurisdiction, source_refs, effective interval, typed predicate AST, review/approval, digest. Allowed predicates only (boolean composition, enum/numeric/date comparisons, membership); no eval/SQL/scripts. Unknown facts yield UNKNOWN, never automatic exemption.

Sector pack: versioned inventory templates, purpose/category labels, draft mappings, retention questions and Privacy Centre presets. Installation creates tenant-owned drafts and an installation manifest; upgrades require explicit diff approval. Later discovery, lineage, Digital Twin, Privacy CI/CD and Consent Manager adapters use these contracts and the graph without replacing core domain owners.
