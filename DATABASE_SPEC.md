# Relational database specification

Design contract only: no SQL migrations are created by this session. PostgreSQL schemas follow domain ownership. Typed repositories use parameterized SQL; schema evolution uses reviewed SQL migrations, expand/contract and tested rollback/restore strategy.

## Dictionary notation and mandatory inherited columns

Every table below is a major entity; each row defines purpose, owner (section), scope, important fields, relationships, extra constraints/indexes, retention and audit/privacy classification. These defaults are normative parts of every row, not optional conventions.

- **T** = tenant-owned. PK `id uuid` (UUIDv7 generated server-side); `tenant_id uuid NOT NULL REFERENCES platform.tenants`, `UNIQUE(tenant_id,id)`. Mandatory `created_at timestamptz`, `created_by uuid` actor reference, `updated_at`, `updated_by`, `version bigint >=1`. Immutable records retain these columns with updated values equal creation values; corrections append successors. FORCE RLS and INSERT/UPDATE WITH CHECK apply to every T table including links, outbox and partitions. Scope attributes `legal_entity_id`, `business_unit_id`, `sensitivity` exist on business aggregates; child rows inherit and must match their root scope. No nullable tenant_id.
- **G** = global approved regulatory/reference corpus, UUID PK plus stable code/version; no tenant_id. No customer data. Runtime SELECT published versions only; publisher role is separate. **P** = platform control-plane registry, UUID PK; no business runtime access; explicit platform authorization. Tenant root is P, while its organisation data is T.
- `x→y` means a non-null FK to y unless marked `?`; T→T uses composite `(tenant_id,x_id)→y(tenant_id,id)`, indexed `(tenant_id,x_id)`. T→G references immutable published version IDs. FK deletes RESTRICT by default. Link rows have UUID PK, stable edge_identity_id and assertion_revision, plus unique (tenant_id,edge_identity_id,assertion_revision), not opaque polymorphic references. Superseding assertions may have the same endpoints/valid_from; do not forbid history corrections with a unique endpoint/time constraint. Use deferred invariants or owner transactions for cross-row constraints.
- All T tables index `(tenant_id,id)` and `(tenant_id,created_at,id)` for cursor scans; all FKs indexed; common workflow lists add `(tenant_id,state,updated_at,id)`. Additional indexes/uniques appear per row. `U(...)` means unique within tenant for T, global for G/P. Filtered unique indexes handle active records. IDs in request DTOs must be checked for scope even though composite FKs also protect integrity.
- Types: codes/state = constrained text enums; names = bounded text (255 default); descriptions = bounded text (10,000 default); times = timestamptz; legal dates = date + named jurisdiction timezone; counts/version = bigint; scores = numeric with explicit range; digests = algorithm+hex; money is not modeled; payloads = bounded jsonb validated against versioned schema. JSON is not a substitute for graph relationships, access grants or legal identifiers. Text encoding UTF-8; case-insensitive keys store separately normalized value.
- Lifecycle retention codes: **C** retain versioned corpus/provenance indefinitely as non-personal reference; **O** operational metadata retained while active then approved tenant schedule; **S** session/credential/security metadata short approved schedule; **L** legally significant history per approved jurisdiction/tenant schedule plus holds; **F** file-specific schedule/hold/quarantine TTL; **J** job history bounded after reconciliation; **D** derived data rebuildable and purge on source expiry/revocation. No code implies a statutory duration. Production activation requires approved schedules (OPEN-04). Holds take precedence over erasure and are reviewed, not endless silent retention.
- Audit codes: **M** audit create/update/archive and sensitive read/export; **I** immutable append + access/export; **Q** queue state/retry/failure transitions; **V** reviewed publish/supersede decisions. Transactional audit applies unless table itself is audit storage; do not recursively audit audit-row append. Personal classification **0** no intended PD, **R** pseudonymous actor/subject references, **P** necessary personal/contact/case text encrypted or field-restricted, **X** secret reference only (never secret value). All free text is potentially personal: limit, classify and exclude from logs. Audit stores field names/digests, never raw personal diffs.

