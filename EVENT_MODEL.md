# Event and audit model

## Envelope and transactional contract

Domain event JSON: `{eventId:uuid,type:string,schemaVersion:integer,tenantId:uuid,aggregateType:string,aggregateId:uuid,aggregateVersion:decimalString,sequence:decimalString,occurredAt:timestamp,recordedAt:timestamp,actor:{id,kind},correlationId:uuid,causationId:uuid?,policyVersion:uuid,payload:object}`. tenantId is copied from trusted context, never arbitrary event producer payload. Global corpus events use a separate authenticated platform channel with `scope:"GLOBAL_CORPUS"` and no tenantId; fan-out creates distinct tenant work items through verified tenant registry. Never treat missing tenant as global permission on tenant channels.

Schemas are registered in packages/contracts/events; exact event type and schema version validated at producer and consumer. Payload contains IDs, immutable versions, state changes and provenance digests, not credentials, raw personal data, notice text, uploaded contents or prompts. Sensitive details are retrieved later through authorized services. Event IDs are unique; causation records link resulting actions without copying data.

Business mutation + audit row + outbox insert commit atomically. Dispatcher leases pending rows (`SKIP LOCKED` pattern in future implementation), publishes/starts workflow, then marks delivered. Crash between publish and mark can duplicate delivery. Consumers insert unique `(tenant,consumer,eventId)` inbox receipt with local effect atomically. No exactly-once transport claim. For external effects use provider key or reconcile ambiguous status before retry. Aggregate sequence orders a single aggregate; no assumed ordering across aggregates. Consumers reject/defer gaps, fetch current authorized state and never apply stale status blindly.

Redis is not the durable event bus. Initial delivery is PostgreSQL outbox→worker/application handlers and Temporal signals. A later broker adapter may transport the same envelopes after an ADR; it cannot remove outbox/inbox. Fan-out, subscriptions and tenant quotas are bounded. Retry transient errors with jitter; poison schema/authorization errors go to visible dead-letter state. Replay requires scoped operator approval, maintains original event ID, and rechecks current authority/hold rules. Inbox retention must exceed event replay window; historic replay into projections uses a distinct consumer generation and cannot re-run external side effects.

## Event catalog

Common fields above apply to all events. `v1` payloads below list mandatory fields unless `?`. Each owner also emits audit for CRUD and all state transitions even where no cross-module domain event is needed.

