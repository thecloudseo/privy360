# Security architecture

This design requires independent verification; it is not a claim that an unbuilt product is secure. See THREAT_MODEL.md for abuse cases and recovery, RBAC_ABAC.md for grants, and ADRs 010–015, 019–022, 030.

## Trust boundaries and authenticated context

Internet → edge → BFF/API → domain transaction → data services; workers → authorized activity entry point; adapters → external systems; AI → untrusted model output. Each crossing authenticates its workload, validates schema and minimizes data. Private network placement alone is not authorization.

Staff login uses Keycloak OIDC authorization code + PKCE, exact redirect allowlists, state/nonce and issuer/audience/signature/expiry checks. BFF holds tokens server-side and browser receives only Secure HttpOnly SameSite=Lax host-only opaque session cookie. Mutation endpoints check CSRF token and Origin; no GET mutation. Sessions have idle/absolute lifetimes, rotation at login/elevation and server-side revocation; proposed staff defaults 30-minute idle/12-hour absolute, privileged step-up freshness 5 minutes, subject to approved policy. MFA mandatory for staff; phishing-resistant methods preferred for privileged roles. Recovery cannot bypass assurance; account linking requires verified proof, never email equality alone.

Principal portal uses a separate Keycloak client/audience and verified tenant-local subject binding. Risk-based assurance and recovery are OPEN-05. Public branding hostname identifies a published tenant surface only, never subject access. Reverse proxy strips untrusted forwarded headers; accepts host only from verified domain registry; domain ownership challenge and TLS must complete before activation, deactivation purges caches/routes.

TrustedContext = actor_id, actor_kind, tenant_id, membership_id, session/service identity, scope, principal_id when relevant, assurance, policy_version, correlation_id, deadline. Only server middleware or worker capability verifier constructs it. Tenant selection is a request to select a membership, followed by authoritative membership/status verification and server-side session binding. Header/body tenant_id never supplies identity. API JWT claims alone cannot keep a revoked membership alive: validate server-side membership/session/security epoch. Suspended tenants fail closed for data operations.

## Database isolation

Shared SaaS uses explicit tenant_id on all tenant-owned records and ENABLE + FORCE ROW LEVEL SECURITY. Runtime roles are non-owner, non-superuser, NOBYPASSRLS; migration ownership is separate and unavailable to applications. Policy has both USING and WITH CHECK equality against a transaction-local trusted tenant setting. Missing/invalid context returns no rows/denies writes; never use a default tenant. SELECT, INSERT, UPDATE, DELETE and join tables are covered. Tenant cannot be changed after insert. Composite foreign keys `(tenant_id, referenced_id)` prevent cross-tenant linkage. UNIQUE constraints include tenant where uniqueness is tenant-local.

Every unit of work opens a transaction, sets local tenant context via a parameterized trusted database adapter, executes repositories and closes/rolls back before connection reuse. No session-global SET, no business query before context. Pool-reuse, rollback, nested transaction and worker tests are mandatory. RLS protects against missing filters, not an arbitrary SQL execution compromise using the shared application role: parameterized SQL, no raw caller SQL, narrow DB privileges and independent review remain required. For stronger compromise isolation use dedicated database/workload credentials.

Global published regulatory tables are separate schema/read-only role; catalog publication is separate privileged reviewed operation. Platform tenant registry is control-plane-only. Tenant export/backup utilities cannot use runtime bypass privileges. No SECURITY DEFINER bypass helpers; any exceptional migration function needs explicit security ADR/review. RLS-aware views use invoker semantics and cannot run as table owner. Foreign-tenant IDs receive uniform non-disclosing 404 where appropriate; 403 for a known operation denied without disclosing object existence.

## Isolation beyond SQL

| Surface | Required binding and denial |
|---|---|
| Jobs/Temporal | Durable work item created atomically by authorized domain command; queue message references work ID, tenant, actor/delegation scope and policy version. Worker authenticates, loads work under tenant RLS, rechecks tenant state/current permission at execution and every destructive step. Workflow IDs/task queues are not authorization. No bearer tokens, PII or credentials in workflow history. |
| Cache | Key includes deployment, tenant, subject/scope fingerprint, policy epoch, resource version. Per-tenant quotas; sensitive responses no-store. Evict on revocation; authoritative auth does not depend on cache invalidation alone. |
| Search/projections | PostgreSQL RLS initially; mandatory tenant predicate plus resource authorization before snippets/counts. Future index physical/logical namespace and enforced server filter; never accept arbitrary client DSL. Tombstones and revocations purge indexes/embeddings. |
| Object storage | Server-generated deployment/tenant/object/version keys; no listing by users, no public buckets. Authorize DB metadata and classification before server-side streaming. Short-lived internal signed URLs only for scanner/services; if user download grants later enabled, bind one-use gateway grant and audit redemption. |
| Reports/exports | Capture approved query scope, reauthorize on job execution and download; encrypted tenant-scoped object with expiry; no email attachments containing exports. Revocation denies old export access. CSV formula neutralization and PDF/HTML sanitization. |
| AI/RAG | Authorize before retrieval and each result/tool use; tenant/scope/version-aware embeddings and cache. Never retrieve broadly then rely on model filtering. Egress policy, minimization and revocation checks apply to prompt assembly and output. |
| Connectors/webhooks | Connection belongs to one tenant; credentials from secret references scoped to connection; signed ingress resolves tenant from registered endpoint/credential, not payload. Replay and idempotency controls. |

## Secrets and cryptography