## Identity, tenancy and authorization

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| tenants | P | isolation root; slug,state,deployment_id,security_epoch | deployment registry | U(slug); immutable id; state ACTIVE/SUSPENDED/CLOSING | O | M/R |
| deployments | P | routing profile,region,connection_ref,capabilities | tenants 1:N | U(code); secret refs only; allowlisted routing | O | M/X |
| organisations | T | tenant operating organisation; name,locale,timezone | tenant | U(code) | O | M/0 |
| legal_entities | T | legal operating scope; name,jurisdiction | organisation | U(organisation_id,code) | L | M/0 |
| business_units | T | delegated unit; name,parent_id? | legal_entity; parent business_unit | reject cycles/cross-entity parents; U(legal_entity_id,code) | O | M/0 |
| departments | T | department scope; code,name | business_unit | U(business_unit_id,code) | O | M/0 |
| users | T | local staff membership identity; issuer,subject,display_name?,state | tenant | U(issuer,subject); no passwords; suspended blocks session | S | M/P |
| groups | T | named membership collection | organisation | U(code) | O | M/0 |
| group_members | T | effective membership; valid_from,to | group,user | U(group_id,user_id,valid_from); interval check | S | M/R |
| roles | T | approved role definition; code,delegation_ceiling | tenant | U(code); cannot create platform permissions | O | M/0 |
| permissions | G | compiled capability catalog; domain,resource,action | release manifest | U(domain,resource,action); not tenant-editable | C | V/0 |
| role_permissions | T | candidate action grant | role,permission(G) | U(role_id,permission_id) | L | M/0 |
| user_roles | T | role assignment; scope_kind,scope_set,valid_from,to,approved_by | user,role; grant_scopes | no self-elevation; U(user_id,role_id,scope_digest,valid_from) | L | M/R |
| group_roles | T | role binding to group and reviewed scope | group,role; grant_scopes | U(group_id,role_id,scope_digest,valid_from) | L | M/R |
| grant_scopes | T | typed legal_entity/business_unit/resource scope endpoints | user_role? or group_role? or service_grant? | exactly one grant owner; typed resource registry FK; no arbitrary JSON scope IDs | L | M/R |
| policy_versions | T | reviewed deterministic policy AST,digest,state | approver user | U(code,revision); immutable when approved | L | V/R |
| service_accounts | T | workload identity; issuer,client_id,state,credential_ref | tenant | U(issuer,client_id); no wildcard grants | S | M/X |
| service_grants | T | capability with validity/delegation scope | service_account,permission,policy_version | U(service_account_id,permission_id,scope_digest) | L | M/R |
| sessions | T | opaque session hash,identity kind,expiry,security_epoch | user? or principal? | exactly one subject; U(session_hash); expiry index; token_bundle_secret_ref points to encrypted server-side token bundle; browser never receives it | S | I/R |
| tenant_domains | T | hostname,challenge_digest,tls_ref,state | tenant | global reserved-host registry enforces unique normalized host; published only after verified | O | M/X |
| domain_reservations | P | unique normalized hostname→tenant binding | tenant | U(hostname); no public enumeration | O | M/0 |
| support_grants | T | operator actor ref,scope,purpose,expires_at,two approvers | tenant | expires within approved bound; no self-approval | L | I/R |
| resource_registry | T | immutable resource id,type,scope,sensitivity,owner reference | owning aggregate via registered FK/invariant | U(resource_type,resource_id); lifecycle tied to aggregate; not graph authority | O | M/R |

## Regulatory (owner Regulatory; tenant applicability/obligations owned Compliance)

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| regulatory_sources | G | original URI,issuer,title,language,published_at,retrieved_at,checksum,object_ref,verification state | immutable source object versions (each source row is one byte version) | U(checksum,issuer); fetch never publishes automatically | C | V/0 |
| regulations | G | stable jurisdiction,authority,code,title | sources via versions | U(jurisdiction,code) | C | V/0 |
| regulation_versions | G | revision,effective_from,to,recorded_at,state,supersedes_id? | regulation,source | U(regulation_id,revision); intervals reviewed; no overwrite after publication | C | V/0 |
| provisions | G | stable provision locator/code | regulation | U(regulation_id,code) | C | V/0 |
| provision_versions | G | text,language,locator,page/paragraph offsets,effective interval | provision,regulation_version,source | U(provision_id,regulation_version_id,language); immutable publication | C | V/0 |
| requirements | G | stable requirement_code,classification,family | regulation | U(requirement_code); classifications legal/control/good_practice | C | V/0 |
| requirement_versions | G | atomic wording,revision,interpretation_note,review_state,effective interval | requirement,provision_version,applicability_rule | U(requirement_id,revision); source citation required for legal class | C | V/0 |
| requirement_aliases | G | legacy/illustrative code alias | requirement | U(namespace,alias); aliases not independent law | C | V/0 |
| applicability_rules | G | versioned typed predicate,required_facts,unknown_behavior | requirement version through link | U(code,revision); AST allowlist; unknown cannot exempt | C | V/0 |
| requirement_applicability | T | outcome,rationale,facts_snapshot_ref,assessed_at,valid interval | requirement_version,legal_entity,activity?,policy_version | U(requirement_version_id,scope_digest,revision); outcome enum | L | V/P |
| obligations | T | scoped duty instance,status,due_rule_ref?,effective interval | applicability decision,requirement_version | U(applicability_id,scope_digest,revision); UNKNOWN not auto-satisfied | L | M/R |
| exemptions | T | claimed basis,rationale,state,expiry,reviewer | applicability,requirement_version,evidence? | human-approved only; expiry index | L | V/P |
| regulatory_changes | G | old/new version,diff_digest,change kind,state | regulation versions,source | U(old_version_id,new_version_id,diff_digest) | C | V/0 |
| regulatory_impacts | T | proposed impact,decision,status,reviewed_at | regulatory_change,obligation,control? | U(change_id,obligation_id,revision) | L | V/R |
| regulatory_reviews | G | review decision,actor_ref,scope_digest,reason,timestamp | source/version publication manifest | maker/checker distinct; append-only | C | I/R |
| publication_manifests | G | immutable bundle digest,source refs,version set,signature ref | regulatory_sources,regulation_versions | U(digest); complete reviewed set required | C | V/0 |

