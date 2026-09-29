# Deployment, operations and disaster recovery

## One product, four deployment profiles

Same signed application/worker images, domain contracts and migrations in all profiles; provider adapters/configuration differ. Configuration validates required capabilities at startup and fails closed on missing secrets, tenant isolation, storage encryption or identity settings. Feature flags enable complete reviewed modules, never remove security gates. Dedicated installations retain tenant_id/RLS to prevent accidental unsafe assumptions and support multiple legal entities without forks.

| Profile | Compute/data isolation | Identity, storage, keys and operations |
|---|---|---|
| Shared SaaS | Multi-zone private Kubernetes or equivalent orchestrated workloads; shared PostgreSQL with FORCE RLS; bounded tenant quotas | Keycloak realm per deployment initially, separate staff/portal/service clients; S3-compatible encrypted storage; per-tenant envelope keys; operator-managed backup and observability; strict support grants |
| Dedicated tenant SaaS | Dedicated namespace AND database with separate credentials/key material; optionally dedicated cluster/account per contract. Namespace alone is not a hard security boundary | Same chart/image, tenant-specific Keycloak realm/client federation, storage bucket/credentials and backup policy; no shared sensitive cache/index; dedicated worker pools as needed |
| Customer VPC/cloud | Customer account/network; private endpoints; customer DB/Redis/Temporal/S3-compatible services validated by adapter tests | Customer DNS/TLS, KMS/HSM, SAML/OIDC through Keycloak, proxy/egress allowlist, telemetry to customer endpoint; support has no default remote access |
| Government/on-premise | Customer-managed Kubernetes/reference private cluster; optional fully disconnected operation; PostgreSQL HA, Redis, Temporal, S3-compatible appliance, local Keycloak | AD/LDAP federation through Keycloak, customer DNS/TLS/CA, Vault/KMS/HSM adapter, local SIEM/observability, signed offline updates and regulatory bundles, customer-controlled backups. No public CDN, SaaS licence heartbeat, external AI or public identity dependency |

S3-compatible MinIO is a reference adapter, not a mandatory proprietary dependency. Validate object locking/versioning/encryption/multipart/checksum semantics against selected provider. Customer storage without required controls fails profile validation. Managed equivalents are accepted only if they satisfy documented contract tests. Additional jurisdictions/residency are configuration and approved corpus, not a separate codebase.

## Network and runtime topology

WAF/load balancer→web/portal ingress→BFF/API gateway→NestJS→private PostgreSQL/Redis/Temporal/Keycloak/object storage. Separate network policies/service identities for web, API, worker, scanner, connector, AI, migration, backup and operations. Default-deny ingress/egress; only ingress is public. PostgreSQL, Redis and Temporal administrative endpoints are private. Containers run non-root, read-only filesystem where feasible, dropped capabilities, seccomp, resource limits and signed pinned images. Secrets injected at runtime via workload identity; no shared node-admin credentials.

Scanner has no arbitrary egress. Connectors/AI run in restricted execution pools through approved egress proxy. Customer-network connectors use explicitly approved private routes; SaaS workers cannot discover customer addresses by following untrusted URLs. Dedicated tenants may receive separate execution pools, DB, cache and buckets. Routing tenant→deployment happens after trusted identity/membership; connection strings never originate from request fields.

## Availability and scale

Stateless API/BFF replicas across failure domains; worker replicas with bounded leases; PostgreSQL synchronous local failover where SLO requires and PITR WAL archive; Redis HA where session/rate-limit availability requires (not a source of business truth); Temporal service/persistence HA; replicated object storage; redundant Keycloak backed by its own supported database/schema and credentials. Do not share application business tables with IdP/Temporal persistence. Loss of Redis denies rate-sensitive operations or uses conservative local limits; session state loss forces reauthentication, not anonymous fallback. Loss of DB/audit rejects mutations. Scanner loss quarantines. AI loss disables assistance. Connector loss queues/reconciles.

Internal design targets pending OPEN-06: shared SaaS RPO ≤15 minutes and RTO ≤4 hours for regional recovery; dedicated enterprise option RPO ≤5 minutes/RTO ≤1 hour only after sizing, replication and drills demonstrate it. 99.9% initial SLO and 99.95%+ enterprise capability are product targets, not contractual claims. Consent throughput target must be measured/approved; load test includes hot principal streams and tenant fairness. Autoscaling uses queue age and latency, not just CPU. Avoid per-tenant unbounded metrics labels.

