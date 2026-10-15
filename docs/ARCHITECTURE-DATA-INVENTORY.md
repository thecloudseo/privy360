# Data Inventory & Classification — Architecture (Session 2)

Status: **Proposed design**. Reviewers: Chief Architect, Security (classifier sampling, RLS), Legal (retention semantics).
Date: 2026-10-15
Scope: `packages/domain/data-governance` (domain + interfaces), schema `governance`, proposed migrations `0014`–`0015`, worker job `inventory.classify`.
Non-scope: UI, connectors and live sampling transports, ML classification, deletion execution (Session 5), consent/notice linkage.

Design only. The doc has schema outlines, TypeScript interfaces and pseudocode, and no implementation. MUST means reviewers reject code that deviates.

Regulatory input: `dpdp-act-research.md` §5 (Act s.8), in particular 5.2 (processor accountability), 5.7 (erasure on withdrawal or purpose fulfilment, processor erasure, legal retention exception, Rule 11 deemed fulfilment) and §11.3 (lifecycle requirements). Research §4 (s.7 legitimate uses) applies only through `processing_activities.ground_type`. The brief cited "Section 4" for fiduciary obligations, but the research doc numbers them §5.

| Baseline                                                            | What it fixes, and this design obeys                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/security` `TrustedTenantContext`, `withTenantTransaction` | All access runs inside a transaction that sets `privy360.tenant_id`. Contexts are only minted by `createTrustedTenantContext` after verification.             |
| Migrations `0001`/`0006` RLS pattern                                | `ENABLE` + `FORCE ROW LEVEL SECURITY`, one `*_tenant_isolation` policy with `USING` and `WITH CHECK`, grants to `privy360_app` only.                          |
| DATABASE_SPEC §Data Governance and §Retention                       | Table names, T-scope inherited columns, composite tenant FKs, `edge_identity_id` + `assertion_revision` on link rows, and "metadata only, no citizen values". |
| DOMAIN_MODEL l.55                                                   | Discovered classifications and lineage are **proposals** with confidence and evidence. Only a human or an approved deterministic policy promotes them.        |
| ADR-014                                                             | Typed relational edges with FKs. No graph DB and no polymorphic ID columns.                                                                                   |

---

## 1. Decisions

### D1. Classifier: rule-based now, with a pluggable interface. ML deferred.

- Deterministic rules can be explained to an auditor ("matched `GOVT_ID.AADHAAR` rule v3: 94% of 500 sampled values passed the Verhoeff checksum"). An ML score cannot yet.
- The high-value Indian identifiers have checksums or rigid formats: Aadhaar (Verhoeff), PAN (structure plus entity-type character), card PAN (Luhn), IFSC and EPIC. Regex plus a validator gets near-zero false positives on these.
- Every result is only a proposal (DOMAIN_MODEL), so recall gaps cost a reviewer's time, not a compliance assertion.
- `Classifier` is an interface. An ML implementation can be added later as a second detector whose output is merged by the same scorer and is still only a proposal.

### D2. Lineage: table-level (data-source granularity) for MVP. Columns can be added later without changing the schema shape.

- Session 5 cascade needs to know which stores may hold this principal's data, and which key finds the principal there. Table-level edges answer that. The connector at each target does the row lookup by subject key.
- Row-level lineage means storing per-subject provenance. That copies personal data into the compliance platform, which the spec forbids ("connector-side retrieval preferred to copying source datasets").
- Table-level lineage over-approximates, which is the safe direction for erasure.
- `lineage_edges` gets nullable `source_field_path` / `target_field_path` now (CHECK: both null or both set). Column lineage later is then a data change, not a migration.

### D3. Retention: a separate `retention_policies` table. Not columns on `processing_activities`.

- DATABASE_SPEC already models `processing_activity → retention_policy?` and puts retention in the Retention/Deletion domain with maker/checker (audit code V, lifecycle L). Inlining it now would force an expand/contract migration in Session 5.
- One policy is shared by many activities (for example "tax records: 8 years after FY end"). Revising the statute changes one row.
- The legal retention exception (research 5.7) must record its basis. That is policy data, not activity data.
- Session 5's evaluator evaluates policies against activities. It never parses activity columns.
- Cost: one extra small table beyond the requested four (see §4 deviations). The MVP policy is a single rule, so `retention_rules` is not split out yet.

---

## 2. Overview

```
 manual schema import ─┐                     ┌──────────── reviewer (CONFIRM / REJECT)
 connector sampler ────┼─► ClassifierInput ─► Classifier (rules vN) ─► data_classifications
   (future)            │   (values in memory      │                       state=PROPOSED
                       │    only, never stored)   ▼
                       └──────────────────► data_sources ◄──────────┐
                                              ▲   ▲                 │
                         lineage_edges ───────┘   │      processing_activity_sources
                       (source → transform →      │                 │
                          target, table-level)    │       processing_activities ─► retention_policies
                                                  │        (purpose, ground_type,      (trigger, duration,
          Session 5: ErasurePlanner walks edges ──┘         state, owner)               legal basis)