## Compliance (including atomic control and assessment definitions)

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| control_templates | G | code,family,revision,guidance,test_method | requirement_version | U(code,revision); published legal mapping reviewed | C | V/0 |
| controls | T | code,revision,title,class,family,owner,state,effective_from | control_template?,requirement_version | U(code,revision); legal class requires source and applicability; immutable definition when approved | L | M/R |
| control_mappings / requirement_controls | T | canonical table control_mappings; requirement→control trace with rationale | control,requirement_version | U(control_id,requirement_version_id); graph name requirement_controls is view, not duplicate store | L | V/R |
| obligation_controls | T | scoped obligation implementation mapping | obligation,control | U(obligation_id,control_id,valid_from) | L | M/R |
| control_implementations | T | implementation description,status,owner,test schedule | control,obligation | control/obligation mapping must exist; U(control_id,obligation_id,scope_digest,revision) | L | M/P |
| evidence_requirements | T | required type,freshness duration,sufficiency criteria,revision | control | U(control_id,code,revision); at least one before approving legal control | L | V/0 |
| test_definitions | T | method,input schema,criteria,automation adapter ref,revision | control,evidence_requirement | U(control_id,code,revision); deterministic comparator schema | L | V/0 |
| control_tests | T | run state,result,observed_at,finished_at,definition revision | implementation,test_definition | U(implementation_id,execution_key); result PASS/FAIL/INCONCLUSIVE; time index | L | I/R |
| assessment_templates | T | questionnaire schema,kind,revision,state | requirement mappings | U(code,revision); published immutable | L | V/0 |
| assessments | T | kind,state,revision,subject_scope | template,owner user,activity? | kind COMPLIANCE/PROCESSOR/DPIA; owner aggregate matches kind | L | M/P |
| assessment_answers | T | question_code,typed answer,source refs | assessment,evidence? | U(assessment_id,question_code,revision); schema validation | L | M/P |

## Data Governance

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| processing_activities | T | code,name,description,state,owner,geographies,ground_type | legal_entity,lawful requirement_version?,retention_policy? | U(code,revision); reviewed ground reference for legal assertion | O | M/P |
| purposes | T | code,label,description,revision,state | legal_entity | U(code,revision); no inferred consent equivalence | O | M/0 |
| data_categories | T | code,label,sensitivity,classifier provenance | parent category? | U(code); acyclic hierarchy | O | M/0 |
| data_elements | T | code,label,type,classification,source_field_ref | data_source? | U(source_id,code); metadata only, no citizen values | O | M/0 |
| data_subject_categories | T | code,label,child/guardian handling flag | tenant | U(code) | O | M/0 |
| systems | T | code,name,owner,hosting region,criticality,state | business_unit | U(code); restricted network metadata | O | M/P |
| data_sources | T | system source locator,format,classification | system,connector? | U(system_id,code); no embedded credentials | O | M/X |
| data_flows | T | source_system,target_system,direction,geography,purpose,transfer review | systems,purpose | no unreviewed external endpoint execution; FK endpoints; valid interval | O | M/0 |
| processing_systems | T | activity-system edge,role,provenance,valid interval | activity,system | U(edge_identity_id,assertion_revision) | O | M/0 |
| processing_processors | T | activity-processor participation,service role | activity,processor,processor_service? | U(edge_identity_id,assertion_revision) | O | M/0 |
| activity_subject_categories | T | subject category used by activity | activity,data_subject_category | U(edge_identity_id,assertion_revision) | O | M/0 |
| principal_system_refs | T | opaque subject handle,category presence,observed_at | principal,system,activity? | U(principal_id,system_id,handle_digest); encrypted handle; never bulk source data | L | M/P |
| discovery_runs | T | connector checkpoint,scan scope,state,counts | connector_run | U(connector_run_id); bounded scans | J | Q/R |
| discovery_observations | T | proposed field/classification/confidence,source locator | discovery_run,system,data_element? | U(run_id,source_locator_digest); no auto-promotion | D | M/P |
| lineage_edges | T | source_element,target_element,transformation reference,confidence | elements,discovery_run? | U(source_element_id,target_element_id,revision); versioned reviewed observations | O | M/0 |

