# Privy360 — Production Architecture Baseline

Baseline: 2026-09-30. Authority: AGENTS.md, MASTER_SPEC.md and the owner's scope clarification: architect the complete product; the Government Bid is an early release of permanent, production-quality capabilities. This baseline specifies engineering decisions; it does not assert security approval, legal verification, implementation completion or production readiness. ADRs marked Selected are the Chief Architect's baseline choices. Approval-pending deployment, legal and cryptographic matters are recorded below.

## Scope and clean-room provenance

Only this repository was inspected. Initially it contained AGENTS.md and MASTER_SPEC.md, no application files, and an unborn main branch with no commits. Neither input was changed. No external source, connector, old prototype or official legal document was inspected or imported. Official regulatory corpus, approved interpretations, hosting contract, identity assurance policy and customer deployment requirements are MISSING. Examples in MASTER_SPEC.md are product intent, not verified legal text. No application, migration, controller or infrastructure implementation is part of this baseline.

## System shape

Use a TypeScript modular monolith: two Next.js/React surfaces (enterprise console and Privacy Centre), a NestJS application API and separately scalable workers loading the same domain packages. PostgreSQL is the authoritative relational store and evidence graph. Redis holds expendable cache/rate-limit data. Temporal coordinates durable workflows; it is not the business record. Keycloak handles identity protocols and credentials. S3-compatible storage holds encrypted, scanned evidence and report objects. A secrets/KMS adapter and OpenTelemetry instrumentation keep cloud and disconnected deployments portable.

Flow: browser → WAF/ingress → Next.js server/BFF → NestJS authenticated context → deterministic policy → domain service → PostgreSQL transaction (business state + audit + outbox). Workers consume the outbox and start/signal Temporal workflows. Workflow activities re-enter domain services through a scoped execution context. Object downloads, connector calls and AI retrieval are authorized independently of UI navigation.

The enterprise console and Privacy Centre have separate origins, clients, audiences, session stores/namespaces and content-security policies. Public published content has a deliberately small anonymous API. Administration/control-plane routes and tenant business routes use separate audiences and route groups. No global administrator automatically receives tenant business access.

## Intended repository layout (not implemented in this session)

- apps/web, apps/privacy-centre: Next.js server rendering, BFF session endpoints and presentation; no database access or domain authorization logic.
- apps/api/src/modules/<module>: NestJS adapters and composition; apps/worker: outbox dispatch and Temporal activities.
- packages/domain/<module>: domain entities, policies and application ports; packages/database: SQL repositories and migrations; packages/contracts: OpenAPI/JSON Schema/event definitions and generated types.
- packages/auth, security, audit, regulatory, workflows, integrations, notifications, ai: explicit shared capability ports. packages/ui: accessible components and translation infrastructure.
- specs/{product,architecture,api,database,security,ux,workflows,acceptance}: refinements referencing this baseline; regulations/india/dpdp/{act-2023,rules-2025,corrigenda,notifications,controls,evidence}: approved source manifests and corpus artefacts only.
- infra/{docker,terraform,kubernetes,helm}, tests/{unit,integration,e2e,security,tenancy,regulatory}, docs, scripts: created by later tickets.

Use pnpm workspaces and a single lockfile. TypeScript strict mode. SQL-first migrations and typed SQL repositories (Kysely adapter); no ORM auto-sync. Exact supported runtime/library versions are pinned and verified during FOUNDATION-001, not guessed here. Domain logic must not depend on Next.js, NestJS decorators, Keycloak clients, Temporal SDKs or a cloud SDK.

## Boundary and dependency rules

MODULE_BOUNDARIES.md names every data owner. Only that owner writes its tables. Cross-module commands call public application ports; queries use authorized read ports or deliberately owned projections. No arbitrary table access, shared mutable entities or circular module imports. Shared kernel contains IDs, trusted context, clocks, errors and value types, not business services. PostgreSQL transactions may atomically invoke two module ports through an orchestration service when an invariant requires it; adapters receive the same transaction/context. Events handle eventual effects, never substitute for atomic safety constraints.

Extract a process only for demonstrated independent scaling, isolation or operational ownership. Connector execution, file scanning and AI provider calls are isolated workers because they process untrusted material/egress; this does not split domain ownership into microservices. No Kafka, graph database or external search engine is required initially. Explicit adapter/projection contracts permit later introduction by ADR and measured need.

## Product completeness and extensibility