```

---

## 3. Tenancy, RLS and context

- All six tables are **T** scope. They get every inherited column from DATABASE_SPEC (`id uuid` v7, `tenant_id`, `UNIQUE(tenant_id,id)`, `created_*`, `updated_*`, `version`).
- They use the same policy text as migration `0006`: `tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid` for both `USING` and `WITH CHECK`. FORCE RLS is on. `revoke all from public` and `grant select, insert, update on … to privy360_app`. There is **no DELETE grant**: rows are archived or superseded, never hard-deleted (lineage history is legal history for deletion proof).
- All T→T FKs are composite `(tenant_id, x_id) → x(tenant_id, id)`, so a cross-tenant reference fails even if RLS were bypassed.
- Every repository method takes `ctx: TrustedTenantContext` first, calls `assertTrustedTenantContext(ctx)`, and runs in `withTenantTransaction(db, ctx, …)`. Repositories never accept a bare `tenantId`.
- The classifier worker gets its context with `source: "WORKER"` from the verified job envelope. Job payloads carry `dataSourceId`, never `tenantId`. The tenant comes from the context.

---

## 4. Schema outlines (schema `governance`)

Inherited columns are omitted below. `→` is a composite tenant FK.

### 4.1 `data_sources`: the registry

A data source is a concrete store of records: a table, collection, file set, bucket prefix, SaaS object, or an external processor endpoint. A system groups data sources.

| Column               | Type / constraint                                                                                               | Notes                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `code`               | text, `U(tenant_id, code)`                                                                                      | Stable human key, e.g. `crm.contacts`.                                                                             |
| `name`               | text ≤255                                                                                                       |                                                                                                                    |
| `kind`               | enum `RDBMS_TABLE, DOCUMENT_COLLECTION, OBJECT_PREFIX, FILE_SET, SAAS_OBJECT, EVENT_STREAM, PROCESSOR_ENDPOINT` |                                                                                                                    |
| `system_code`        | text                                                                                                            | MVP grouping. Replaced by `system_id →systems` in INVENTORY-002 (Q2).                                              |
| `custody`            | enum `INTERNAL, PROCESSOR, THIRD_PARTY_FIDUCIARY`                                                               | Drives s.8(2) and s.8(7) processor erasure in the cascade.                                                         |
| `processor_ref`      | text null                                                                                                       | CHECK required when `custody='PROCESSOR'`. Becomes a vendor FK later.                                              |
| `locator`            | jsonb, schema-validated                                                                                         | Host/db/schema/table or bucket/prefix. **No credentials.** Secrets are `SecretReference` only (audit X).           |
| `hosting_region`     | text                                                                                                            | For cross-border questions later.                                                                                  |
| `subject_key_field`  | text null                                                                                                       | Field that identifies the data principal (e.g. `customer_id`). Required before the source can be a cascade target. |
| `state`              | enum `DRAFT, ACTIVE, ARCHIVED`                                                                                  |                                                                                                                    |
| `owner_actor_id`     | uuid → actor_refs                                                                                               | Accountable owner.                                                                                                 |
| `last_classified_at` | timestamptz null                                                                                                |                                                                                                                    |

Indexes: `(tenant_id, state, updated_at, id)`, `(tenant_id, system_code)`.

### 4.2 `data_classifications`: field-level labels (proposal → confirmed)

| Column                                        | Type / constraint                                | Notes                                                                                                           |
| --------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `data_source_id`                              | → data_sources                                   |                                                                                                                 |
| `field_path`                                  | text null                                        | Column or JSON path. Null means a source-level manual label.                                                    |
| `category_code`                               | text                                             | From the taxonomy in §6.2, e.g. `CONTACT.EMAIL`, `GOVT_ID.AADHAAR`.                                             |
| `state`                                       | enum `PROPOSED, CONFIRMED, REJECTED, SUPERSEDED` | Only a human command, or an approved auto-confirm policy (Q4), may move to `CONFIRMED`.                         |
| `method`                                      | enum `RULE, MANUAL, ML`                          | `ML` is reserved.                                                                                               |
| `ruleset_version`                             | text null                                        | e.g. `pii-rules@1.3.0`. CHECK not null when `method='RULE'`.                                                    |
| `confidence`                                  | numeric(4,3) 0–1                                 |                                                                                                                 |
| `evidence`                                    | jsonb, schema-validated                          | `{ruleIds, sampleSize, matchCount, nameSignal, validatorPassRate}`. **Counts and rule IDs only, never values.** |
| `reviewed_by` / `reviewed_at` / `review_note` | null until reviewed                              | `review_note` is free text, PD class P.                                                                         |
| `supersedes_id`                               | → data_classifications null                      | Re-classification appends. It never mutates.                                                                    |

Constraints: a filtered unique index on `(tenant_id, data_source_id, coalesce(field_path,''), category_code) WHERE state IN ('PROPOSED','CONFIRMED')`. A `REJECTED` row suppresses re-proposal of the same tuple until the ruleset **major** version changes. That prevents reviewer fatigue.

Derived view `data_source_profile` (not a table): confirmed categories per source, `contains_personal_data bool`, `contains_child_data_flag`, `max_sensitivity`.

### 4.3 `processing_activities` + `processing_activity_sources`

An activity is the record of processing: _why_ (purpose and ground), _what_ (sources), and _how long_ (retention policy).

`processing_activities`

| Column                | Type / constraint                        | Notes                                                                          |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `code`, `revision`    | `U(tenant_id, code, revision)`           | Revisions append. One `ACTIVE` per code (filtered unique).                     |
| `name`, `description` | bounded text                             |                                                                                |
| `purpose_code`        | text                                     | MVP inline. Later FK → `purposes` (Q3).                                        |
| `purpose_description` | text ≤2000                               | Plain language. Reused by notices later.                                       |
| `ground_type`         | enum `CONSENT, LEGITIMATE_USE`           | s.4.                                                                           |
| `legitimate_use_code` | text null                                | One of research §4.1 items. CHECK required iff `ground_type='LEGITIMATE_USE'`. |
| `retention_policy_id` | → retention_policies null                | **Required to enter `ACTIVE`** (§7).                                           |
| `legal_entity_id`     | → legal_entities                         | Exists (`tenant.legal_entities`).                                              |
| `owner_actor_id`      | → actor_refs                             |                                                                                |
| `state`               | enum `DRAFT, IN_REVIEW, ACTIVE, RETIRED` | Maker/checker on `IN_REVIEW → ACTIVE`.                                         |
| `uses_for_decisions`  | bool                                     | s.8(3) accuracy duty flag.                                                     |

`processing_activity_sources` is the M:N link. It is a link row per the spec conventions.

| Column                                                                 | Notes                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `activity_id` → processing_activities, `data_source_id` → data_sources |                                                      |
| `edge_identity_id`, `assertion_revision`                               | `U(tenant_id, edge_identity_id, assertion_revision)` |
| `role`                                                                 | enum `COLLECTS, READS, WRITES, STORES`               |
| `valid_from`, `valid_to` null                                          | Interval history. No endpoint uniqueness (spec).     |

### 4.4 `retention_policies` (owned by the Retention module, minimal shape)

| Column             | Type / constraint                                                                       | Notes                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `code`, `revision` | `U(tenant_id, code, revision)`                                                          |                                                                                                                                 |
| `trigger_type`     | enum `PURPOSE_FULFILLED, CONSENT_WITHDRAWN, INACTIVITY, FIXED_FROM_EVENT, CONTRACT_END` | s.8(7) "whichever earlier" is modelled as the earliest of the activity's applicable triggers in Session 5.                      |
| `trigger_event`    | text null                                                                               | e.g. `ACCOUNT_CLOSED`, `FY_END`. Required for `FIXED_FROM_EVENT`.                                                               |
| `duration`         | interval, `>= 0`                                                                        | `0` means erase at trigger.                                                                                                     |
| `basis_type`       | enum `PURPOSE_ONLY, LEGAL_OBLIGATION, CONTRACTUAL`                                      |                                                                                                                                 |
| `legal_basis_ref`  | text null                                                                               | Statute or requirement_version reference. CHECK required when `basis_type='LEGAL_OBLIGATION'` (research 5.7: "document basis"). |
| `rationale`        | text ≤2000                                                                              |                                                                                                                                 |
| `state`            | enum `DRAFT, APPROVED, SUPERSEDED`                                                      | Only `APPROVED` can be referenced by an `ACTIVE` activity.                                                                      |

No statutory durations are seeded. Durations are blocked on OPEN-04, consistent with DATABASE_SPEC.

### 4.5 `lineage_edges`: source → transform → target

| Column                                   | Type / constraint                                                            | Notes                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `source_data_source_id` → data_sources   |                                                                              |                                                                               |
| `target_data_source_id` → data_sources   | CHECK `<> source`                                                            |                                                                               |
| `source_field_path`, `target_field_path` | text null, both-or-neither                                                   | D2 forward compatibility.                                                     |
| `transform_kind`                         | enum `COPY, FILTER, ENRICH_JOIN, PSEUDONYMIZE, AGGREGATE, ANONYMIZE, EXPORT` | Determines cascade propagation (§8).                                          |
| `transform_ref`                          | text null                                                                    | Job, pipeline or DAG identifier.                                              |
| `subject_key_mapping`                    | jsonb null                                                                   | `{sourceField, targetField}` that carries principal identity across the edge. |
| `cadence`                                | enum `REALTIME, BATCH, ONE_OFF`                                              |                                                                               |
| `provenance`                             | enum `DECLARED, DISCOVERED`                                                  |                                                                               |
| `state`                                  | enum `PROPOSED, CONFIRMED, REJECTED, SUPERSEDED`                             | The cascade only walks `CONFIRMED`.                                           |
| `confidence`                             | numeric(4,3)                                                                 | `1.000` for `DECLARED`.                                                       |
| `edge_identity_id`, `assertion_revision` | `U(tenant_id, edge_identity_id, assertion_revision)`                         |                                                                               |
| `valid_from`, `valid_to`                 |                                                                              |                                                                               |

Indexes: `(tenant_id, source_data_source_id) WHERE state='CONFIRMED' AND valid_to IS NULL` (forward walk) and the mirror on target (impact or "where did this come from").

### 4.6 Deviations from DATABASE_SPEC (to approve explicitly)

| Spec                                       | This design                                                 | Why / reconciliation                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `systems` table, `data_sources.system_id`  | `system_code` text                                          | Keeps MVP to the requested tables. INVENTORY-002 adds `systems` with expand/contract and backfill by code.                              |
| `data_elements` + `discovery_observations` | merged into `data_classifications` (`field_path` + `state`) | One row per (field, category) holds both the proposal and the confirmed label. Split later if field-level metadata grows beyond labels. |
| `lineage_edges` between elements           | between sources + optional field paths                      | D2.                                                                                                                                     |
| `purposes` table                           | `purpose_code` inline                                       | Q3. Must be resolved before the consent module (consent is purpose-linked).                                                             |
| —                                          | `processing_activity_sources` (6th table)                   | M:N cannot be expressed in four tables without uuid arrays, which ADR-014 forbids.                                                      |

---

## 5. Interfaces (`packages/domain/data-governance`)

```ts
import type { TrustedTenantContext } from "@privy360/security";