## Notices and Consent

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| notices | T | stable code,title,audience,owner | legal_entity | U(code) | L | M/0 |
| notice_versions | T | revision,content_digest,structured_content,state,published_at,effective interval | notice,approver | U(notice_id,revision); publish freezes content and purpose set | L | V/P |
| notice_translations | T | locale,content,digest,review_state | notice_version | U(notice_version_id,locale); publication requires approved required locales | L | V/P |
| notice_purposes | T | immutable purpose/scope mapping | notice_version,purpose | U(notice_version_id,purpose_id) | L | V/0 |
| consent_purposes | T | purpose config,collection channel,scope schema,revision | purpose,notice_version | U(purpose_id,revision); no bundled implicit grants | L | V/0 |
| consent_events | T | sequence,action,scope_digest,channel,occurred_at,recorded_at,proof ref | principal,consent_purpose,notice_version,delegation? | U(principal_id,purpose_id,sequence); U(producer_id,idempotency_key); append-only | L | I/P |
| consent_receipts | T | receipt_digest,immutable scoped snapshot,event_id | consent_event | U(event_id); no editable receipt | L | I/P |
| preference_profiles | T | current state,last_event_sequence,projection_version | principal,consent_purpose | U(principal_id,purpose_id); CAS update from ledger | D | M/R |
| preference_options | T | typed optional communication preference schema,revision | consent_purpose | U(purpose_id,code,revision); preference is not automatically legal consent | L | V/0 |

## Rights and Privacy Centre

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| data_principals | T | opaque subject reference,issuer/subject binding?,contact_ref?,state | tenant | U(subject_reference); optional U(issuer,subject); no raw identity numbers | L | M/P |
| identity_verifications | T | method,assurance,result,expires_at,provider_ref,evidence_ref? | principal,rights_request? | no OTP/password storage; expiry index; restricted evidence | S | I/P |
| rights_requests | T | tracking code,type,state,submitted_at,due_at?,rule_version_ref,revision | principal,verification?,assignee?,activity? | U(tracking_code); no tracking-code-only access; enum states | L | M/P |
| rights_tasks | T | task kind,state,due_at,assigned_scope,minimal query ref | rights_request,assignee,system? | U(request_id,task_key); task scope cannot exceed request | L | M/P |
| rights_responses | T | revision,content_ref,digest,review_state,delivered_at | rights_request,evidence_version?,approver | U(request_id,revision); immutable approved content | L | V/P |
| rights_request_events | T | transition,from/to,reason,occurred_at | rights_request,actor | U(request_id,sequence); append-only workflow journal | L | I/R |
| nominations | T | nominator,nominee_ref,scope,state,proof_ref,expiry | principals,verification | scope enum; no access until verification and activation | L | V/P |
| delegation_grants | T | subject,delegate,relationship,allowed_actions,expiry,state | principal,nomination?/guardian verification | distinct identities; revocation effective immediately | L | V/P |
| grievances | T | category,case_ref,state,due_rule_ref?,response_ref | principal,rights_request? | U(tracking_code); human resolution/review | L | M/P |
| privacy_centre_configs | T | revision,brand tokens,logo_ref,languages,contact,request types,auth policy | tenant_domain,notice versions | U(domain_id,revision); no arbitrary HTML/JS/theme URL; publish review | O | V/P |