Regulatory data includes jurisdiction, issuing authority, source language, effective intervals, version lineage, reviewed interpretations and policy bundles. India DPDP is the first corpus, not a code branch embedded across modules. Additional jurisdictions and parallel notification tracks use the same structures without asserting any unimported legal obligation. Multi-entity organisations, delegated business-unit access, sensitivity labels, sector templates, locale/timezone preferences and customer-controlled deployment configuration exist from the first schema design.

Consent Manager interoperability uses a versioned integration adapter; external registration or interoperability conformance is not assumed. Discovery/classification/lineage produce reviewed inventory proposals. Digital Twin and Privacy CI/CD use graph snapshots and deterministic policy evaluation; advanced agents use approved tools through AI Gateway. They share permanent contracts rather than demo tables or shadow authorization.

Versioned configuration and typed custom fields support enterprise variation. Custom fields have schema, sensitivity, retention and export policy; cannot redefine tenant ownership, authorization or legal facts. Workflow definitions use reviewed declarative states/guards, not arbitrary tenant code. Sector packs are signed/versioned templates with provenance, reviewed mappings and upgrade diffs, never silently applied statutory defaults.

## Nonfunctional contracts

Targets from MASTER_SPEC: normal API p95 <500 ms excluding external integrations; rights submission p95 <2 seconds; dashboard interactive <3 seconds; initial SaaS target 99.9%, enterprise capability 99.95%+. These are verification targets, not promises. Benchmark with the specified synthetic bid dataset plus separately sized enterprise datasets; record concurrency, data distribution and hardware. Consent throughput and enterprise sizing require workload approval (OPEN-06).

Bound all lists (default 25, maximum 100), graph traversals (maximum 5 hops/1,000 returned nodes), exports, uploads, connector concurrency and workflow fan-out. Heavy reports return asynchronous jobs. Timeouts, circuit breakers and tenant quotas prevent noisy-neighbour starvation. Eventual projections expose watermark/staleness. Security checks use authoritative state, never a stale projection.

WCAG 2.2 AA is the engineering accessibility target pending procurement-specific standards; keyboard navigation, screen readers, contrast and accessible validation are acceptance gates. Hindi/English are first locales; all messages use locale keys, Unicode storage and locale-aware rendering. UTC instants plus IANA timezone for schedules; local regulatory dates remain date values with explicit jurisdiction/timezone semantics. Do not reinterpret effective dates through a user's locale.

## Decision and approval register

| ID | Missing decision/input | Safe baseline and approval gate |
|---|---|---|
| OPEN-01 | Official Act/Rules/corrigenda/commencement corpus and legal interpretation | No authoritative DPDP seed. Legal reviewer must approve sources, applicability, timers and atomic mappings before legal-labelled release; architecture work proceeds. |
| OPEN-02 | KMS/HSM, secrets provider and approved cryptographic profile | Envelope-encryption design in SECURITY_ARCHITECTURE; security review before sensitive-data production acceptance. No custom cryptography. |
| OPEN-03 | Hosting region, residency, customer procurement constraints | Four portable profiles; no region selected or cross-border replication enabled without owner approval. |
| OPEN-04 | Retention schedules, legal holds and deletion authority | No invented statutory duration. Record purpose-specific schedules; block production collection without approved retention. |
| OPEN-05 | Principal identity assurance, guardian/nominee proof and recovery | Risk-based configurable verification; no automatic legal determination. Owner/security/legal review before real-person rollout. |
| OPEN-06 | Enterprise loads, contractual SLO/RPO/RTO and budget | Internal recovery design targets in DEPLOYMENT_ARCHITECTURE; benchmark and obtain contract approval. |
| OPEN-07 | External AI providers, data processing terms, model residency | AI disabled by default; no external personal data; explicit tenant and operator enablement after review. |
| OPEN-08 | Production release authority and independent assessment provider | AGENTS.md critical-area human/security gate; independent VA/PT and remediation verification before government production. |

These gates do not block FOUNDATION-001. Later coding agents must not silently approve them. Baseline changes require an ADR, impact analysis and updates to affected contracts. SECURITY_ARCHITECTURE.md and DOMAIN_MODEL.md are canonical names; do not maintain conflicting SECURITY.md/DOMAIN.md duplicates.

## Reading and verification order

AGENTS → relevant ADRs → security/domain baseline → DATABASE_SPEC/API_ARCHITECTURE/EVENT_MODEL/RBAC_ABAC → MODULE_BOUNDARIES/WORKFLOW_SPEC → BUILD_PLAN ticket. ARCHITECTURE_REVIEW.md records coverage, contradictions, missing sources and verification. No implementation is authorized by completion of this architecture session.