type Id<T extends string> = string & { readonly __id: T };
export type DataSourceId = Id<"DataSource">;
export type ActivityId = Id<"ProcessingActivity">;

export interface DataSourceRegistry {
  register(
    ctx: TrustedTenantContext,
    input: RegisterDataSource,
  ): Promise<DataSource>;
  update(
    ctx: TrustedTenantContext,
    id: DataSourceId,
    patch: DataSourcePatch,
    expectedVersion: bigint,
  ): Promise<DataSource>;
  archive(
    ctx: TrustedTenantContext,
    id: DataSourceId,
    reason: string,
  ): Promise<void>; // blocked if referenced by ACTIVE activity
  get(ctx: TrustedTenantContext, id: DataSourceId): Promise<DataSource | null>;
  list(
    ctx: TrustedTenantContext,
    q: {
      state?: DataSourceState;
      systemCode?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<Page<DataSource>>;
  profile(
    ctx: TrustedTenantContext,
    id: DataSourceId,
  ): Promise<DataSourceProfile>; // confirmed categories only
}

export interface Classifier {
  readonly rulesetVersion: string; // semver; major bump re-opens REJECTED tuples
  classify(input: ClassifierInput): ClassificationProposal[]; // pure, no I/O, no ctx
}

export interface ClassifierInput {
  dataSourceId: DataSourceId;
  fields: ReadonlyArray<{
    path: string;
    declaredType?: string; // e.g. 'varchar', 'bigint'
    samples?: ReadonlyArray<string>; // in-memory only; bounded, see §6.4
  }>;
}

export interface ClassificationProposal {
  fieldPath: string;
  categoryCode: CategoryCode;
  confidence: number; // 0..1
  evidence: {
    ruleIds: string[];
    sampleSize: number;
    matchCount: number;
    nameSignal: number;
    validatorPassRate?: number;
  };
}

export interface ClassificationService {
  runForSource(
    ctx: TrustedTenantContext,
    id: DataSourceId,
    input: ClassifierInput,
  ): Promise<{ proposed: number; suppressed: number }>;
  review(
    ctx: TrustedTenantContext,
    classificationId: string,
    decision: "CONFIRM" | "REJECT",
    note?: string,
  ): Promise<void>;
  setManual(
    ctx: TrustedTenantContext,
    id: DataSourceId,
    fieldPath: string | null,
    category: CategoryCode,
  ): Promise<void>; // MANUAL, CONFIRMED
}

export interface ProcessingActivityService {
  createDraft(
    ctx: TrustedTenantContext,
    input: CreateActivity,
  ): Promise<ProcessingActivity>;
  linkSource(
    ctx: TrustedTenantContext,
    activityId: ActivityId,
    sourceId: DataSourceId,
    role: SourceRole,
  ): Promise<void>;
  attachRetentionPolicy(
    ctx: TrustedTenantContext,
    activityId: ActivityId,
    policyId: string,
  ): Promise<void>;
  submitForReview(
    ctx: TrustedTenantContext,
    activityId: ActivityId,
  ): Promise<ActivationCheck>;
  approve(ctx: TrustedTenantContext, activityId: ActivityId): Promise<void>; // checker != maker
}

export interface LineageService {
  declareEdge(
    ctx: TrustedTenantContext,
    input: DeclareEdge,
  ): Promise<LineageEdge>; // DECLARED → CONFIRMED on create
  proposeEdge(
    ctx: TrustedTenantContext,
    input: DeclareEdge & { confidence: number },
  ): Promise<LineageEdge>;
  review(
    ctx: TrustedTenantContext,
    edgeId: string,
    decision: "CONFIRM" | "REJECT",
  ): Promise<void>;
  downstream(
    ctx: TrustedTenantContext,
    from: DataSourceId,
    opts?: { maxDepth?: number },
  ): Promise<LineagePath[]>;
  upstream(
    ctx: TrustedTenantContext,
    from: DataSourceId,
    opts?: { maxDepth?: number },
  ): Promise<LineagePath[]>;
}
```

`Classifier` is deliberately context-free and pure. It cannot touch the DB, so it cannot leak across tenants, and it can be tested with fixtures alone. `ClassificationService` owns persistence and the RLS transaction.

---

## 6. Auto-classifier (rule-based)

### 6.1 Pipeline

1. **Name signal** (always available, even with no samples): normalise the field path (snake/camel split, lowercase, strip `_id`, `_no`, `_num`) and match a per-category token dictionary. Gives `nameSignal ∈ {0, 0.4, 0.7}` for none, weak or strong.
2. **Value signal** (only if samples are present): for each sample, after trim and non-empty, run the category regex and then its validator (checksum or range). `matchRatio = passes / nonEmpty`.
3. **Score**: `confidence = valueSignal ? clamp(0.25·nameSignal + 0.75·matchRatio) : nameSignal`. If `nonEmpty < MIN_SAMPLE (20)`, cap value-derived confidence at 0.6.
4. **Emit** a proposal when `confidence ≥ 0.5`. Rank multiple categories per field and keep all at or above 0.5. Reviewers resolve collisions such as `PHONE` vs `GOVT_ID.AADHAAR` on 10–12 digit numerics.

### 6.2 Rule table (ruleset `pii-rules@1.0.0`)

| Category                       | Name tokens (strong)                                                          | Value pattern (anchored, RE2-safe)                                  | Validator                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `IDENTITY.NAME`                | `name`, `first`, `last`, `surname`, `full_name`, `naam`                       | `^\p{Lu}[\p{L}.'-]+( \p{Lu}[\p{L}.'-]+){0,3}$`                      | ≥60% of samples have 1–4 tokens and no digits. **Name-signal dominated: value regex alone never exceeds 0.6.** |
| `CONTACT.EMAIL`                | `email`, `e_mail`, `mail`                                                     | `^[^\s@]{1,64}@[^\s@]+\.[A-Za-z]{2,}$`                              | domain has a dot, length ≤254                                                                                  |
| `CONTACT.PHONE_IN`             | `phone`, `mobile`, `msisdn`, `contact_no`                                     | `^(\+?91[\s-]?                                                      | 0)?[6-9]\d{9}$` (after stripping spaces and hyphens)                                                           | not all digits the same |
| `CONTACT.PHONE_INTL`           | same                                                                          | `^\+[1-9]\d{7,14}$`                                                 | E.164 length                                                                                                   |
| `GOVT_ID.AADHAAR`              | `aadhaar`, `aadhar`, `uid`, `uidai`                                           | `^[2-9]\d{3}\s?\d{4}\s?\d{4}$`, plus masked `^X{4}\s?X{4}\s?\d{4}$` | **Verhoeff checksum** (unmasked). Masked values → `GOVT_ID.AADHAAR_MASKED`                                     |
| `GOVT_ID.PAN`                  | `pan`, `pan_no`, `pancard`                                                    | `^[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]$`                             | 4th char is a valid entity type                                                                                |
| `GOVT_ID.SSN_US`               | `ssn`, `social_security`                                                      | `^(?!000\|666\|9\d\d)\d{3}-?(?!00)\d{2}-?(?!0000)\d{4}$`            | Exclusions are in the regex. Name signal is required when unhyphenated (9 bare digits collide).                |
| `GOVT_ID.PASSPORT_IN`          | `passport`                                                                    | `^[A-PR-WY][1-9]\d\s?\d{4}[1-9]$`                                   | name signal required                                                                                           |
| `GOVT_ID.VOTER_EPIC`           | `epic`, `voter_id`                                                            | `^[A-Z]{3}\d{7}$`                                                   | name signal required                                                                                           |
| `FINANCIAL.CARD`               | `card`, `card_no`, `cc_num` (not bare `pan`, which collides with GOVT_ID.PAN) | `^\d{13,19}$` (separators stripped)                                 | **Luhn**. Excludes all-same digits.                                                                            |
| `FINANCIAL.BANK_ACCT`          | `account_no`, `acct`, `ifsc`                                                  | IFSC `^[A-Z]{4}0[A-Z0-9]{6}$`                                       | Account numbers are name-signal only (9–18 digits is too generic).                                             |
| `FINANCIAL.UPI`                | `upi`, `vpa`                                                                  | `^[\w.-]{2,256}@[A-Za-z]{2,64}$`                                    | must not also match the email TLD shape                                                                        |
| `DEMOGRAPHIC.DOB`              | `dob`, `birth`, `date_of_birth`                                               | ISO or `dd/mm/yyyy`                                                 | parses, and year is within the last 120 years. Feeds the child-data flag (Q6).                                 |
| `NETWORK.IP`                   | `ip`, `ip_addr`, `remote_addr`                                                | IPv4/IPv6                                                           | octet range                                                                                                    |
| `LOCATION.ADDRESS` / `PINCODE` | `address`, `addr`, `pincode`, `pin`, `zip`                                    | PIN `^[1-9]\d{5}$`                                                  | name signal required for PIN                                                                                   |

DPDP has no statutory "sensitive personal data" class. `max_sensitivity` is a **tenant policy** label mapped per category (default: GOVT_ID and FINANCIAL high). It is not a legal assertion.

### 6.3 Pseudocode

```
classify(input):
  out = []
  for f in input.fields:
    tokens = normalise(f.path)
    values = nonEmpty(trim(f.samples ?? []))
    for rule in RULESET:
      name = rule.nameSignal(tokens)
      if rule.requiresName and name == 0: continue
      if values.empty:
        conf = name; vstats = null
      else:
        pass = count(v in values where rule.regex.matches(v) and rule.validate(v))
        ratio = pass / len(values)
        conf = clamp(0.25*name + 0.75*ratio)
        if len(values) < MIN_SAMPLE: conf = min(conf, 0.6)
        if rule.nameDominated: conf = min(conf, max(name, 0.6))
      if conf >= EMIT_THRESHOLD:
        out.push({f.path, rule.category, conf, evidence(rule.id, len(values), pass, name)})
  return out          // values go out of scope here; nothing retains them

runForSource(ctx, id, input):
  assertTrustedTenantContext(ctx)
  proposals = classifier.classify(input)
  withTenantTransaction(db, ctx, tx =>
    for p in proposals:
      if exists REJECTED(id, p.fieldPath, p.category) with same ruleset major: suppressed++; continue
      if exists CONFIRMED same tuple: continue                 // never downgrade human decision
      upsert PROPOSED (supersede older PROPOSED for the tuple)
    update data_sources.last_classified_at
    outbox.emit('inventory.classification.proposed', {dataSourceId: id, count}))
```

### 6.4 Safety requirements (MUST)

- Sample values exist only in worker memory for one call. They are never in DB rows, logs, traces, error messages, the outbox or audit events. Logging redaction tests use known Aadhaar and PAN fixtures.
- Sample bound: at most 500 values per field and at most 256 chars per value. Values are truncated before matching.
- Regexes run on a linear-time engine (RE2 / `re2` binding) or are reviewed as ReDoS-safe. Tenant-defined custom rules are **not** in MVP (Q5).
- The ruleset is versioned in code and the version is persisted on every row. Changing a rule without a version bump fails CI (snapshot of rule table digest).

---

## 7. Processing activity rules

`submitForReview` returns `ActivationCheck` (a list of blocking findings). An activity can enter `ACTIVE` only if:

1. It has at least one `processing_activity_sources` link, and every linked source is `ACTIVE`.
2. `retention_policy_id` is set and the policy is `APPROVED`.
3. `ground_type='LEGITIMATE_USE'` implies `legitimate_use_code` is set.
4. Every linked source has at least one `CONFIRMED` classification, or an explicit `MANUAL` "no personal data" marker (`category_code='NONE'`). An unclassified source blocks activation. **Unknown never exempts** (same principle as ADR-032).
5. The approver is not the maker (`approved_by <> created_by`).

Effective retention for a data source is the set of policies reachable through its active activities. Session 5 must take the **maximum legally required** and **minimum purpose-only** semantics into account (Q7). This design only guarantees the data is queryable.

---

## 8. Lineage and the Session 5 deletion cascade

Propagation semantics by `transform_kind`:

| Kind                                      | Personal data continues downstream?  | Cascade                                                                                   |
| ----------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `COPY`, `FILTER`, `ENRICH_JOIN`, `EXPORT` | yes                                  | continue; target becomes a deletion target                                                |
| `PSEUDONYMIZE`                            | yes (still personal data under DPDP) | continue; the target lookup needs the key-mapping table location in `subject_key_mapping` |
| `AGGREGATE`, `ANONYMIZE`                  | no, **if reviewed**                  | stop. Edge must be `CONFIRMED` by a human; a `DISCOVERED` aggregate is treated as `COPY`. |

Cascade planning (consumed by Session 5's `ErasurePlanner`, specified here so the schema supports it):

```
planTargets(ctx, rootSourceId):
  -- recursive CTE over lineage_edges, state='CONFIRMED', valid_to IS NULL,
  -- PostgreSQL CYCLE clause on target_data_source_id (sync-back loops are real),
  -- carries path + 'stopped' flag when transform_kind in (AGGREGATE, ANONYMIZE)
  reached = walkDownstream(rootSourceId, maxDepth = 20)
  for s in reached where not stopped:
    target = { dataSourceId: s.id, custody: s.custody, processorRef: s.processor_ref,
               subjectKey: resolveKey(s.path) }          // compose subject_key_mapping along path
    if target.subjectKey is null: flag UNRESOLVABLE      // never silently skip
    if s.custody == 'PROCESSOR': mark requiresProcessorConfirmation  // s.8(7)
  return targets
```

Invariants for Session 5:

- A source that is reachable but has no resolvable subject key is a **blocking finding**, not a skip. Erasure cannot be reported complete.
- Depth overflow (more than 20) is a blocking finding.
- Unreviewed `PROPOSED` edges are reported as "possible additional targets" in the plan for a human to rule on. They are not executed.

---

## 9. Audit and events

- Every command writes an audit event through the existing audit outbox (`audit.outbox_events`). Payloads carry IDs, field names and category codes, **never values** (audit code M; `review_note` is excluded from the payload and stored as a digest only).
- Domain events: `inventory.data_source.registered|archived`, `inventory.classification.proposed|confirmed|rejected`, `inventory.activity.activated|retired`, `inventory.lineage.edge_confirmed`. Session 5 subscribes to `edge_confirmed` and `activity.retired` (a retired activity can make purpose fulfilment due).

## 10. Test obligations (for the implementing session)

- Tenancy: for every table, a cross-tenant read, insert and composite-FK reference fails with the context set to tenant B. Calls with no context throw `TenantContextDeniedError`.
- Classifier fixtures: valid and invalid Verhoeff Aadhaar, PAN entity chars, Luhn cards, `000-xx-xxxx` SSN rejection, Indian mobile prefixes 0–5 rejected, and a collision set (12-digit order IDs must not reach 0.5 without a name signal).
- No-values guarantee: run classification with sentinel values, then grep the DB dump, logs and outbox for the sentinels. Expect zero hits.
- Lineage: cycle A→B→A terminates. An ANONYMIZE stop is honoured only when `CONFIRMED`. A missing subject key yields `UNRESOLVABLE`.

---

## 11. Open questions

| #   | Question                                                                                                                                               | Proposed default                                                                                    | Owner               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------- |
| Q1  | Do we accept the five deviations in §4.6, especially the sixth table (`processing_activity_sources`) beyond the "four tables" brief?                   | Yes. M:N without a link table violates ADR-014.                                                     | Chief Architect     |
| Q2  | When does `systems` (INVENTORY-002) land, and does `system_code` backfill by exact code match?                                                         | Before Session 5; backfill by code, unmatched → blocking report.                                    | Architect           |
| Q3  | Should `purposes` become a table now, given consent (s.6) is purpose-linked?                                                                           | Inline for Session 2. Table plus FK before the consent module starts.                               | Product + Architect |
| Q4  | May an approved policy auto-confirm high-confidence checksum hits (Aadhaar/PAN/Luhn ≥0.95)?                                                            | Not in MVP. Revisit with reviewer-load data.                                                        | Legal + Product     |
| Q5  | Tenant-defined custom rules: allowed, and under what ReDoS and review controls?                                                                        | Defer. If allowed: RE2 only, maker/checker, per-tenant ruleset version.                             | Security            |
| Q6  | Child data (s.9): flag a source when DOB samples show age < 18, given that needs the sample values?                                                    | Compute the age bucket in memory and persist only the boolean flag and count. Needs Legal sign-off. | Legal + Security    |
| Q7  | Conflicting retention across activities sharing a source: is the rule "erase at the latest legally required end; purpose-only policies cannot extend"? | Yes. Formalise in Session 5.                                                                        | Legal               |
| Q8  | Rule 11 deemed purpose fulfilment (inactivity ~2 years): model it as an `INACTIVITY` trigger on policies, with the inactivity signal sourced where?    | `INACTIVITY` trigger reserved now. Signal source decided in Session 5.                              | Architect           |
| Q9  | Migration numbers `0014`–`0015` assume the compliance engine keeps `0011`–`0013`.                                                                      | Confirm at merge.                                                                                   | Eng lead            |
| Q10 | Is a field-level classification on a `PROCESSOR_ENDPOINT` source meaningful when we cannot sample it?                                                  | Allow MANUAL only. Classifier skips that `kind`.                                                    | Product             |