## Vendors, Risk and DPIA

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| vendors | T | code,legal_name,contact_ref,state | legal_entity | U(code); encrypt necessary contacts | O | M/P |
| processors | T | processor role,status,owner | vendor | U(vendor_id,code) | L | M/R |
| processor_services | T | code,description,regions,capabilities | processor | U(processor_id,code) | O | M/0 |
| processor_contracts | T | revision,effective_from,to,terms metadata,document_ref | processor,evidence_version | U(processor_id,contract_code,revision) | L | V/P |
| processor_assessments | T | review_state,decision,reviewed_at | processor,assessment | U(assessment_id); assessment.kind PROCESSOR | L | V/R |
| subprocessors | T | parent_processor,child_processor,service,valid interval | processors,service? | reject self/cycle; U(parent_id,child_id,service_id,valid_from) | L | M/0 |
| risks | T | code,title,likelihood,impact,residual rating,state,owner,methodology_version | legal_entity | U(code); rating bounds; accepted risk expiry required | L | M/P |
| findings | T | severity,description,state,source kind | test? / dpia? / audit_finding? | exactly one typed source FK; no unvalidated source IDs | L | M/P |
| remediation_tasks | T | title,state,due_at,owner,closure proof | finding?,risk? | at least one justified source; independent closure check | L | M/P |
| exceptions | T | scope,rationale,state,expiry,reviewer,compensating controls | risk,control? | non-empty expiry; cannot override legal holds/tenant security | L | V/P |
| dpias | T | activity scope,revision,state,decision,reviewer | assessment,processing_activity | U(activity_id,revision); assessment.kind DPIA | L | V/P |
| risk_methodologies | T | revision,likelihood/impact scales,thresholds | tenant | U(code,revision); immutable approved | L | V/0 |

## Incident, Retention and Deletion

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| incidents | T | code,title,severity,state,declared_at,owner | legal_entity,processor? | U(code); timeline immutable append | L | M/P |
| breach_assessments | T | determination,reason,revision,reviewer,decided_at | incident,evidence? | U(incident_id,revision); human decision; no automatic legal assertion | L | V/P |
| affected_data | T | incident data scope,estimated_count,confidence | incident,category,system?,activity? | nonnegative counts; metadata rather than raw data | L | M/0 |
| affected_principals | T | affected-subject reference,notification status | incident,principal | U(incident_id,principal_id); highly restricted list | L | M/R |
| notification_tracks | T | regime,trigger_at,due_at?,rule_version,status | incident,requirement_version? | U(incident_id,regime,revision); unknown deadline flagged | L | V/R |
| incident_actions | T | action kind,state,assignee,performed_at,proof | incident,track? | U(incident_id,action_key); append outcome history | L | M/P |
| retention_policies | T | code,revision,state,purpose,rationale | legal_entity,requirement_version? | U(code,revision); effective intervals | L | V/0 |
| retention_rules | T | trigger type,duration,evaluation AST,scope | policy,category?,activity?,system? | duration >=0; reviewed statutory source when claimed | L | V/0 |
| legal_holds | T | authority,scope,state,starts_at,review_at,release_reason | policy?,principal?,activity?,system? | typed target scope; release separate approval | L | V/P |
| retention_exceptions | T | reason,expiry,state | retention_rule,legal_hold? | no indefinite unchecked override | L | V/P |
| retention_evaluations | T | evaluated_at,policy_version,facts_digest,result | retention_rule,resource_registry | U(rule_id,resource_id,evaluation_key) | L | I/R |
| deletion_jobs | T | scope,reason,state,requested_at,approved_at,plan_digest | retention_evaluation? / rights_request? | one initiating source; approval bound to plan version | L | M/P |
| deletion_targets | T | opaque locator,state,attempt_count,capability,checkpoint | job,system,connector? | U(job_id,system_id,target_digest); encrypted locator | L | M/P |
| deletion_confirmations | T | outcome,proof_digest,observed_at,provider_receipt | target,evidence_version? | U(target_id,attempt_key); append-only; ambiguous is not success | L | I/R |
| erasure_tombstones | T | minimal keyed subject/object digest,scope,deleted_at,restore_until | deletion_job | U(target_digest,scope_digest); separate protected restore ledger | L | I/R |