| Type | Producer | v1 payload | Consumers / invariant |
|---|---|---|---|
| TenantProvisioned / TenantSuspended | Tenancy (platform) | tenantRef,deploymentRef,state,securityEpoch | provisioning/session gateways; registry is authoritative |
| IdentityChanged / PolicyChanged | Identity/Authorization | subjectId?,policyId?,revision,securityEpoch,changeKind | sessions/cache invalidation; no grant from event alone |
| RegulationChanged | Regulatory global | regulationId,oldVersionId?,newVersionId,manifestDigest,changeId | impact fan-out; published approved bundle only |
| RegulatoryImpactApproved | Regulatory tenant impact | impactId,obligationId,decisionVersion | Compliance creates review work, no automatic law rewrite |
| ApplicabilityReviewed | Compliance | decisionId,requirementVersionId,outcome,factsDigest | obligations/reporting; UNKNOWN cannot mark satisfied |
| ControlApproved | Compliance | controlId,controlVersion,requirementVersionIds,evidenceRequirementIds | graph/readiness projections |
| ControlTestRecorded / ControlFailed | Compliance | testId,implementationId,definitionVersionId,result,observedAt,evidenceVersionIds | Risk proposal, Reports; failed result emits ControlFailed once per test outcome |
| EvidenceUploaded | Evidence | evidenceId,versionId,checksum,scanStatus:AVAILABLE,capturedAt,expiresAt? | Compliance freshness/graph; emitted only after accepted scan, not initial bytes arrival |
| EvidenceRejected / EvidenceExpired / EvidenceRevoked | Evidence | evidenceId,versionId,reasonCode,at | affected control readiness invalidation; no file body |
| ProcessingActivityCreated / ProcessingActivityChanged | Governance | activityId,revision,changedFieldNames | graph/reporting/reassessment proposals |
| ProcessorAdded / ProcessorApproved | Vendors | processorId,revision,serviceIds | inventory/reporting; approval is scoped, not certification |
| NoticePublished | Notices | noticeId,versionId,localeDigests,purposeIds,effectiveFrom | portal cache, consent config; old receipts remain pinned |
| ConsentGranted / ConsentWithdrawn | Consent | principalRef,purposeVersionId,noticeVersionId,consentEventId,receiptId,ledgerSequence,scopeDigest | preferences, authorized downstream propagation; subject ref is pseudonymous |
| RightsRequestSubmitted | Rights | requestId,type,principalRef,submittedAt | workflow creation/notification; no case text |
| RightsRequestVerified | Rights | requestId,verificationId,assurance,verifiedAt | discovery workflow; no document data |
| RightsRequestAssigned / RightsRequestApproved | Rights | requestId,assignmentId? or responseVersionId,decisionId | task/notification orchestration; approval digest preserved |
| RightsRequestResponded / RightsRequestCompleted | Rights | requestId,responseVersionId,deliveryRef,at | status/reporting; completed only after successful response and closure guards |
| GrievanceSubmitted / NominationActivated | Rights | caseId,principalRef,relationshipId?,at | scoped workflow/status; no implied subject access |
| RiskCreated / RemediationClosed | Risk | riskId,sourceIds,remediationId?,proofVersionIds? | readiness/reporting; no automatic statutory claim |
| DpiaApproved | DPIA | dpiaId,revision,assessmentId,decisionId | Compliance/reporting; actor separate from maker |
| IncidentDeclared | Incidents | incidentId,severity,declaredAt,scopeDigest | responder task allocation |
| PersonalDataBreachConfirmed | Incidents | incidentId,assessmentId,decisionId,confirmedAt | notification tracks proposed; never auto-send |
| NotificationApproved / NotificationDelivered / NotificationFailed | Notifications/owner approval | notificationId,ownerRef,contentDigest,deliveryRef?,reasonCode? | owning workflow; transport cannot create legal authority |
| RetentionTriggered | Retention | evaluationId,policyVersionId,scopeDigest,evaluatedAt | proposed deletion job, hold check still required |
| HoldApplied / HoldReleased | Retention | holdId,scopeDigest,revision,decisionId | pause/recheck deletion; cannot undo completed deletion |
| DeletionRequested | Deletion | jobId,sourceRef,planVersion,scopeDigest | workflow planning, never direct execution |
| DeletionCompleted | Deletion | jobId,planDigest,confirmationIds,completedAt | erasure ledger/reporting; all required targets confirmed |
| ConnectorRunCompleted / ConnectorRunFailed | Integrations | runId,connectorId,adapterVersion,operation,resultRef?,reasonCode? | evidence/discovery/deletion owner validates output |
| WebhookFailed | Integrations | deliveryId,webhookId,eventId,attempt,reasonCode | operations/tenant admin; no secret/full remote response |
| ReportGenerated | Reporting | reportId,scopeDigest,watermark,expiresAt | notify requester; download still authorized |
| AiRunCompleted / AiActionProposed / AiToolExecuted | AI | runId,policyVersion,modelVersion,proposalId?,toolId?,decisionId?,resultRef? | audit/review; model output cannot grant execution |

## Audit records versus domain events

Audit envelope includes event_id, trusted tenant/control-plane scope, stream/sequence, actor identity and delegation, action, resource type/id/version, result, occurred_at, correlation_id, policy_decision_id, source channel, minimized IP metadata if justified, changed field names and before/after digests, previous_hash and event_hash. Uppercase action codes such as RIGHTS_REQUEST_APPROVED are presentation mappings to canonical action names; use one registry to avoid double-counting.

Audit captures denied actions and sensitive reads even without domain events. Domain events support workflows, audit proves who attempted/did what. Audit loss causes mutation failure; dispatcher outage only delays eventual effects while durable outbox remains. Hash-chain serialization/version, per-tenant locked stream, signed external anchors and restore verification are specified in SECURITY_ARCHITECTURE. Key rotation preserves verification of old anchors. Security events from Keycloak/edge use separate ingress validation and durable buffering.

## Compatibility and operational controls

Add optional payload fields only if consumers tolerate them. Required field removal/type/meaning change requires new schemaVersion and dual compatible consumers. No event schema embeds a TypeScript class serialization. Keep historical schema decoders for replay. Monitor outbox age, dead letters, retry counts, sequence gaps, event-to-projection lag, audit anchor age and inbox conflict rate per tenant with cardinality limits. Reconciliation jobs compare expected business transitions with audit/outbox/consumer watermarks. Test crash points before/after transaction, dispatch, external effect and acknowledgement; verify duplicate delivery has one business effect and exactly attributable audit attempts.