## Backup and restore

Encrypt full backups plus continuous WAL; versioned/locked object storage; Keycloak database, Temporal persistence, deployment config, key metadata and regulatory manifests included. Backups use separate identities/account or offline vault, immutability and least privilege; application/ransomware credentials cannot delete backup copies. Key recovery is separately protected and dual-controlled. Do not claim encryption if keys are stored with the backup unprotected. Region/replication residency requires OPEN-03 approval.

Maintain a coordinated restore manifest: DB restore point, object versions, audit anchors, erasure-ledger checkpoint, corpus versions and workflow compatibility version. Restore into isolated environment → verify checksums/signatures and audit chain/anchors → recover keys → restore database/object versions → apply erasure tombstones/expired retention and revoke old sessions/credentials as required → reconcile Temporal work/outbox/inbox/external effects → validate tenant isolation and integrity → explicit operator approval before traffic. A restored workflow must not resend notifications or repeat destructive operations without reconciliation.

Do not restore a single tenant by inserting arbitrary backup rows into shared production. Restore full snapshot isolated, extract only approved tenant under validated scope, reconcile references/keys/tombstones, review and import through controlled tooling. Quarterly full restore drills and pre-production proof are initial operational policy; customer schedules may be stricter. Track achieved RPO/RTO and corrective actions. No backup schedule becomes a legal compliance claim.

## Observability and operational response

OpenTelemetry traces/metrics via portable collector; Prometheus-compatible metrics, structured redacted logs and customer SIEM export. Correlation IDs propagate API/outbox/workflow/connector; never include full prompts, credentials or personal payloads. Monitor p95 latency, 5xx, authentication failures, privileged actions, tenant denials, rights backlog/deadlines, connector/deletion/webhook/AI failures, DB health, queue lag, audit persistence/anchor age, storage scan backlog and backup/restore results. Alert routes/runbooks have named operator ownership; tenant dashboards receive only authorized aggregates.

Proposed alerts: any audit persistence failure/page immediately; anchor age >26h/page; oldest outbox >5m/warn then >15m/page; failed backup/page; tenant-escape signal/page; sustained 5xx/latency uses measured SLO burn-rate thresholds. Exact production thresholds calibrated with traffic, recorded in configuration; no silent alert suppression. Sensitive support diagnostics require tenant-scoped grants. Telemetry outage has its own health signal.

## CI/CD and change safety

Local→Development→Integration→Staging→Security Staging→Production. Synthetic data only outside approved production. Every PR: ESLint, TypeScript, Vitest/Jest, Playwright for applicable UI, Semgrep, CodeQL, Trivy/container scan, Gitleaks, ecosystem dependency scan + pnpm audit, Checkov for IaC and SBOM. If a scanner is inapplicable, CI reports an explicit justified status rather than silent omission; license/offline constraints require approved equivalent coverage. Independent DAST and VA/PT before government production; remediation verification mandatory.

Build once, sign/version artefacts and provenance, promote same digest; reviewed PR and human/security gate for critical areas. Migrations execute via separate restricted job; preflight backup and schema compatibility checks; rolling app deploy supports old/new schema. Rollback app image only if compatible; destructive schema changes require forward repair/restore plan. No routine direct SSH changes. Audit deployment, config and key changes.

Disconnected bundle includes signed OCI images, dependency/SBOM/provenance, chart/config schemas, vulnerability results, migration plan, rollback instructions, corpus manifest and public verification keys. Customer imports into internal registry; no runtime internet dependency. Clock synchronization, internal CA revocation, signature-key rotation and offline vulnerability-feed updates are documented operational prerequisites. Regulatory ingestion supports reviewed offline signed documents; no attempt to browse public sources from air-gapped deployment.

## Release evidence

Government production gate: tenant escape suite, API penetration testing, critical source review, container/cloud configuration review, external VA/PT with verified remediation, restore/HA exercise, performance/load results, accessibility report, operating/support manuals, approved retention/residency/keys, and customer acceptance. Bid release uses the same controls for included features and synthetic data; it is not evidence of production approval or completed later modules.