## Evidence, Audit, Reporting and workflow infrastructure

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| evidence | T | stable code,title,class,owner,retention_rule | tenant | U(code); no bytes inline | F | M/P |
| evidence_versions | T | version_no,object_key,object_version,digest,mime,bytes,state,captured_at,expires_at,origin | evidence | U(evidence_id,version_no); bytes>0; immutable AVAILABLE bytes | F | I/P |
| upload_reservations | T | expected digest/size,expires_at,state,quarantine key | evidence_version | U(version_id); enforce quota and one confirmation | J | Q/R |
| evidence_custody | T | action,actor/service,at,source/result digest | evidence_version | U(version_id,sequence); append-only | L | I/R |
| audits | T | engagement code,scope,period,state,auditor | legal_entity | U(code); auditors cannot change operational facts | L | M/R |
| audit_findings | T | severity,statement,state,source refs | audit,control?,evidence_version? | bounded statement; auditable closure | L | M/P |
| audit_events | T | stream sequence,event_id,actor,action,resource ref,time,policy,correlation,prev/event hash | audit_stream | U(event_id); U(stream_id,sequence); append only; timestamp index | L | I/R |
| audit_streams | T | stream_id,last_sequence,last_hash | tenant | U(stream_id); locked update for chain | L | I/0 |
| audit_anchors | T | sequence interval,root/hash,signature_ref,object_ref,verified_at | audit_stream | U(stream_id,end_sequence); separate WORM copy | L | I/0 |
| report_jobs | T | report_type,query_digest,scope_snapshot,state,watermark,expiry | requester,evidence/output ref? | U(requester_id,idempotency_key); no unchecked query SQL | J | Q/R |
| report_objects | T | encrypted object metadata,expires_at,classification | report_job | U(job_id,version); authorized download only | F | I/P |
| graph_snapshots | T | as_of,known_at,scope_digest,watermark,manifest_digest | report_job? | U(scope_digest,as_of,known_at,watermark); derived | D | I/R |
| outbox_events | T | envelope,payload_schema,state,attempts,available_at | aggregate reference | U(event_id); index(state,available_at); atomic business transaction | J | Q/R |
| inbox_receipts | T | consumer,event_id,processed_at,result_digest | outbox/external event ref | U(consumer,event_id); dedupe transaction with effect | J | I/R |
| work_items | T | workflow_type,resource_ref,scope_snapshot,delegator,policy,state | owner resource_registry | U(workflow_type,business_key); current auth recheck | J | Q/R |
| idempotency_records | T | actor,route,key,request_hash,response_ref,status,expires_at | actor | U(actor_id,route,key); bounded retention; hash conflict 409 | J | I/R |
| approval_records | T | proposal_digest,action,resource/version,maker,checker,expiry,decision | resource_registry | maker != checker; U(proposal_digest,checker_id); append-only | L | I/R |

## Integrations, Notifications, AI and product extension

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| connectors | T | adapter_id/version,capabilities,egress policy,state,owner | system? | U(code); capability allowlist; destructive default off | O | M/0 |
| connector_credentials | T | secret_ref,key_version,rotated_at,state | connector | U(connector_id,credential_slot,version); no secret bytes | S | M/X |
| connector_runs | T | operation,input_ref,checkpoint,state,attempts,result_ref | connector,work_item | U(connector_id,operation,idempotency_key) | J | Q/R |
| webhooks | T | endpoint URL,signing_key_ref,events,state,direction | connector? | URL egress policy; unique endpoint registration | O | M/X |
| webhook_deliveries | T | event_id,attempt,next_at,status,receipt digest | webhook | U(webhook_id,event_id,attempt); bounded retry; no payload secrets | J | Q/R |
| notifications | T | template_version,recipient_ref,payload_ref,state,channel,receipt | rights_request? / incident_action? / work_item? | exactly one owner; U(owner_id,message_key); approval before sensitive send | J | Q/P |
| notification_templates | T | code,revision,locale,content schema,state | tenant | U(code,revision,locale); sanitize content | L | V/0 |
| ai_policies | T | mode,provider_allowlist,data classes,tool scopes,revision | policy_version | U(revision); disabled default | L | V/0 |
| ai_runs | T | requester,policy_version,model/config version,status,redacted provenance,tokens | ai_policy,work_item? | U(requester_id,idempotency_key); no raw prompts by default | J | Q/R |
| ai_retrieval_refs | T | source ID/version,digest,authorization decision,rank | ai_run,resource_registry | U(run_id,source_id,source_version); metadata only | J | I/R |
| ai_action_proposals | T | tool/action,args_ref,digest,state,expires_at | ai_run,approval_record? | typed tool registry; no direct execution by model | J | V/P |
| embedding_chunks | T | resource_id/version,chunk_digest,classification,vector_ref | resource_registry | U(resource_id,version,chunk_digest,model_version); RLS, authorization filter; no global tenant index | D | M/P |
| sector_pack_installs | T | pack/version,digest,applied diff,reviewer | tenant | U(pack_id,version); creates drafts | L | V/R |
| custom_field_definitions | T | entity_type,code,schema,sensitivity,retention,revision | tenant | U(entity_type,code,revision); cannot override reserved fields | O | V/0 |
| custom_field_values | T | typed value,definition_version | resource_registry,custom_field_definition | U(resource_id,definition_id); schema/type check | O | M/P |
| simulation_runs | T | snapshot,scenario schema,policy version,state,result ref | graph_snapshot | no mutation of live entities | D | Q/R |
| policy_evaluations | T | build/external ref,bundle version,findings digest,status | policy_version,connector_run? | U(external_ref,bundle_version,scope_digest); CI cannot self-approve exception | L | I/R |