Select a portable secrets interface backed by Vault or customer-managed equivalent, and a KMS/HSM key provider. No secrets in database (only references), images, git, logs, workflow history or model prompts. Workload identity obtains short-lived credentials; rotation has staged activation/revocation and audit. Separate production/dev, tenant data keys, backup keys and signing keys. Privileged key administration requires dual control.

Proposed profile (OPEN-02 security approval before production): TLS 1.2 minimum/1.3 preferred with secure configured suites; established library/provider AES-256-GCM envelope encryption for sensitive payloads, per-object random data keys and unique nonces, authenticated context including tenant/object/version. KMS wraps DEKs; key IDs/version retained for decryption and rotation. Storage/database volume encryption supplements field/object protection. Searchable sensitive identifiers use tenant-keyed HMAC blind indexes with normalization version, never unsalted hashes; equality leakage documented. No home-grown algorithms. Key rotation rewraps DEKs where possible; revoke/crypto-erasure only after hold/backup obligations checked. Customer-managed keys can disable tenant decrypt operations, with explicit outage/recovery implications.

Signed audit anchors and software artefacts use provider-supported asymmetric signing with rotation and offline verification keys. Exact algorithms/provider certification requirements remain OPEN-02/03; these are not legal requirements inferred from DPDP.

## Evidence/file pipeline

Initiate authorized upload → reserve immutable version/limits → write encrypted quarantine object → confirm checksum/actual bytes → MIME magic detection, extension allowlist, decompression limits, malware scan in network-isolated sandbox → reject or mark AVAILABLE → custody/audit event. Scanner unavailable = remain quarantined. Do not overwrite an AVAILABLE version. Proposed initial 25 MiB limit, PDF/plain text/PNG/JPEG/CSV allowlist; office formats require sanitizer/CDR adapter before enablement. Block executables, HTML/SVG and active content. Untrusted filenames only display after escaping; keys are random server-generated values.

Download rechecks authorization and scan status; use attachment disposition, nosniff, restrictive headers and separate download origin. Previews are sanitized raster/text derivatives; scanner/preview workers have read-quarantine/write-derived only, no production DB credentials. Expired upload reservations cleaned safely. Hash and object version are bound to evidence metadata; scanner result refers to exact immutable bytes to prevent TOCTOU replacement.

## Audit and failure behavior

Security/compliance writes commit business change, minimal audit event and outbox in one database transaction; failure to persist audit aborts mutation. External side effects require an intent audit before execution and outcome/reconciliation after. Actor/action/resource/tenant/time/correlation/policy decision and changed field names/hashes are allowed; raw secrets, OTP, identity documents and full response bodies are forbidden. Sensitive reads, downloads, exports, denials, role changes and support elevation are audited. Authentication failures originate in IdP and ingest with loss monitoring; avoid leaking account existence.

Per-tenant monotonic sequence and canonical serialization hash-chain are created transactionally with locked stream head. Daily signed anchor manifests go to separately administered WORM/retention-locked storage; verify chain and anchors on schedule and restore. This detects tampering; a DB-only chain cannot defeat a privileged rewrite. Runtime audit permissions INSERT-only via audit port, no update/delete. Retention/partition removal uses approved privileged process preserving anchors and an erasure record; approved schedules are required.

Security telemetry and business audit are distinct. Durable IdP/security collector buffers; saturation raises alerts and privileged operations fail closed when required audit cannot be captured. Ordinary logging outages do not silently discard audit rows. Outbox backlog is monitored and reconciled.

## AI and integration guardrails

AI modes DISABLED (default), REDACTED_APPROVED_PROVIDER, PRIVATE_PROVIDER, CUSTOMER_HOSTED. Operator-approved provider catalog intersected with tenant policy, geography and classification. Prompts/documents/tool outputs are untrusted. Model receives minimal scoped data and provenance; prompt text cannot grant permissions. Tool registry contains typed input/output schema and specific domain commands; no SQL/shell/arbitrary URLs/unrestricted file access. Tool execution reauthorizes original actor, resource and current policy. Human confirmation is bound to proposed action digest/version/expiry; model cannot forge it. Legal determinations, exemption approval, rights rejection, breach submission and destructive actions remain human-gated or unavailable to AI. Provider failures yield an advisory failure, never an authorization fallback.

Connector executors use restricted egress proxy, DNS/IP validation at each redirect/connect, deny private/link-local/metadata destinations except explicitly configured customer network routes. Mutual authentication where supported, response size/time limits, pinned adapter versions, signed packages, circuit breakers and per-tenant rate budgets. Destructive connectors need separately scoped approval, dry-run plan, target revalidation, hold check and proof; no blind retry after ambiguous completion.

## Verification gates

Each tenant endpoint: A actor/B resource GET/POST/PATCH/DELETE/search/filter/export/graph and nested FK negative tests. Add session theft/revocation, role escalation, CSRF/XSS, injection, pool reuse, cross-tenant cache/object/workflow, malicious upload, audit failure and restore tests. Mandatory CI tools from MASTER_SPEC run on applicable changes without silent skips; no finding suppression to pass. Independent critical-area review and human/security acceptance precede production. No real-person data in dev/demo.

## Delegation and sensitive payload storage

USER_DELEGATED work requires the initiating actor to remain authorized. SYSTEM_POLICY schedules require a separate scoped service grant and approved policy version, current tenant state and live resource/hold checks; they do not inherit an indefinitely valid user session. No transition from delegated to system authority without a new audited approval. Sensitive case/response/contact/tool payloads use typed protected_payloads with tenant-bound envelope encryption and owner scope, not naked storage URLs. Approved identity/session binding and actor pseudonyms are specified in DATABASE_SPEC.