## Typed graph association dictionary

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| implementation_systems | T | control_implementations↔systems provenance edge; valid_from,to,recorded_at,reason,source_ref | control_implementations,systems | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| implementation_activities | T | control_implementations↔processing_activities provenance edge; valid_from,to,recorded_at,reason,source_ref | control_implementations,processing_activities | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| test_evidence | T | control_tests↔evidence_versions provenance edge; valid_from,to,recorded_at,reason,source_ref | control_tests,evidence_versions | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| evidence_activities | T | evidence_versions↔processing_activities provenance edge; valid_from,to,recorded_at,reason,source_ref | evidence_versions,processing_activities | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| activity_purposes | T | processing_activities↔purposes provenance edge; valid_from,to,recorded_at,reason,source_ref | processing_activities,purposes | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| activity_data_elements | T | processing_activities↔data_elements provenance edge; valid_from,to,recorded_at,reason,source_ref | processing_activities,data_elements | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| element_categories | T | data_elements↔data_categories provenance edge; valid_from,to,recorded_at,reason,source_ref | data_elements,data_categories | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| system_data_elements | T | systems↔data_elements provenance edge; valid_from,to,recorded_at,reason,source_ref | systems,data_elements | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| flow_activities | T | data_flows↔processing_activities provenance edge; valid_from,to,recorded_at,reason,source_ref | data_flows,processing_activities | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| flow_processors | T | data_flows↔processors provenance edge; valid_from,to,recorded_at,reason,source_ref | data_flows,processors | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| control_risks | T | controls↔risks provenance edge; valid_from,to,recorded_at,reason,source_ref | controls,risks | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| activity_risks | T | processing_activities↔risks provenance edge; valid_from,to,recorded_at,reason,source_ref | processing_activities,risks | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| system_risks | T | systems↔risks provenance edge; valid_from,to,recorded_at,reason,source_ref | systems,risks | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| evidence_risks | T | evidence_versions↔risks provenance edge; valid_from,to,recorded_at,reason,source_ref | evidence_versions,risks | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |
| risk_remediations | T | risks↔remediation_tasks provenance edge; valid_from,to,recorded_at,reason,source_ref | risks,remediation_tasks | U(edge_identity_id,assertion_revision); interval check; indexes on both endpoint directions and recorded_at | L | M/R |

Evidence requirement→control is its FK, not another join table; `evidence_requirement_controls` in graph terminology denotes that edge. `findings` may relate to a test that refers to evidence; risk linkage remains explicit. Graph link owners: Compliance owns implementation/test links; Governance owns activity/element/system/flow links; Evidence owns evidence_activities; Risk owns *_risks and risk_remediations. Endpoints must verify both ends and their scopes.

## Cross-row integrity and state consistency

Approve a legal control only when published requirement version, source citation, effective_from, approved applicability rule and >=1 evidence requirement exist. This is an owner-transaction invariant plus regulatory traceability CI fixture check, not an assumption that a nullable FK is sufficient. Shared corpus publication validates all version references and signatures before a single published manifest becomes visible. Global publication audit uses a separate platform append-only stream with the same anchoring contract (no fabricated tenant ID).

`version` implements optimistic concurrency with `UPDATE ... WHERE version=expected`; 409 on conflict, no lost update. Unique consent sequence acquired under per-principal/purpose stream lock; event_time does not reorder ledger. Current consent state uses recorded sequence and preserves occurred_at separately. Idempotency records and mutation/audit/outbox commit atomically. Scope moves, holds, deletion approval and execution need row locks/serializable conflict retry where necessary. Check active holds immediately before destructive operation under a scoped execution lease; new hold blocks pending targets, and cannot undo an already completed external deletion.

No hard deletion of referenced legal history, consent events, tests, evidence versions or audit records through CRUD. Archive operational records, apply approved erasure via Deletion with hold checks and minimally necessary tombstones. Purge derived stores and encrypted blobs as part of the same tracked plan; asynchronous purge failures remain visible. Backups age under approved retention and restore replays the protected erasure ledger before serving traffic.

## Partitioning and performance

Partition high-volume audit_events/consent_events by recorded month only after measured need; partitions inherit tenant RLS/privileges, and partition DDL has negative tests. Maintain an unpartitioned event-key ledger when global uniqueness cannot be enforced across time partitions. Index query patterns, not every JSON property. Start graph traversal with tenant and permitted scope; index every reverse edge. Use PostgreSQL full-text search with RLS initially, no shared unscoped materialized view. Readiness projection includes tenant, scope, policy version, watermark and evidence-expiry recomputation time. Do not use lagging replicas for authorization or read-after-write workflows.

## Evolution and retention

Migration owner role is used only by pipeline job. Expand first, deploy dual-compatible readers/writers, backfill in tenant-bounded chunks with audit, verify counts/FKs/RLS, then contract in a later release. Downgrade must not discard law versions or personal-data erasure state; irreversible changes require restore/forward-fix plan and approval. No migrations authored here. Retention schedules specify purpose, legal basis when verified, lifecycle trigger, duration, hold behavior, purge mechanism and audit minimization. Every P field needs a collection necessity decision before production. No raw Aadhaar value, biometric, password, OTP, bearer token or connector secret has a business-table field in this design.

## Consistency refinements from architecture review

All temporal graph edges, including non-dictionary aliases and processing links, have stable `edge_identity_id`, `assertion_revision`, `valid_from`, `valid_to?`, `recorded_at`, `supersedes_assertion_id?`, `is_retraction` and actor/source provenance. Assertions are append-only. To close/correct an edge, append a successor with corrected valid interval; do not edit the old assertion. For `known_at`, choose latest assertion recorded at/before that instant for each identity, then apply valid-time interval and retraction. This preserves prior knowledge when a late correction changes valid_from/valid_to. Uniqueness is tenant+edge_identity+assertion_revision; enforce no duplicate active logical edge at owner-transaction validation. Current views hide superseded assertions. Legal version interval corrections use the same supersession principle.

`resource_registry` is an authorization/job reference index, not the evidence graph. Each owning aggregate has `resource_registry_id` FK with unique registration and matching tenant/type. Creation/archive occurs atomically through an owner port; registry ID identifies one aggregate. Foreign references for graph integrity remain typed aggregate FKs. Do not allow a caller to register an arbitrary entity/type. Historical audit resource identifiers may outlive erased registry details, by approved retention policy.

Actor and payload reference records added for complete persistence contracts:

| Table | Scope | Purpose / important fields | Relationships | Constraints and extra indexes | Retention | Audit/PD |
|---|---|---|---|---|---|---|
| actor_refs | T | stable audit actor id; kind USER/PRINCIPAL/SERVICE/SUPPORT/BOOTSTRAP; identity reference and pseudonym | exactly one corresponding identity/grant except signed bootstrap | U(kind,identity_ref); identity fields not writable by callers; bootstrap restricted provisioning | L | I/R |
| protected_payloads | T | encrypted case/response/contact/notification/tool-argument payload; purpose,classification,key_ref,object_ref,digest,expiry | resource_registry owner | U(owner_id,purpose,revision); approved necessity/retention; immutable revision | F | I/P |
| principal_bindings | T | verified issuer/subject/assurance binding with valid interval and revocation | principal,verification | U(issuer,subject) while active; verified linking, no email equality | L | V/R |
| platform_audit_events | P | platform/corpus operation audit envelope,stream sequence/hash | platform audit stream and operator pseudonym | U(event_id),U(stream_id,sequence); append-only, no tenant business payload | L | I/R |
| platform_audit_streams | P | last_sequence,last_hash,anchor_ref | platform registry | U(stream_id); independently anchored same as tenant streams | L | I/0 |

`created_by`/`updated_by` and audit actor fields reference actor_refs within tenant; platform audit uses platform operator pseudonyms. System/bootstrap actor rows are created by the restricted provisioning transaction; never public input. Token bundles are held by the secrets/session adapter with encrypted storage, not in protected_payloads. `content_ref`, `contact_ref`, `payload_ref` and sensitive `args_ref` mean typed protected_payloads references with owner, scope and retention, not arbitrary URI strings. Evidence file references mean evidence_versions IDs; no auto-fetch of referenced URL. API object projection decrypts only permitted fields and sensitive reads are audited.

Future notification/legal deadline rules use approved requirement-version data and typed duration semantics. An unknown legal effective date is explicitly UNKNOWN in draft corpus; publication may preserve an unresolved commencement relationship but cannot activate a control asserting an effective_from until it is legally reviewed and known. Unknown must never be replaced by ingestion date.

Bootstrap migration ordering: TENANT-001 creates tenant registry, actor_refs and resource_registry before identity/business tables. A restricted provisioning transaction inserts a BOOTSTRAP actor whose self-reference is checked with a deferred FK; no public API can create that kind. Later identity migrations add typed identity FKs and enforce exactly one matching identity source for non-bootstrap actors. AUDIT-001 creates both tenant and platform audit streams before audited provisioning is enabled. SECURITY-001 creates protected payload storage after authorization/audit and before evidence/rights modules. Test-only bootstrap fixtures do not become production bypass credentials.
