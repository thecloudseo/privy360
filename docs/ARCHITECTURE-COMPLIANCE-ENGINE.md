# DPDP Compliance Engine — Architecture (Session 1)

Status: **Proposed design** — for review by Chief Architect, Legal (corpus semantics) and Security (evidence storage).
Date: 2026-10-15
Scope: `packages/compliance-engine/` (new), migrations `0011`–`0013`, NestJS adapters in `apps/api` / `apps/worker`.
Non-scope: UI, connectors/automated collectors, AI, DPIA/vendor assessments, deletion jobs.

This document is normative for implementers. Where it says MUST, a reviewer should reject code that deviates. It **extends** the accepted baseline; it does not replace it:

| Baseline source                                                      | What it already fixes, and this design obeys                                                                                                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-013, migration `0003`                                            | Requirements are global, versioned DB data with stable codes. They are not hard-coded TypeScript. Published versions are immutable.                                                                            |
| ADR-014, DOMAIN_MODEL                                                | Typed relational edges with FK integrity. No graph DB. No dangling IDs.                                                                                                                                        |
| ADR-019, WORKFLOW_SPEC (Evidence row)                                | Evidence states run `RESERVED→UPLOADED_QUARANTINE→SCANNING→AVAILABLE/REJECTED→EXPIRED/REVOKED→DELETED`. Scanning fails closed.                                                                                 |
| ADR-032, MODULE_BOUNDARIES, REGULATORY_INGESTION_SPEC §Applicability | Applicability uses a typed predicate AST (`all/any/not/eq/in/gt/gte/lt/lte`) with three-valued logic. **UNKNOWN never exempts.** No eval, SQL or scripts.                                                      |
| Migration `0008`                                                     | `compliance.controls`, `obligations`, `control_mappings`, `obligation_controls`, `evidence_requirements` already exist.                                                                                        |
| BUILD_PLAN ATOMIC-002, COMPLIANCE-004, COMPLIANCE-006                | Applicability uses maker/checker. Expired or quarantined evidence cannot satisfy anything. Status is not patchable through the API. There are no unapproved compliance percentages and no legal certification. |
| DATABASE_SPEC §Evolution                                             | There is no hard delete of referenced evidence, tests or legal history. Down-migrations must not discard legal history.                                                                                        |

---

## 0. System overview

```
                 GLOBAL (shared corpus, no tenant_id, app role = SELECT only)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ regulations ─► regulation_versions ─► provisions ─► provision_versions       │
 │                                                       │ (clause text+cite)   │
 │ requirements ─► requirement_versions ◄────────────────┘                      │
 │      │                 │  1:1 (0011) requirement_version_rules               │
 │      │                 └──────────────► applicability_rules (predicate AST)  │
 │      └── requirement_dependencies (DAG, 0011)                                │
 │ fact_definitions (registry of fact keys + types, 0011)                       │
 │ control_templates (+ evidence expectation templates)                         │
 └──────────────────────────────────────────────────────────────────────────────┘
                                   │ pinned via corpus_adoptions (0011)
                 TENANT (RLS: tenant_id = current_setting('privy360.tenant_id'))
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ legal_entities ─► legal_entity_facts (0011)                                  │
 │        │                                                                     │
 │        ▼  evaluateApplicability()  [pure, compliance-engine]                 │
 │ requirement_applicability (decision, tri-state, maker/checker, 0011)         │
 │        │ APPLICABLE                                                          │
 │        ▼                                                                     │
 │ obligations (0008) ─► obligation_controls ─► controls ─► evidence_requirements│
 │        │                                                   ▲                 │
 │        │                     evidence_links (edge, 0012) ──┘                 │
 │        │                            │                                        │
 │        │                     evidence_versions ─► evidence (0012)            │
 │        │                            │  object_key/object_version             │
 │        ▼                            ▼                                        │
 │ requirement_status (projection, 0013) ◄── computeRequirementStatus() [pure]  │
 │ requirement_status_transitions (append-only history, 0013)                   │
 └──────────────────────────────────────────────────────────────────────────────┘
                                          │
                          MinIO / S3: quarantine bucket ─(scan CLEAN)─► evidence bucket
                                                         (versioning + Object Lock)
```

### Package boundary

```
packages/compliance-engine/            NEW. Pure TypeScript. Zero runtime deps. No IO, no NestJS, no pg.
  src/requirement/types.ts             DPDPRequirement, ClauseRef, EvidenceExpectation, RequirementDependency
  src/applicability/predicate.ts       ApplicabilityPredicate AST types
  src/applicability/validate.ts        validatePredicate(predicate, factRegistry)
  src/applicability/evaluate.ts        evaluateApplicability(...)  (three-valued)
  src/dependencies/graph.ts            assertAcyclic(), topologicalOrder(), dependentsOf()
  src/evidence/qualification.ts        qualifies(link, version, requirement, now)
  src/status/compute.ts                computeRequirementStatus(...)
  src/status/transitions.ts            ALLOWED_TRANSITIONS, assertTransition()
  src/index.ts

packages/domain/compliance/            EXISTING. Aggregate validation (validateAtomicControl). Unchanged.
apps/api/src/compliance/               NestJS module: repositories (withTenantTransaction), commands,
                                       AtomicAuditUnitOfWork, REST controllers.
apps/worker/src/compliance/            Status recompute drainer + time sweeper (expiry, AT_RISK deadline).
```

**Why the engine is pure.** Applicability and status are compliance determinations, so an auditor must be able to replay them. Every function takes explicit inputs and an injected `now` and returns a result with a rationale. The same inputs always give the same `basis_digest`. Persistence, authorization and audit stay in the API layer, where `TrustedTenantContext`, RLS and `AtomicAuditUnitOfWork` already live.

The workspace needs a new entry, `packages/compliance-engine`, in `pnpm-workspace.yaml`. The current list does not include `packages/domain/*` either; see Open Question Q12.

---

## 1. Requirement representation

### 1.1 Three layers, not one object

The prompt's sketch puts law, applicability, evidence and sequencing on one `DPDPRequirement` object. That conflates three owners with different lifecycles:

| Layer                                                            | Owner                                                     | Scope                                            | Changes when                        | Table(s)                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------- |
| **Legal requirement**: atomic duty and clause citation           | Legal (corpus publisher)                                  | Global                                           | The law, Rules or corrigenda change | `regulatory.requirements`, `requirement_versions`, `provision_versions`   |
| **Applicability rule**: when the duty binds an entity            | Legal                                                     | Global                                           | The legal interpretation changes    | `regulatory.applicability_rules`, `requirement_version_rules`             |
| **Evidence expectation**: what proof demonstrates implementation | Compliance (template, global), then tenant (instantiated) | Template is global; the instance is tenant-owned | Implementation practice changes     | `control_templates`, then `compliance.controls` + `evidence_requirements` |

The DPDP Act never says "upload a policy PDF". Evidence expectations are implementation guidance (`IMPLEMENTATION_CONTROL`). If they sat on the legal requirement row, guidance would be presented as law, which DOMAIN_MODEL forbids. Separating them lets tenants add stricter evidence without forking the law.

The TypeScript `DPDPRequirement` below is the **read model** that the engine consumes. Repositories assemble it from those tables. It is never a hand-written catalogue in code.

### 1.2 Interfaces

```typescript
// ───────────────────────── identifiers ─────────────────────────
type UUID = string; // uuidv7, validated at the boundary
type ISODate = string; // 'YYYY-MM-DD' (effective dates are dates, not instants)
type ISOInstant = string; // RFC 3339 UTC

/** Stable, human-meaningful code. Never reused, never changes across revisions.
 *  Production namespace:  IN-DPDP-<FAMILY>-<NNN>   e.g. IN-DPDP-NOT-001
 *  Synthetic fixtures:    SYNTH-<FAMILY>-<NNN>     (blocked from legal-labelled catalogue) */
type RequirementCode = string & { readonly __brand: "RequirementCode" };

/** Mirrors packages/domain/compliance ATOMIC_CONTROL_FAMILIES (28 families). Reuse, do not redefine. */
type AtomicControlFamily =
  import("@privy360/domain-compliance").AtomicControlFamily;
type ControlClassification =
  "LEGAL_REQUIREMENT" | "IMPLEMENTATION_CONTROL" | "GOOD_PRACTICE";

// ───────────────────────── clause mapping ─────────────────────────
/** One provision the requirement derives from. A requirement may cite several provisions
 *  (e.g. an Act section plus the Rule that operationalises it). */
interface ClauseRef {
  regulationCode: string; // 'IN-DPDP-ACT-2023' | 'IN-DPDP-RULES-2025' | ...
  provisionCode: string; // canonical, machine-sortable: 'S8(5)', 'S10(2)(c)', 'R6(1)(a)'
  displayLabel: string; // 'Section 8(5)', rendered from provisionCode + locale
  provisionVersionId: UUID; // FK regulatory.provision_versions: the exact text in force
  citationId: UUID; // FK regulatory.source_citations: page/paragraph/digest
  role: "PRIMARY" | "SUPPORTING"; // exactly one PRIMARY per requirement version
}

// ───────────────────────── the requirement ─────────────────────────
interface DPDPRequirement {
  requirementId: UUID; // stable identity (regulatory.requirements)
  requirementVersionId: UUID; // immutable revision (regulatory.requirement_versions)
  code: RequirementCode;
  revision: number; // >= 1
  synthetic: boolean; // true => SYNTH-* namespace; never shown as law

  classification: ControlClassification;
  family: AtomicControlFamily; // fine-grained (28), drives control templates
  category: RequirementCategory; // coarse (6), derived from family via §1.4, used for UI grouping

  title: string; // <= 255 chars
  atomicWording: string; // ONE testable duty. "and" across two duties => split it.
  interpretationNote?: string; // reviewed Legal interpretation, never generated

  clauses: readonly ClauseRef[]; // >= 1 when classification = LEGAL_REQUIREMENT
  applicability: ApplicabilityRuleRef;
  evidenceExpectations: readonly EvidenceExpectation[]; // template defaults (see §1.1)
  dependencies: readonly RequirementDependency[];

  effectiveFrom: ISODate;
  effectiveTo?: ISODate; // exclusive
  reviewState: "PUBLISHED"; // engine only ever receives PUBLISHED versions
  manifestDigest: string; // publication manifest this version was published in
}

type RequirementCategory =
  "data_fiduciary" | "rights" | "processor" | "sdf" | "breach" | "governance";

// ───────────────────────── applicability ─────────────────────────
interface ApplicabilityRuleRef {
  ruleId: UUID; // regulatory.applicability_rules.applicability_rule_id
  code: string; // e.g. 'APPL-SDF-NOTIFIED'
  revision: number;
  predicate: ApplicabilityPredicate; // §3.2
  requiredFacts: readonly FactKey[]; // denormalised from predicate, for reverse lookup
  digest: string; // sha256(canonical JSON of predicate), pinned into decisions
}

// ───────────────────────── evidence ─────────────────────────
/** Registry-backed (compliance.evidence_types), not a TS union, so additions are reviewed
 *  data migrations rather than code deploys. Initial set: */
type EvidenceTypeCode =
  | "policy"
  | "audit_report"
  | "training_record"
  | "signed_agreement"
  | "technical_control"
  | "screening_report"
  | "notice_artifact"
  | "system_export"
  | "attestation"; // added, see §1.3

interface EvidenceExpectation {
  code: string; // unique within requirement version, e.g. 'EV-POLICY-RETENTION'
  type: EvidenceTypeCode;
  mandatory: boolean; // prompt's `required`. Optional items never block MET
  minAccepted: number; // >= 1. How many distinct accepted versions are needed
  freshnessDays?: number; // evidence older than captured_at + freshnessDays no longer qualifies
  sufficiencyCriteria: string; // reviewer checklist text. A file alone never proves compliance
}

// ───────────────────────── sequencing ─────────────────────────
interface RequirementDependency {
  dependsOnRequirementId: UUID; // STABLE id, not version. Resolves to the tenant's adopted version
  dependsOnCode: RequirementCode; // denormalised for display
  kind: "PREREQUISITE"; // only kind in v1 (see §1.3, dependencies vs applicability)
  rationale: string;
}
```

### 1.3 Design choices (and departures from the prompt sketch)

| #   | Prompt sketch                                         | Design                                                                                                                       | Why                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `id: string`                                          | `requirementId` + `requirementVersionId` + `code`                                                                            | ADR-013. Assessments, decisions and evidence links pin a **version**, so a law change never silently rewrites history. `code` is the human-stable key used in reports and aliases.                                                                                          |
| R2  | `clause: "Section 4.1"`                               | `clauses: ClauseRef[]` with `provisionCode` like `S4(1)`                                                                     | DPDP numbering is Section/sub-section/clause, `4(1)(a)`. "4.1" is ambiguous with Rules numbering. One atomic duty often derives from an Act section **and** a Rule. A FK to `provision_versions` gives the exact text and citation in force, so a string label can't drift. |
| R3  | `category` 5-value enum                               | `family` (existing 28) + derived `category` (6)                                                                              | The 28-family taxonomy already exists in `0008` and `domain/compliance`; a second classification axis would drift. `category` is a pure function of `family` (§1.4). `governance` is added because GOV/REG/AUD-type duties fit none of the five.                            |
| R4  | `applicability: ApplicabilityRule[]` (flat AND/OR)    | One `ApplicabilityRuleRef` holding a nested predicate AST                                                                    | See §3.1. In short: a flat list can't express `A AND (B OR C)`; it is unclear how multiple rules combine; there's no `NOT`; `value: any` defeats validation; and there's no UNKNOWN. The baseline spec already mandates the AST.                                            |
| R5  | `evidence_types: {type, required}` on the requirement | `evidenceExpectations` as **template** defaults, copied into tenant `evidence_requirements` when the control is instantiated | §1.1. It also adds `minAccepted`, `freshnessDays` and `sufficiencyCriteria`. Without freshness the engine can't produce AT_RISK. Without sufficiency criteria the reviewer has nothing to check against.                                                                    |
| R6  | 6 evidence types                                      | +`notice_artifact`, `system_export`, `attestation`                                                                           | Notices (s.5) are artefacts rather than policies. System exports (consent logs, access reviews) are the main technical evidence. Attestations cover officer sign-offs. The set is a registry table, so it can grow without code changes.                                    |
| R7  | `dependencies: string[]`                              | `RequirementDependency[]` on **stable** `requirementId`                                                                      | Version-pinned dependencies would break on every revision of the dependency. Resolution goes through the tenant's adopted corpus manifest.                                                                                                                                  |

**Dependencies vs applicability: a hard rule.** A dependency means "A cannot be considered MET until B is satisfied". It **never** changes whether A applies. If A only applies when B applies (for example, SDF DPIA duties apply only to SDFs), A's **applicability predicate** must test the same fact (`sdf.notified`). It must not reference B. Predicates MUST NOT read another requirement's status. This keeps applicability a pure function of facts: there are no evaluation-order effects and no cycles between the two graphs. The rule is enforced in `validatePredicate`, which only accepts registered fact keys, and there is no fact key that represents a requirement status.

### 1.4 Family → category mapping

The family meanings below are inferred from codes. **Legal and Compliance must confirm them** (Q1). Implement the mapping as a `const` table in `requirement/types.ts` with an exhaustiveness test.

| Category         | Families                                                             |
| ---------------- | -------------------------------------------------------------------- |
| `data_fiduciary` | APP, LPU, NOT, CON, CMI, ACC, SEC, RET, DEL, CTC, CHD, GRD, XBR, EXM |
| `rights`         | ERS, COR, GRV, NOM, DUT                                              |
| `processor`      | PRC, DPA                                                             |
| `sdf`            | SDF, DPI, ALG                                                        |
| `breach`         | BRE                                                                  |
| `governance`     | GOV, AUD, REG                                                        |

### 1.5 How "assess an org against all applicable requirements" works

1. The tenant has exactly one **ACTIVE corpus adoption** (`compliance.corpus_adoptions`), which pins a publication manifest. The manifest defines the set of requirement versions in scope. Adopting a new manifest is an explicit, reviewed action (REGULATORY_INGESTION_SPEC step 8). A new law version never applies itself.
2. An **applicability run** (`compliance.applicability_runs`) evaluates every requirement version in the manifest for one legal entity, using the entity's current facts (§3).
3. Each APPLICABLE decision creates or updates an **obligation**: `(legal_entity, requirement_version, scope_digest)`.
4. Each obligation gets one **requirement_status** row, computed by §2 from the mapped controls, evidence requirements and accepted evidence links.

"Org" means **legal entity** (`tenant.legal_entities`). The Data Fiduciary under DPDP is a legal person, and one tenant organisation can hold several legal entities with different facts. Organisation-level views are rollups (§2.7).

`scope_digest` = `sha256(canonical_json({legalEntityId, activityId: null}))`. Activity-level scoping (`activityId` non-null) is reserved for when processing-activity scoping lands. Session 1 always uses `activityId: null`.

---

## 2. Compliance status tracking

### 2.1 States

| State            | Meaning                                                                                                                                 | Is it legal certification?                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `NOT_APPLICABLE` | Approved decision: the requirement does not bind this legal entity                                                                      | No. It is a reviewed decision with rationale              |
| `UNDETERMINED`   | **Added state.** Applicability is UNKNOWN (missing or stale facts), or a NOT_APPLICABLE proposal is awaiting approval                   | n/a                                                       |
| `NOT_MET`        | Applies, and no mandatory evidence requirement is satisfied                                                                             | No                                                        |
| `PARTIALLY_MET`  | Applies, and some but not all mandatory evidence requirements are satisfied, or a dependency or control test blocks MET                 | No                                                        |
| `MET`            | Applies, every mandatory evidence requirement has qualifying accepted evidence, dependencies are satisfied, and no failing control test | **No.** UI label is "Evidence complete" (COMPLIANCE-006). |
| `AT_RISK`        | Was MET, the basis has degraded, and the tenant grace window is still open                                                              | No                                                        |

**Why add `UNDETERMINED`.** Without it, an unknown applicability has to collapse into either NOT_APPLICABLE or NOT_MET. Collapsing to NOT_APPLICABLE is an inferred exemption, which the baseline explicitly forbids. Collapsing to NOT_MET misreports a data gap as an implementation gap and sends people to collect evidence for something that may not apply. UNDETERMINED routes the work to the right person: someone who supplies facts.

**Why `AT_RISK` is reachable only from MET or AT_RISK.** Its value is telling apart "this lapsed" (fix the renewal) from "this was never done" (build the control). If a requirement that was never met could be AT_RISK, the state would mean nothing. A DB trigger enforces this (§5.3).

**Why "expiring soon" is a flag, not a state.** A requirement whose evidence expires in 10 days is still MET. Making it a state would cause MET↔AT_RISK flapping driven by the calendar and would blur what AT_RISK means. Instead, `earliest_evidence_expiry` is stored and the dashboard shows a warning when it falls within `expiry_warning_days`.

### 2.2 State machine

```
                         applicability decision approved = NOT_APPLICABLE
       ┌──────────────────────────────────────────────────────────────────────────┐
       │            (from ANY state; evidence links are kept as history)          │
       ▼                                                                          │
 ┌────────────────┐   re-evaluated APPLICABLE     ┌──────────────────┐            │
 │ NOT_APPLICABLE │──────────────────────────────►│   UNDETERMINED   │◄── initial │
 └────────────────┘   (goes via evaluation;       │ (appl. UNKNOWN / │   (no      │
       ▲               lands per §2.4 compute)    │  N/A pending)    │  decision) │
       │                                          └──────────────────┘            │
       │  N/A approved                       appl. │ APPLICABLE      ▲ facts go   │
       └───────────────────────────────────────────┤                 │ missing/   │
                                                   ▼                 │ stale      │
                                                                     │ (from ANY  │
      ┌─────────────── compute(): raw coverage of mandatory ERs ─────┘  applicable│
      │                                                                 state)    │
      ▼                                                                           │
 ┌───────────┐  ≥1 but <all ERs qualify  ┌───────────────┐  all ERs qualify,      │
 │  NOT_MET  │──────────────────────────►│ PARTIALLY_MET │  deps OK, no FAIL test │
 │           │◄──────────────────────────│               │───────────┐            │
 └───────────┘  qualifying evidence lost └───────────────┘           │            │
   │    ▲        (was never MET)               ▲                     ▼            │
   │    │                                      │               ┌──────────┐       │
   │    │                                      │               │   MET    │───────┘
   │    └── basis lost, tenant grace = 0 ──────┼───────────────│          │
   └──── all ERs qualify in one step ──────────┼──────────────►│          │
                                               │               └──────────┘
                                               │                 │      ▲
                       grace deadline passes,  │  basis degraded │      │ basis restored
                       basis still degraded    │  (evidence      │      │ (new evidence
                       → raw status            │  expired/       ▼      │  accepted, dep
                       (PARTIALLY_MET/NOT_MET) │  revoked, dep  ┌──────────┐ restored)
                                               └────────────────│ AT_RISK  │
                                                 dependency     │ (grace   │
                                                 regressed,     │  window) │
                                                 new req.       └──────────┘
                                                 version adopted
```

### 2.3 Transition table

`*` means any state. Every row is produced by `computeRequirementStatus`. There is no command that sets a status directly.

| From                          | To                            | Trigger (event)                                                                                                                                                                      | Guard                                                                                       |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| (none)                        | UNDETERMINED                  | obligation candidate created by applicability run                                                                                                                                    | decision is UNKNOWN or NOT_APPLICABLE pending approval                                      |
| (none)                        | NOT_MET / PARTIALLY_MET / MET | applicability run, APPLICABLE                                                                                                                                                        | first compute                                                                               |
| *                             | NOT_APPLICABLE                | `ApplicabilityReviewed` (NOT_APPLICABLE, approved)                                                                                                                                   | approver ≠ proposer                                                                         |
| * (except NOT_APPLICABLE)     | UNDETERMINED                  | `ApplicabilityEvaluated` = UNKNOWN; a fact expires (`valid_to` passes)                                                                                                               | none                                                                                        |
| UNDETERMINED / NOT_APPLICABLE | NOT_MET / PARTIALLY_MET / MET | `ApplicabilityEvaluated` / `ApplicabilityReviewed` = APPLICABLE                                                                                                                      | goes straight to computed coverage                                                          |
| NOT_MET                       | PARTIALLY_MET                 | `EvidenceLinkReviewed` (ACCEPTED)                                                                                                                                                    | 0 < satisfied < total                                                                       |
| NOT_MET / PARTIALLY_MET       | MET                           | `EvidenceLinkReviewed` (ACCEPTED), `DependencyStatusChanged`, `ControlTestRecorded` (PASS replacing FAIL)                                                                            | satisfied = total, total > 0, deps OK, latest test ≠ FAIL                                   |
| PARTIALLY_MET                 | NOT_MET                       | evidence lost, never MET before                                                                                                                                                      | satisfied = 0                                                                               |
| MET                           | AT_RISK                       | `EvidenceExpired`, `EvidenceLinkWithdrawn`, `EvidenceVersionRevoked`, `DependencyStatusChanged` (regressed), `CorpusAdopted` (new requirement version), `ControlTestRecorded` (FAIL) | grace > 0. Sets `at_risk_since = now`, `at_risk_until = now + grace`                        |
| MET                           | PARTIALLY_MET / NOT_MET       | same as above                                                                                                                                                                        | tenant `at_risk_grace_days = 0`                                                             |
| AT_RISK                       | MET                           | evidence accepted / dependency restored                                                                                                                                              | raw = MET. Clears `at_risk_*`                                                               |
| AT_RISK                       | PARTIALLY_MET / NOT_MET       | `StatusDeadlineReached` (sweeper)                                                                                                                                                    | `now ≥ at_risk_until` and raw ≠ MET. `last_met_at` is kept so the UI can show "lapsed on …" |

Forbidden, and rejected by a DB trigger: `NOT_MET→AT_RISK`, `PARTIALLY_MET→AT_RISK`, `UNDETERMINED→AT_RISK`, `NOT_APPLICABLE→AT_RISK`.

### 2.4 Status computation

```typescript
type RequirementStatus =
  | "NOT_APPLICABLE"
  | "UNDETERMINED"
  | "NOT_MET"
  | "PARTIALLY_MET"
  | "MET"
  | "AT_RISK";

type Gap =
  | { kind: "APPLICABILITY_UNKNOWN"; blockingFacts: FactKey[] }
  | { kind: "APPLICABILITY_PENDING_APPROVAL"; decisionId: UUID }
  | { kind: "NO_CONTROL_MAPPED" }
  | { kind: "NO_EVIDENCE_REQUIREMENTS"; controlId: UUID } // configuration defect
  | { kind: "EVIDENCE_MISSING"; evidenceRequirementId: UUID }
  | {
      kind: "EVIDENCE_PENDING_REVIEW";
      evidenceRequirementId: UUID;
      linkIds: UUID[];
    }
  | {
      kind: "EVIDENCE_EXPIRED";
      evidenceRequirementId: UUID;
      expiredAt: ISOInstant;
    }
  | { kind: "EVIDENCE_REVOKED"; evidenceRequirementId: UUID }
  | {
      kind: "INSUFFICIENT_COUNT";
      evidenceRequirementId: UUID;
      have: number;
      need: number;
    }
  | {
      kind: "DEPENDENCY_NOT_MET";
      requirementCode: RequirementCode;
      status: RequirementStatus;
    }
  | { kind: "DEPENDENCY_UNDETERMINED"; requirementCode: RequirementCode }
  | { kind: "DEPENDENCY_NOT_ADOPTED"; requirementId: UUID }
  | { kind: "DEPENDENCY_AT_RISK"; requirementCode: RequirementCode }
  | { kind: "CONTROL_TEST_FAILED"; controlTestId: UUID }
  | { kind: "REQUIREMENT_VERSION_CHANGED"; previousVersionId: UUID };

interface StatusInput {
  obligationId: UUID;
  applicability: {
    outcome: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";
    state: "PROPOSED" | "APPROVED";
    decisionId: UUID;
    blockingFacts: FactKey[];
    factsValidUntil?: ISOInstant; // earliest fact valid_to used by the decision
  } | null;
  controls: ReadonlyArray<{
    controlId: UUID;
    evidenceRequirements: ReadonlyArray<{
      id: UUID;
      mandatory: boolean;
      minAccepted: number;
      freshnessDays?: number;
      links: ReadonlyArray<EvidenceLinkView>; // all non-WITHDRAWN links incl. history
    }>;
    latestTest?: { id: UUID; result: "PASS" | "FAIL" | "INCONCLUSIVE" }; // after COMPLIANCE-004
  }>;
  dependencies: ReadonlyArray<{
    requirementId: UUID;
    code: RequirementCode;
    status: RequirementStatus | "NOT_ADOPTED"; // status of the dep's obligation for SAME legal entity
  }>;
  carriedFromPreviousVersion?: { previousVersionId: UUID; wasMet: boolean };
}

interface PreviousStatus {
  status: RequirementStatus;
  lastMetAt?: ISOInstant;
  atRiskSince?: ISOInstant;
  atRiskUntil?: ISOInstant;
}

interface StatusPolicy {
  // compliance.status_policy, per tenant
  atRiskGraceDays: number; // 0..365, default 30 (Q3)
  expiryWarningDays: number; // default 30
}

interface StatusResult {
  status: RequirementStatus;
  gaps: Gap[]; // canonical sort: kind, then id
  mandatoryTotal: number;
  mandatorySatisfied: number;
  lastMetAt?: ISOInstant;
  atRiskSince?: ISOInstant;
  atRiskUntil?: ISOInstant;
  earliestEvidenceExpiry?: ISOInstant;
  nextEvaluationAt?: ISOInstant; // drives the time sweeper
  waivedDependencies: RequirementCode[]; // deps ignored because NOT_APPLICABLE
  basisDigest: string; // sha256(canonical(input, previous, policy, engineVersion))
  engineVersion: string; // semver of compliance-engine
}

export function computeRequirementStatus(
  input: StatusInput,
  previous: PreviousStatus | null,
  policy: StatusPolicy,
  now: Date,
): StatusResult;
```

```
function computeRequirementStatus(input, prev, policy, now):
  gaps ← []

  # ── 1. applicability gate ──────────────────────────────────────────────
  a ← input.applicability
  if a is null:                                   return UNDETERMINED + APPLICABILITY_UNKNOWN([])
  if a.outcome = UNKNOWN:                         return UNDETERMINED + APPLICABILITY_UNKNOWN(a.blockingFacts)
  if a.outcome = NOT_APPLICABLE and a.state = PROPOSED:
                                                  return UNDETERMINED + APPLICABILITY_PENDING_APPROVAL
  if a.outcome = NOT_APPLICABLE (APPROVED):       return NOT_APPLICABLE
  # a.outcome = APPLICABLE (PROPOSED or APPROVED, see §3.5)

  # ── 2. evidence coverage ───────────────────────────────────────────────
  if input.controls is empty: gaps += NO_CONTROL_MAPPED
  mandatory ← flatten(c.evidenceRequirements for c in controls) where er.mandatory
  for c in controls where c has no evidenceRequirements: gaps += NO_EVIDENCE_REQUIREMENTS(c)
  satisfied ← 0 ; minExpiry ← +∞
  for er in mandatory:
      q ← [l for l in er.links if qualifies(l, er, now)]          # §4.5
      if |q| ≥ er.minAccepted:
          satisfied += 1
          # the ER stays satisfied until its (minAccepted)-th latest-expiring link expires
          minExpiry ← min(minExpiry, kthLargest(expiryOf(l, er) for l in q, er.minAccepted))
      else:
          gaps += classifyMissing(er, now)   # PENDING_REVIEW | EXPIRED | REVOKED | INSUFFICIENT_COUNT | MISSING
  total ← |mandatory|

  raw ← if total = 0 or controls empty: NOT_MET          # never a vacuous MET
        elif satisfied = total:          MET
        elif satisfied > 0:              PARTIALLY_MET
        else:                            NOT_MET

  failing ← [c.latestTest for c in controls if c.latestTest?.result = FAIL]
  if raw = MET and failing non-empty: raw ← PARTIALLY_MET ; gaps += CONTROL_TEST_FAILED(each)

  # ── 3. dependencies ────────────────────────────────────────────────────
  depAtRisk ← false ; waived ← []
  for d in input.dependencies:
      case d.status:
        NOT_APPLICABLE:            waived += d.code                     # vacuously satisfied
        MET:                       pass
        AT_RISK:                   depAtRisk ← true ; gaps += DEPENDENCY_AT_RISK(d)
        UNDETERMINED:              gaps += DEPENDENCY_UNDETERMINED(d) ; if raw = MET: raw ← PARTIALLY_MET
        NOT_ADOPTED:               gaps += DEPENDENCY_NOT_ADOPTED(d)  ; if raw = MET: raw ← PARTIALLY_MET
        NOT_MET | PARTIALLY_MET:   gaps += DEPENDENCY_NOT_MET(d)      ; if raw = MET: raw ← PARTIALLY_MET

  # ── 4. AT_RISK overlay ─────────────────────────────────────────────────
  wasMet ← prev?.status ∈ {MET, AT_RISK}
           or input.carriedFromPreviousVersion?.wasMet           # see edge case E9
  if input.carriedFromPreviousVersion: gaps += REQUIREMENT_VERSION_CHANGED

  if raw = MET and not depAtRisk:
      return MET, lastMetAt = now, clear atRisk*, nextEvaluationAt = min(minExpiry, a.factsValidUntil)

  if wasMet:
      since ← prev.status = AT_RISK ? prev.atRiskSince : now
      until ← prev.status = AT_RISK ? prev.atRiskUntil : now + policy.atRiskGraceDays
      if now < until:
          return AT_RISK(since, until), lastMetAt = prev.lastMetAt,
                 nextEvaluationAt = min(until, a.factsValidUntil)

  if raw = MET and depAtRisk:       # never MET before, dependency lapsing: not MET either
      raw ← PARTIALLY_MET
  return raw, lastMetAt = prev?.lastMetAt, nextEvaluationAt = min(minExpiry, a.factsValidUntil)
```

**Choices:**

- **Mandatory ERs combine with AND across all mapped controls.** If two controls are mapped to one obligation, both must be evidenced. "Alternative controls" (either one satisfies) are deliberately not supported in v1 (Q5). Supporting them silently would let a tenant pick the cheapest control.
- **Only ACCEPTED, qualifying links count toward PARTIALLY_MET.** An unreviewed upload doesn't move the status. Otherwise uploading anything would turn NOT_MET into PARTIALLY_MET. Pending items appear as gaps.
- **A dependency caps A; it doesn't reset A.** If A's own evidence is complete but B is NOT_MET, A is PARTIALLY_MET with `DEPENDENCY_NOT_MET`. A's evidence work is preserved and visible.
- **MET does not require a PASS control test in v1.** It only requires the absence of a FAIL. Requiring PASS before COMPLIANCE-004 ships would make MET unreachable (Q4).

### 2.5 When status is recomputed

Status is a **projection**. Writes are coalesced through a dirty set, so a burst of events gives one recompute per obligation.

| Source event (outbox, same tx as mutation)                                                  | Obligations marked dirty                                                                                                                               |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ApplicabilityEvaluated`, `ApplicabilityReviewed`                                           | that obligation                                                                                                                                        |
| `FactRecorded` / `FactSuperseded`                                                           | none directly. It triggers re-evaluation of the requirement versions whose `required_facts ∋ key` (GIN index), and those emit `ApplicabilityEvaluated` |
| `EvidenceLinkProposed/Reviewed/Withdrawn`                                                   | link's obligation                                                                                                                                      |
| `EvidenceVersionStateChanged` (EXPIRED, REVOKED, DELETED)                                   | every obligation with a non-withdrawn link to that version                                                                                             |
| `ControlApproved/Retired`, `ObligationControlLinked/Unlinked`, `EvidenceRequirementChanged` | obligations mapped to that control                                                                                                                     |
| `RequirementStatusChanged`                                                                  | obligations whose requirement **depends on** this one, same legal entity (reverse dependency index)                                                    |
| `CorpusAdopted`                                                                             | all obligations of the tenant (batched, chunked by legal entity)                                                                                       |
| Sweeper: `next_evaluation_at ≤ now`                                                         | that obligation                                                                                                                                        |

Recompute procedure (`apps/worker`):

```
loop:
  BEGIN (withTenantTransaction per tenant batch)
    rows ← DELETE FROM compliance.status_dirty
           WHERE (tenant_id, obligation_id) IN (
             SELECT ... ORDER BY enqueued_at LIMIT 100 FOR UPDATE SKIP LOCKED)
           RETURNING *
    for r in rows:
      SELECT ... FROM compliance.requirement_status WHERE obligation_id = r.obligation_id FOR UPDATE
      input ← loadStatusInput(r.obligation_id)        # §5.3 query outline
      result ← computeRequirementStatus(input, prev, policy, now())
      if result.basisDigest = prev.basis_digest: continue           # idempotent no-op
      UPDATE requirement_status ...
      if result.status ≠ prev.status or gapsDigest changed:
        INSERT requirement_status_transitions ...                   # append-only
        recordAudit + enqueue RequirementStatusChanged              # AtomicAuditUnitOfWork
  COMMIT
```

- **Cascades terminate** because the dependency graph is a DAG (§2.6). As defence in depth, a dependency-triggered dirty mark carries a `cascade_depth`, and the worker refuses past depth 32 and raises an alert.
- **Concurrency:** the row lock on `requirement_status` serialises writers. Because computation reads the current source state, not event payloads, the last writer is always correct.
- **The time sweeper** runs every 5 minutes: `INSERT INTO status_dirty SELECT … FROM requirement_status WHERE next_evaluation_at <= now()`, plus a separate job that moves `evidence_versions` past `expires_at` to EXPIRED.

### 2.6 Dependency edge cases

| Case                                                    | Behaviour                                                                                                                        | Rationale                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A depends on B; **B is NOT_APPLICABLE** for this entity | Dependency waived. A computed on its own merits, and `waivedDependencies` records B                                              | A prerequisite that does not bind cannot block. Recording the waiver keeps the audit trail honest |
| B is UNDETERMINED                                       | A capped at PARTIALLY_MET with `DEPENDENCY_UNDETERMINED`                                                                         | Unknown is not satisfied (baseline: unknown never exempts)                                        |
| B is NOT_MET or PARTIALLY_MET                           | A capped at PARTIALLY_MET                                                                                                        | §2.4                                                                                              |
| B is AT_RISK, A was MET                                 | A → AT_RISK with its own grace clock                                                                                             | The lapse propagates, but A gets its own deadline                                                 |
| B is AT_RISK, A was never MET                           | A capped at PARTIALLY_MET                                                                                                        | AT_RISK is only reachable from MET                                                                |
| B is not in the tenant's adopted manifest               | `DEPENDENCY_NOT_ADOPTED`, A capped                                                                                               | Corpus inconsistency. It should be prevented at publication; this is defensive                    |
| B depends on A (cycle)                                  | **Rejected at corpus publication** (`assertAcyclic`, Kahn's algorithm) and by a constraint trigger on `requirement_dependencies` | Cycles make "MET" unreachable for both                                                            |
| B superseded by B′                                      | The dependency targets stable `requirementId`, so it resolves to whichever version the tenant has adopted                        | Avoids re-publishing A on every revision of B                                                     |
| A and B in different legal entities                     | Not supported. Dependencies resolve within the same legal entity                                                                 | DPDP duties attach to the fiduciary (legal person)                                                |
| A **only applies if** B applies                         | Not a dependency. Express it in A's applicability predicate using the same fact as B                                             | §1.3 hard rule                                                                                    |

### 2.7 Organisation-level rollup

Per COMPLIANCE-006, the dashboard shows **counts per state**, not a compliance percentage. When one value is needed per (organisation, requirement), for example in a heat map, take the worst status across legal entities using this severity order:

`UNDETERMINED` > `NOT_MET` > `PARTIALLY_MET` > `AT_RISK` > `MET` > `NOT_APPLICABLE`

UNDETERMINED ranks worst because an unknown duty might be a fully unmet one, and the baseline treats unknown as never safe.

---

## 3. Applicability evaluation

### 3.1 Why a predicate AST instead of flat AND/OR rule lists

| Problem with `ApplicabilityRule[] { operator: 'AND'|'OR', conditions[] }` | AST answer |
|---|---|
| Can't nest: "children's data AND (not exempt-class OR tracking)" | `all`/`any`/`not` compose to any depth |
| An **array** of rules has no defined combination: AND? OR? first-match? | A single root node. The combination is explicit |
| No negation | `not` |
| `value: any` can't be validated at publish time. `'500'` versus `500` silently compares false | Every leaf names a **registered fact key** with a declared type. `validatePredicate` rejects mismatched types before publication |
| Two-valued: a missing fact evaluates false, so the requirement becomes NOT_APPLICABLE, which is a silent exemption | Three-valued logic: a missing fact gives UNKNOWN, which gives UNDETERMINED |
| `includes` on a scalar vs a set is ambiguous | `in` is for scalar facts only; `has_any` is for set-valued facts only. Checked against the fact type |

Translation from the prompt's form: `{operator:'OR', conditions:[c1,c2]}` becomes `{op:'any', args:[c1',c2']}`. `'>'` becomes `gt`, `'='` becomes `eq`, and `'includes'` becomes `has_any`.

### 3.2 Facts and predicate types

```typescript
/** Registered in regulatory.fact_definitions. Unregistered keys are rejected. */
type FactKey = string & { readonly __brand: "FactKey" };
// Initial registry (v1):
//   org.employee_count            integer
//   org.industry                  enum      (tenant taxonomy, Q2)
//   org.is_state_instrumentality  boolean
//   data.categories               enum_set  (BIOMETRIC, GENETIC, HEALTH, FINANCIAL, ... tenant taxonomy, Q2)
//   data.subject_groups           enum_set  (CHILD, PERSON_WITH_DISABILITY, ...)
//   data.principal_volume         integer   (approx. data principals processed)
//   data.cross_border_transfer    boolean
//   sdf.notified                  boolean   (Central Government notification received)
//   processing.uses_processors    boolean

type FactValueType = "integer" | "boolean" | "enum" | "enum_set" | "date";
type Scalar = number | boolean | string; // string = enum code or ISODate

interface FactDefinition {
  key: FactKey;
  valueType: FactValueType;
  enumValues?: readonly string[]; // required for enum / enum_set
  maxAgeDays?: number; // fact older than observed_at + maxAgeDays => treated as missing
  description: string;
}

interface FactRecord {
  factId: UUID;
  legalEntityId: UUID;
  key: FactKey;
  value: Scalar | readonly string[]; // string[] only for enum_set
  source: "DECLARED" | "INVENTORY_DERIVED" | "REGULATOR_NOTICE" | "CONNECTOR";
  observedAt: ISOInstant;
  validFrom: ISOInstant;
  validTo?: ISOInstant; // exclusive
  confidence: "CONFIRMED" | "ASSERTED"; // CONFIRMED requires reviewedBy
  reviewedBy?: UUID; // actor_ref
  revision: number;
}

/** Facts valid at `asOf` for ONE legal entity, at most one record per key. */
interface FactSnapshot {
  legalEntityId: UUID;
  asOf: ISOInstant;
  facts: ReadonlyMap<FactKey, FactRecord>;
}

type ApplicabilityPredicate =
  | { op: "const"; value: boolean } // 'applies to every fiduciary'
  | { op: "all"; args: readonly ApplicabilityPredicate[] } // len >= 1
  | { op: "any"; args: readonly ApplicabilityPredicate[] } // len >= 1
  | { op: "not"; arg: ApplicabilityPredicate }
  | { op: "eq"; fact: FactKey; value: Scalar } // integer|boolean|enum|date
  | { op: "in"; fact: FactKey; values: readonly Scalar[] } // scalar facts only, len >= 1
  | { op: "gt" | "gte" | "lt" | "lte"; fact: FactKey; value: number | ISODate } // integer|date
  | { op: "has_any"; fact: FactKey; values: readonly string[] }; // enum_set only, len >= 1

type Truth = "T" | "F" | "U";

interface TraceNode {
  op: ApplicabilityPredicate["op"];
  truth: Truth;
  fact?: FactKey;
  factId?: UUID; // which fact record was read
  observed?: unknown; // value read. Omitted for P-classified facts in audit payloads
  reason?: "MISSING" | "EXPIRED" | "STALE" | "TYPE_MISMATCH";
  children?: TraceNode[];
}

interface ApplicabilityEvaluation {
  outcome: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";
  truth: Truth;
  trace: TraceNode; // full rationale tree
  blockingFacts: FactKey[]; // facts whose resolution could change the outcome
  factsUsed: ReadonlyArray<{ factId: UUID; key: FactKey; revision: number }>;
  factsValidUntil?: ISOInstant; // min(validTo, observedAt+maxAgeDays) over factsUsed
  ruleDigest: string;
  evaluatedAt: ISOInstant;
  errors: ReadonlyArray<{
    code: "TYPE_MISMATCH" | "UNREGISTERED_FACT";
    fact: FactKey;
  }>;
}
```

### 3.3 Function signatures

```typescript
/** Publish-time and load-time validation. Rejects unknown ops, unregistered facts, type
 *  mismatches, empty all/any/in/has_any, depth > 16, node count > 256. */
export function validatePredicate(
  predicate: unknown,
  registry: ReadonlyMap<FactKey, FactDefinition>,
): ValidationResult; // same shape as domain/compliance ValidationResult

/** Pure. Deterministic. Never throws on data problems: bad data gives U plus an errors[] entry.
 *  Throws only on a structurally invalid predicate (programmer error: it should have been validated). */
export function evaluateApplicability(
  rule: ApplicabilityRuleRef,
  facts: FactSnapshot,
  registry: ReadonlyMap<FactKey, FactDefinition>,
  now: Date,
): ApplicabilityEvaluation;

/** NestJS service (apps/api), the IO wrapper. */
interface ApplicabilityService {
  assessLegalEntity(
    ctx: TrustedTenantContext,
    cmd: {
      legalEntityId: UUID;
      requirementVersionIds?: UUID[]; // default: all in ACTIVE corpus adoption
      reason: "INITIAL" | "FACT_CHANGED" | "CORPUS_ADOPTED" | "MANUAL";
      idempotencyKey: string;
    },
  ): Promise<{
    runId: UUID;
    applicable: number;
    notApplicableProposed: number;
    unknown: number;
  }>;

  reviewDecision(
    ctx: TrustedTenantContext,
    cmd: {
      decisionId: UUID;
      expectedRevision: number;
      verdict: "APPROVE" | "REJECT";
      note: string;
    },
  ): Promise<void>; // rejects if ctx.actorId = decision.proposed_by

  overrideDecision(
    ctx: TrustedTenantContext,
    cmd: {
      decisionId: UUID;
      expectedRevision: number;
      outcome: "APPLICABLE" | "NOT_APPLICABLE";
      reason: string;
      citationRef: string;
    },
  ): Promise<{ overrideDecisionId: UUID }>; // creates a PROPOSED OVERRIDE decision that needs approval
}
```

### 3.4 Algorithm

```
evaluateApplicability(rule, snapshot, registry, now):
  result ← eval(rule.predicate)
  outcome ← { T: APPLICABLE, F: NOT_APPLICABLE, U: UNKNOWN }[result.truth]
  return { outcome, truth: result.truth, trace: result,
           blockingFacts: sort(unique(blocking(result))),
           factsUsed, factsValidUntil, ruleDigest: rule.digest, evaluatedAt: now, errors }

eval(node) → TraceNode:
  case node.op:
    'const':          return { truth: node.value ? T : F }

    'all':            kids ← [eval(c) for c in node.args]          # NO short-circuit: full trace
                      truth ← F if any(k.truth = F) else U if any(k.truth = U) else T
    'any':            kids ← [eval(c) for c in node.args]
                      truth ← T if any(k.truth = T) else U if any(k.truth = U) else F
    'not':            k ← eval(node.arg); truth ← {T:F, F:T, U:U}[k.truth]

    leaf (eq|in|gt|gte|lt|lte|has_any):
      def ← registry[node.fact]                       # validated earlier, so it exists
      rec ← snapshot.facts[node.fact]
      if rec is null:                                  return U, reason MISSING
      if not (rec.validFrom ≤ now < (rec.validTo ?? ∞)): return U, reason EXPIRED
      if def.maxAgeDays and rec.observedAt + def.maxAgeDays ≤ now: return U, reason STALE
      if typeOf(rec.value) ≠ def.valueType:            errors += TYPE_MISMATCH; return U
      record rec in factsUsed
      truth ← compare(node.op, rec.value, node.value/values) ? T : F
              # eq/in: strict equality on canonical value (enum codes case-sensitive, dates as ISODate strings)
              # gt..lte: numeric for integer; lexical ISODate compare for date
              # has_any: |set(rec.value) ∩ set(node.values)| > 0

blocking(node) → set<FactKey>:            # facts that could flip the outcome
  if node.truth ≠ U:   return ∅            # e.g. any(T, U) = T, so the U child doesn't matter
  if node is leaf:     return { node.fact }
  return ∪ blocking(c) for c in node.children where c.truth = U
```

**Truth tables** (Kleene strong logic, as fixed in REGULATORY_INGESTION_SPEC):

```
all  | T  F  U        any  | T  F  U        not
-----+---------       -----+---------       ----
 T   | T  F  U         T   | T  T  T        T→F
 F   | F  F  F         F   | T  F  U        F→T
 U   | U  F  U         U   | T  U  U        U→U
```

**Why there is no short-circuit.** Evaluation is microseconds, and the rationale tree must show every leaf to an auditor. Short-circuiting would make the trace depend on argument order.

**Why bad data gives U and doesn't throw.** A thrown error inside a batch run would leave obligations stale. U is the conservative outcome (UNDETERMINED), it is visible, and `errors[]` raises a `ApplicabilityFactInvalid` audit event for the data owner.

### 3.5 From evaluation to decision (maker/checker)

| Computed outcome            | Decision state written                         | Effective for status?                                                                                                                                    | Reason                                                                                                                     |
| --------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| APPLICABLE                  | `APPROVED` with `decision_source = AUTOMATED`  | Yes                                                                                                                                                      | Conservative: it adds a duty and can't hide one. Requiring approval for every APPLICABLE would bury DPOs in approvals (Q6) |
| UNKNOWN                     | `APPROVED`, `AUTOMATED`                        | Yes, gives UNDETERMINED                                                                                                                                  | Conservative, and the gap is visible                                                                                       |
| NOT_APPLICABLE              | `PROPOSED`, `AUTOMATED`                        | **No.** Status stays UNDETERMINED until a human approves (approver ≠ proposer; for automated proposals, approver ≠ the actor who last changed the facts) | Removing a duty is the dangerous direction: it's an exemption and needs human review (ATOMIC-002)                          |
| Human override (either way) | `PROPOSED`, `OVERRIDE`, with reason + citation | Only after independent approval                                                                                                                          | Never an AST mutation (spec)                                                                                               |

A new decision **revision** is written only when `(outcome, ruleDigest, factsUsed digest)` changes. Re-running with unchanged inputs is a no-op, so runs are idempotent. An APPROVED NOT_APPLICABLE stays effective until a re-evaluation produces a different outcome. A flip from NOT_APPLICABLE to APPLICABLE is auto-approved (the conservative direction). A flip from APPLICABLE to NOT_APPLICABLE needs approval again.

### 3.6 Worked example: SDF rules

**The prompt's rule.** Encode it as a **synthetic fixture only** (`SYNTH-SDF-001`, `classification = GOOD_PRACTICE`):

```json
{
  "op": "any",
  "args": [
    { "op": "gte", "fact": "org.employee_count", "value": 500 },
    {
      "op": "has_any",
      "fact": "data.categories",
      "values": ["BIOMETRIC", "GENETIC", "HEALTH"]
    },
    {
      "op": "has_any",
      "fact": "data.subject_groups",
      "values": ["CHILD", "PERSON_WITH_DISABILITY"]
    }
  ]
}
```

| Facts for legal entity                               | Leaf truths         | Root              | Outcome                       | blockingFacts         |
| ---------------------------------------------------- | ------------------- | ----------------- | ----------------------------- | --------------------- |
| employees=1200                                       | T, U, U             | T                 | APPLICABLE                    | []                    |
| employees=200, categories=[HEALTH]                   | F, T, U             | T                 | APPLICABLE                    | []                    |
| employees=200, categories=[], subject_groups missing | F, F, U             | U                 | UNKNOWN → UNDETERMINED        | [data.subject_groups] |
| employees=200, categories=[], subject_groups=[]      | F, F, F             | F                 | NOT_APPLICABLE **(PROPOSED)** | []                    |
| employees="200" (string)                             | U (TYPE_MISMATCH) … | depends on others | errors[] non-empty            | …                     |

**Legal caveat (must go to Legal, OPEN-01, Q1).** As the baseline understands DPDP Act 2023 s.10(1), Significant Data Fiduciary status arises from a **Central Government notification** that considers factors such as the volume and sensitivity of personal data and the risk to Data Principals' rights. Employee headcount is not a statutory criterion, and the Act defines no GDPR-style "special category" set. The production rule should therefore be:

```json
{ "op": "eq", "fact": "sdf.notified", "value": true }
```

The headcount, sensitivity and vulnerable-group heuristic is still useful as a **readiness signal**: a separate `GOOD_PRACTICE` requirement, "Prepare for possible SDF designation". It must never be labelled as law. Nothing in this document is an authoritative statement of DPDP content. Every legal-labelled rule passes the REGULATORY_INGESTION_SPEC review gates.

### 3.7 Applicability edge cases

| Case                                                   | Behaviour                                                                                                                                                                                                              |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fact never declared                                    | U, then UNDETERMINED, with the fact listed in `blockingFacts` so the UI can prompt for exactly that fact                                                                                                               |
| Fact expired (`validTo ≤ now`) or stale (`maxAgeDays`) | U. The sweeper (`next_evaluation_at = factsValidUntil`) re-evaluates at the moment of expiry                                                                                                                           |
| Fact type mismatch                                     | U + `TYPE_MISMATCH`. Never coerced                                                                                                                                                                                     |
| Predicate references an unregistered fact              | Rejected at publication (`validatePredicate`). If found at load time, the whole rule evaluates to U and the event is `ApplicabilityRuleInvalid`                                                                        |
| Requirement has no rule                                | Publication rejected. "Always applies" is `{op:"const", value:true}`, which makes it explicit and reviewable                                                                                                           |
| Empty `all`/`any`                                      | Rejected at publication. Never evaluated (avoids the vacuous-truth trap: `all([]) = T`)                                                                                                                                |
| Retroactive fact (`validFrom` in the past)             | Current evaluation uses `now`. Historical "as of" queries are possible because facts and decisions are temporal                                                                                                        |
| `ASSERTED` (unreviewed) fact                           | Used for evaluation, but a decision built from ASSERTED facts that yields NOT_APPLICABLE cannot be approved until those facts are CONFIRMED                                                                            |
| Fact changes after an APPROVED NOT_APPLICABLE          | Re-evaluated. If it is still NOT_APPLICABLE with a different facts digest, a new PROPOSED revision is written and the old approval remains effective until review (no flapping to UNDETERMINED for unchanged outcomes) |

---

## 4. Evidence collection and linking

### 4.1 Model

```
evidence (logical item, e.g. "Data Retention Policy")
   └── evidence_versions (immutable bytes; one per upload)  ── object in MinIO
          └── evidence_custody (append-only chain of custody)
          └── evidence_links ──► evidence_requirements (tenant, per control)
                    │                        ▲
                    └──► obligations ────────┘ (link must match a control mapped to the obligation)
```

- **Links point at a version, not the logical evidence.** What was reviewed is exactly these bytes. Uploading v2 does **not** auto-move links. A "carry forward" command creates PROPOSED links for v2, which need review. Auto-moving would let unreviewed bytes inherit an acceptance.
- **One version may satisfy many evidence requirements and obligations**, through multiple links. A privacy policy commonly evidences notice, retention and grievance duties.
- **Links carry both `evidence_requirement_id` and `obligation_id`.** The evidence requirement says what kind of proof it is. The obligation says which legal entity it is for. A trigger checks that the ER's control is mapped to the obligation through `obligation_controls`, valid now.

### 4.2 Object storage layout (MinIO reference adapter, any S3-compatible store)

| Aspect         | Decision                                                                                                                                                                                                                                                                                                                                         | Why                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buckets        | `{deployment}-evidence-quarantine` and `{deployment}-evidence`, both private, versioning ON. Object Lock ON for `-evidence`                                                                                                                                                                                                                      | Separate IAM principals. The API and scanner can write quarantine; only the promotion service can write evidence. A scanner compromise can't read promoted evidence                 |
| Object key     | `t/{tenant_id}/e/{evidence_id}/v/{evidence_version_id}`, server-generated, no user-supplied names                                                                                                                                                                                                                                                | Prevents path injection and enumeration. The tenant prefix enables per-tenant export, purge and IAM conditions. The original filename is stored only in the DB (`display_filename`) |
| Upload         | `POST evidence/uploads` creates an `upload_reservation` (declared size ≤ limit, declared sha256, mime). Bytes go through the API gateway stream (or a single-use presigned PUT bound to the reservation) into the quarantine bucket. The server computes sha256 while streaming. A mismatch rejects the upload and deletes the quarantine object | COMPLIANCE-002 acceptance: oversize, hash mismatch and reused reservations are all rejected                                                                                         |
| Scan           | The scanner reads quarantine through a short-lived internal URL and posts `{versionId, sha256, verdict, engine, signatureVersion}`. The verdict is accepted only if sha256 matches                                                                                                                                                               | Scanner outage leaves the version in SCANNING (fail closed)                                                                                                                         |
| Promotion      | On CLEAN: server-side copy to `-evidence`, store the S3 `VersionId` in `object_version_id`, re-verify the checksum, then delete the quarantine object. State becomes AVAILABLE                                                                                                                                                                   | `object_version_id` pins the exact bytes even if the key is overwritten by a bug                                                                                                    |
| Object Lock    | **GOVERNANCE** mode, `RetainUntilDate = retain_until`. `LegalHold = ON` mirrors active DB holds                                                                                                                                                                                                                                                  | COMPLIANCE mode can never be shortened, which blocks lawful erasure (DPDP erasure duties and OPEN-04 schedules). GOVERNANCE allows a narrowly privileged purge role to bypass (Q7)  |
| Encryption     | SSE with a per-tenant key reference via the SECURITY-001 envelope port. `key_ref` is stored on the version                                                                                                                                                                                                                                       | ADR-018 is still Proposed (OPEN-02). The column is defined now; the provider comes later (Q8)                                                                                       |
| Download       | `GET evidence/versions/:id/download`: authorise metadata, then classification, then the separate download permission, then stream through the API with a sha256 recheck. A digest mismatch gives 409 and an integrity alert                                                                                                                      | SECURITY_ARCHITECTURE object-storage row                                                                                                                                            |
| Credentials    | `api` gets PutObject on quarantine only. `promoter` gets GetObject on quarantine and PutObject on evidence. `api-download` gets GetObject on evidence. `purger` gets `s3:DeleteObjectVersion` + `s3:BypassGovernanceRetention`. **No principal has `ListBucket` on user paths.**                                                                 | Least privilege. Only one identity can destroy bytes                                                                                                                                |
| Reconciliation | A nightly job diffs DB `object_key/object_version_id` against bucket inventory and reports orphans in both directions. It never auto-deletes                                                                                                                                                                                                     | Detects drift without letting drift destroy anything                                                                                                                                |

### 4.3 Evidence states (WORKFLOW_SPEC, unchanged)

```
RESERVED ─► UPLOADED_QUARANTINE ─► SCANNING ─┬─► AVAILABLE ─┬─► EXPIRED ──┐
                                             │              ├─► REVOKED ──┼─► DELETED (bytes purged,
                                             └─► REJECTED ──┴─────────────┘   metadata tombstone kept)
```

Only `AVAILABLE` versions can have links proposed or accepted. Transitions are enforced by a trigger using an allowed-transition table. Columns describing bytes (`object_key`, `object_version_id`, `sha256`, `bytes`, `mime`) are immutable once they are set.

### 4.4 Referential integrity: how deletion is prevented

Six independent layers. Any single layer stops the accidental or malicious deletion of linked evidence.

| #   | Layer                                                                                                               | Mechanism                                                                                                                                                                                                                                                                                         | Stops                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | **No DELETE privilege**                                                                                             | `REVOKE DELETE ON evidence.evidence, evidence_versions, evidence_custody, compliance.evidence_links, requirement_status_transitions FROM privy360_app`                                                                                                                                            | Any CRUD or API bug issuing `DELETE`                                   |
| 2   | **FK `ON DELETE RESTRICT`** with composite tenant keys                                                              | `evidence_links (tenant_id, evidence_version_id) → evidence_versions (tenant_id, id)`, and versions → evidence, all `RESTRICT`                                                                                                                                                                    | Deleting a referenced row even with elevated privilege (migrator, ops) |
| 3   | **Unlink is temporal, not destructive**                                                                             | Withdrawing sets `state = WITHDRAWN` and `valid_to = now()` with reason and actor. The edge row persists forever                                                                                                                                                                                  | Loss of "what supported this status on date X" history                 |
| 4   | **Byte-purge guard** (`evidence.assert_purgeable(version_id)`, `SECURITY DEFINER`, callable only by the purge role) | A version may go to DELETED only if: (a) no link has `state IN ('PROPOSED','ACCEPTED')` and `valid_to IS NULL`; (b) no ACTIVE hold; (c) `retain_until ≤ now()`; (d) a deletion approval reference is present. Metadata row, sha256 and custody stay as a tombstone                                | Purging evidence that currently supports a status                      |
| 5   | **Object Lock + IAM**                                                                                               | GOVERNANCE retention + LegalHold. Only the `purger` principal can bypass                                                                                                                                                                                                                          | Deleting bytes outside the database (console, leaked app key)          |
| 6   | **API semantics**                                                                                                   | `DELETE /evidence/:id` doesn't exist. `POST /evidence/:id/archive` returns **409 `EVIDENCE_LINKED`** with the list of active links (obligation, requirement code, status impact). The user must withdraw each link, and each withdrawal triggers a status recompute (MET usually becomes AT_RISK) | UX surprise. The consequence is shown before the action                |

**Why tenant-composite FKs.** Every FK uses `(tenant_id, id)`, as in migration `0001`. RLS alone hides cross-tenant rows, but a composite FK makes a cross-tenant link structurally impossible even for a role that bypasses RLS.

**Holds versus erasure.** If a Data Principal erasure request targets personal data inside an evidence version that is under hold, the hold wins and the conflict escalates to DPO and Legal (DATABASE_SPEC: holds take precedence and are reviewed). The engine never resolves this automatically.

### 4.5 Evidence qualification (single source of truth)

```typescript
export function qualifies(
  link: EvidenceLinkView, // state, validFrom, validTo, version {state, capturedAt, expiresAt}
  er: { freshnessDays?: number },
  now: Date,
): boolean;
// true iff ALL of:
//   link.state = 'ACCEPTED'
//   link.validFrom ≤ now < (link.validTo ?? ∞)
//   link.version.state = 'AVAILABLE'                       (not EXPIRED/REVOKED/DELETED/quarantined)
//   link.version.expiresAt is null or now < link.version.expiresAt
//   er.freshnessDays is null or now < link.version.capturedAt + er.freshnessDays
//
// expiryOf(link, er) = min(link.validTo, version.expiresAt, capturedAt + freshnessDays)  (∞ if none)
```

The status engine (§2.4) and the control-test command (COMPLIANCE-004, "expired/quarantined evidence cannot satisfy test") MUST both call this one function.

### 4.6 Link lifecycle

```
PROPOSED ──review(ACCEPT, reviewer ≠ proposer)──► ACCEPTED ──withdraw──► WITHDRAWN
    │                                                 │
    └──review(REJECT)──► REJECTED                     └──new version accepted with
                                                        supersede flag──► SUPERSEDED
```

Validation on propose: the version is AVAILABLE; `evidence.evidence_type = evidence_requirement.required_type`; the ER's control is mapped to the obligation (valid now); and there is no other open (PROPOSED or ACCEPTED) link for the same `(version, ER, obligation)`.

---

## 5. Database migrations outline (0011–0013)

Conventions, as in existing migrations: `uuidv7()` PKs; `tenant_id` + composite FKs; `ENABLE` + `FORCE ROW LEVEL SECURITY` with the standard `*_tenant_isolation` policy on every tenant table; global tables get `SELECT` only for `privy360_app`; `created_at/by`, `updated_at/by`, `version bigint` on mutable tenant rows. Each `.down.sql` **refuses to drop non-empty tenant tables** (`RAISE EXCEPTION` if rows exist), per DATABASE_SPEC §Evolution. Ledger insert: see Q10.

### 5.1 `0011_applicability_decisions` (ticket ATOMIC-002)

**Global (`regulatory`)**

| Object                                   | Columns / constraints                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `regulatory.fact_definitions`            | `key text PK` (check `^[a-z]+(\.[a-z_]+)+$`), `value_type` check in (integer, boolean, enum, enum_set, date), `enum_values text[]` (non-null iff enum/enum_set), `max_age_days int null check >0`, `description`, `revision`, `created_at`                                                                                                                                                                           |
| `regulatory.applicability_rules` (ALTER) | add `predicate_schema_version int not null default 1`, `digest text not null check sha256 hex`, `unique(digest)`. Add GIN index on `required_facts`. Add immutability trigger once referenced by a PUBLISHED requirement version                                                                                                                                                                                     |
| `regulatory.requirement_version_rules`   | `requirement_version_id PK FK → requirement_versions RESTRICT`, `applicability_rule_id FK → applicability_rules RESTRICT`. One rule per version. Immutable when the version is PUBLISHED (reuse `reject_published_mutation` pattern)                                                                                                                                                                                 |
| `regulatory.requirement_version_clauses` | `(requirement_version_id, provision_version_id) PK`, `citation_id FK`, `role` check in (PRIMARY, SUPPORTING), partial unique index: one PRIMARY per requirement version. This turns the single `provision_version_id` column into a list; that column stays as the PRIMARY for compatibility                                                                                                                         |
| `regulatory.requirement_dependencies`    | `(requirement_id, depends_on_requirement_id) PK`, both FK → `requirements` RESTRICT, `kind` check = 'PREREQUISITE', `rationale text not null`, `recorded_at`, `check (requirement_id <> depends_on_requirement_id)`. **Deferred constraint trigger** `assert_dependency_acyclic` does a recursive CTE walk from `depends_on` and raises if it reaches `requirement_id`. Reverse index on `depends_on_requirement_id` |

**Tenant (`compliance`)**

| Object                                 | Columns / constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance.corpus_adoptions`          | `id`, `tenant_id`, `manifest_id FK → regulatory.publication_manifests RESTRICT`, `state` check in (PROPOSED, ACTIVE, SUPERSEDED), `proposed_by`, `approved_by`, `check (approved_by <> proposed_by)`, partial unique `(tenant_id) WHERE state='ACTIVE'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `compliance.legal_entity_facts`        | `id`, `tenant_id`, `legal_entity_id` (composite FK → `tenant.legal_entities`), `fact_key FK → regulatory.fact_definitions`, `value jsonb not null`, `source` check, `observed_at`, `valid_from`, `valid_to null`, `confidence` check, `reviewed_by null`, `revision`, `check (confidence <> 'CONFIRMED' or reviewed_by is not null)`, `check (valid_to is null or valid_from < valid_to)`. **EXCLUDE USING gist** `(tenant_id =, legal_entity_id =, fact_key =, tstzrange(valid_from, valid_to) &&)` so there are no overlapping validity intervals per key (needs `btree_gist`). Value type checked against the definition by trigger                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `compliance.applicability_runs`        | `id`, `tenant_id`, `legal_entity_id`, `corpus_adoption_id`, `reason`, `idempotency_key`, `started_at`, `finished_at`, counts. `unique(tenant_id, idempotency_key)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `compliance.requirement_applicability` | `id`, `tenant_id`, `legal_entity_id`, `requirement_version_id FK → regulatory.requirement_versions RESTRICT`, `scope_digest`, `revision`, `outcome` check in (APPLICABLE, NOT_APPLICABLE, UNKNOWN), `state` check in (PROPOSED, APPROVED, REJECTED, SUPERSEDED), `decision_source` check in (AUTOMATED, OVERRIDE), `rule_id`, `rule_digest`, `facts_digest`, `facts_used jsonb` (ids + revisions only, no values), `trace jsonb` (values of P-classified facts redacted), `blocking_facts text[]`, `facts_valid_until`, `run_id`, `proposed_by`, `approved_by`, `approved_at`, `override_reason`, `override_citation`. Constraints: `unique (tenant_id, requirement_version_id, scope_digest, revision)`; `check (approved_by is null or approved_by <> proposed_by)`; `check (decision_source <> 'OVERRIDE' or (override_reason is not null and override_citation is not null))`; `check (outcome <> 'NOT_APPLICABLE' or state <> 'APPROVED' or approved_by is not null)`; partial unique on the current decision `(tenant_id, requirement_version_id, scope_digest) WHERE state = 'APPROVED'` |
| `compliance.obligations` (ALTER)       | add `legal_entity_id uuid not null` (backfill: none exist yet). Add composite FK `(tenant_id, applicability_id) → requirement_applicability(tenant_id, id)`. Add `unique (tenant_id, requirement_version_id, scope_digest)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### 5.2 `0012_evidence_store` (tickets COMPLIANCE-002 and COMPLIANCE-003; schema `evidence`)

| Object                                        | Columns / constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance.evidence_types` (global registry) | `code text PK`, `label`, `description`. Seeded with the 9 codes in §1.2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `compliance.evidence_requirements` (ALTER)    | add `is_mandatory boolean not null default true`, `min_accepted int not null default 1 check (min_accepted >= 1)`; FK `required_type → compliance.evidence_types(code)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `evidence.evidence`                           | `id`, `tenant_id`, `code` (unique per tenant), `title`, `evidence_type FK → evidence_types`, `classification` check in (INTERNAL, CONFIDENTIAL, RESTRICTED_PD), `owner_actor_id`, `legal_entity_id null`, `retention_rule_ref text null` (OPEN-04), `state` check in (ACTIVE, ARCHIVED), audit columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `evidence.upload_reservations`                | `id`, `tenant_id`, `evidence_id`, `declared_bytes bigint check (>0 and <= 104857600)` (100 MiB, Q13), `declared_sha256` check hex64, `declared_mime`, `reserved_by`, `expires_at`, `state` check in (OPEN, CONSUMED, EXPIRED), `consumed_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `evidence.evidence_versions`                  | `id`, `tenant_id`, `evidence_id`, `version_no int`, `reservation_id unique` (no reservation reuse), `bucket`, `object_key`, `object_version_id null` (set at promotion), `sha256` check hex64, `bytes bigint check >0`, `mime`, `display_filename`, `key_ref`, `state` (WORKFLOW_SPEC enum), `scan_engine`, `scan_signature_version`, `scanned_at`, `captured_at` (when the evidence was true, not upload time), `expires_at null`, `retain_until null`, `origin` check in (MANUAL_UPLOAD, CONNECTOR, SYSTEM_GENERATED), `deleted_at null`, `deletion_approval_ref null`. Constraints: `unique (tenant_id, evidence_id, version_no)`; `unique (bucket, object_key)`; `check (state <> 'AVAILABLE' or object_version_id is not null)`; `check (state <> 'DELETED' or deletion_approval_ref is not null)`. Triggers: `evidence_versions_transition_guard` (allowed-transition table §4.3) and `evidence_versions_bytes_immutable` (rejects changes to object_key, object_version_id, sha256, bytes, mime once non-null). Index on `(tenant_id, expires_at) WHERE state='AVAILABLE'`                                                                   |
| `evidence.evidence_custody`                   | `(tenant_id, evidence_version_id, sequence) PK`, `action` check in (RESERVED, UPLOADED, SCAN_STARTED, SCANNED, PROMOTED, DOWNLOADED, EXPIRED, REVOKED, HOLD_PLACED, HOLD_RELEASED, PURGED), `actor_id`, `service`, `at`, `source_digest`, `result_digest`. Append-only trigger rejects UPDATE and DELETE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `evidence.evidence_holds`                     | `id`, `tenant_id`, `evidence_id` or `evidence_version_id` (exactly one, check), `authority`, `reason`, `state` check in (ACTIVE, RELEASED), `placed_by`, `released_by`, `released_at`, `check (released_by is null or released_by <> placed_by)`. Interim until LIFECYCLE-001 `legal_holds` (Q9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `compliance.evidence_links`                   | `id`, `tenant_id`, `edge_identity_id`, `assertion_revision`, `evidence_version_id`, `evidence_requirement_id`, `obligation_id`, `state` check in (PROPOSED, ACCEPTED, REJECTED, WITHDRAWN, SUPERSEDED), `proposed_by`, `proposed_at`, `reviewed_by`, `reviewed_at`, `review_note`, `valid_from`, `valid_to`, `reason`, `source_ref`, `recorded_at`. All FKs composite `(tenant_id, …)` `ON DELETE RESTRICT`. Constraints: `check (reviewed_by is null or reviewed_by <> proposed_by)`; `check (state not in ('ACCEPTED','REJECTED') or reviewed_by is not null)`; `check (valid_to is null or valid_from < valid_to)`; `unique (tenant_id, edge_identity_id, assertion_revision)`; partial unique `(tenant_id, evidence_version_id, evidence_requirement_id, obligation_id) WHERE state IN ('PROPOSED','ACCEPTED')`. Trigger `evidence_links_consistency`: version AVAILABLE on insert or accept; type match; ER's control mapped to the obligation via `obligation_controls` valid now. Indexes on both endpoint directions: `(tenant_id, evidence_version_id)`, `(tenant_id, obligation_id, evidence_requirement_id)`, `(tenant_id, recorded_at)` |
| `evidence.assert_purgeable(uuid)`             | `SECURITY DEFINER` function, guard §4.4 layer 4. `EXECUTE` granted to the purge role only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Grants                                        | `REVOKE DELETE` on all of the above from `privy360_app`. `UPDATE` limited by column grants: e.g. `evidence_links(state, reviewed_by, reviewed_at, review_note, valid_to)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### 5.3 `0013_compliance_status` (projection for COMPLIANCE-006)

| Object                                      | Columns / constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance.status_policy`                  | `tenant_id PK`, `at_risk_grace_days int not null default 30 check (between 0 and 365)`, `expiry_warning_days int not null default 30 check (between 0 and 365)`, audit columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `compliance.requirement_status`             | `(tenant_id, obligation_id) PK` (composite FK → obligations), `legal_entity_id`, `requirement_id`, `requirement_version_id`, `status` check (6 values), `gaps jsonb not null default '[]'`, `mandatory_total int`, `mandatory_satisfied int`, `last_met_at`, `at_risk_since`, `at_risk_until`, `earliest_evidence_expiry`, `next_evaluation_at`, `basis_digest`, `engine_version`, `computed_at`, `row_version bigint`. Checks: `status <> 'MET' or (mandatory_total > 0 and mandatory_satisfied = mandatory_total)`; `status <> 'AT_RISK' or (at_risk_since is not null and at_risk_until is not null and last_met_at is not null)`; `mandatory_satisfied between 0 and mandatory_total`. Indexes: `(tenant_id, legal_entity_id, status)` for dashboard counts; `(next_evaluation_at) WHERE next_evaluation_at IS NOT NULL` for the sweeper; `(tenant_id, requirement_id)` for reverse dependency fan-out |
| `compliance.requirement_status_transitions` | `id`, `tenant_id`, `obligation_id`, `from_status null`, `to_status`, `gaps jsonb`, `basis_digest`, `trigger_kind`, `trigger_event_id null`, `engine_version`, `occurred_at`. Append-only trigger. **Transition guard trigger:** `to_status = 'AT_RISK'` requires `from_status IN ('MET','AT_RISK')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `compliance.status_dirty`                   | `(tenant_id, obligation_id) PK`, `reason`, `cascade_depth int default 0 check (<= 32)`, `enqueued_at`. Upsert coalesces repeated marks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Grants                                      | `requirement_status`: the app role may SELECT/INSERT/UPDATE (the worker runs as the app role); **no REST route writes it**. `requirement_status_transitions`: SELECT/INSERT only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**`loadStatusInput(obligation_id)` query outline**, in one tenant transaction:

1. Obligation, plus the current APPROVED (or latest PROPOSED NOT_APPLICABLE) `requirement_applicability`.
2. `obligation_controls` valid now, joined to `controls WHERE state='APPROVED'`, joined to `evidence_requirements` (latest revision per code).
3. `evidence_links WHERE obligation_id = $1 AND state <> 'WITHDRAWN'` joined to `evidence_versions` (state, captured_at, expires_at).
4. `regulatory.requirement_dependencies` for the requirement, resolved through the active corpus adoption to obligations for the same legal entity, then their `requirement_status.status` (or `NOT_ADOPTED`).
5. Latest `control_tests` per implementation, once COMPLIANCE-004 exists (empty until then).

### 5.4 Domain events (added to EVENT_MODEL)

All are emitted through `AtomicAuditUnitOfWork` in the mutating transaction. Payloads carry IDs, codes and states only; no fact values or file names (the `assertSafePayload` rules apply).

`FactRecorded`, `FactSuperseded`, `ApplicabilityEvaluated`, `ApplicabilityReviewed`, `ApplicabilityFactInvalid`, `CorpusAdopted`, `EvidenceUploadReserved`, `EvidenceQuarantined`, `EvidenceScanned`, `EvidenceVersionStateChanged`, `EvidenceLinkProposed`, `EvidenceLinkReviewed`, `EvidenceLinkWithdrawn`, `EvidenceHoldChanged`, `RequirementStatusChanged`.

### 5.5 Mandatory tests (beyond T0–T5)

- **Truth tables:** all 9 combinations for `all` and `any`, and 3 for `not`. `blockingFacts` minimality, e.g. `any(T,U)` gives `[]`.
- **Property tests:** `evaluateApplicability` is deterministic, and argument order doesn't change `truth`. `computeRequirementStatus` never returns `AT_RISK` when `previous` ∉ {MET, AT_RISK} and no carry-forward. It never returns MET with `mandatoryTotal = 0`.
- **Each row of §2.3, §2.6, §3.7 and §6** as a named test.
- **DB negative tests:** DELETE on evidence tables is denied for the app role. Cross-tenant link FK fails. AT_RISK transition guard. Dependency cycle rejected. Overlapping fact intervals rejected. Self-approval rejected.
- **Storage contract tests** against MinIO: Object Lock blocks DeleteObjectVersion for the app key, and the checksum mismatch path.

---

## 6. Cross-cutting edge cases

| #   | Scenario                                                                         | Behaviour                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Evidence version expires while ACCEPTED                                          | Sweeper moves it to EXPIRED and emits an event. Linked obligations go MET → AT_RISK (grace), then PARTIALLY_MET or NOT_MET after the deadline                                                                                                                                                                   |
| E2  | User tries to archive evidence with active links                                 | 409 `EVIDENCE_LINKED` with the impact list (§4.4 layer 6)                                                                                                                                                                                                                                                       |
| E3  | Same version links to 5 obligations; it is revoked                               | One `EvidenceVersionStateChanged` marks 5 obligations dirty. Each recompute is independent                                                                                                                                                                                                                      |
| E4  | Uploader tries to accept their own link                                          | Rejected by the app check and the DB `check (reviewed_by <> proposed_by)`                                                                                                                                                                                                                                       |
| E5  | Scanner down for 6 hours                                                         | Versions sit in SCANNING and can't be linked. Status is unaffected. Alert on SCANNING age                                                                                                                                                                                                                       |
| E6  | Applicability flips APPLICABLE → NOT_APPLICABLE (approved) after MET             | Status becomes NOT_APPLICABLE. The obligation gets `effective_to = now`. Links remain for history and are not withdrawn                                                                                                                                                                                         |
| E7  | Flips back NOT_APPLICABLE → APPLICABLE                                           | The same obligation row is reactivated (same unique key). Status is computed fresh. Links that still qualify count immediately                                                                                                                                                                                  |
| E8  | Control retired that held the only mandatory ER                                  | `NO_CONTROL_MAPPED` / NOT_MET. If previously MET, AT_RISK                                                                                                                                                                                                                                                       |
| E9  | Tenant adopts a corpus manifest with a new revision of requirement R             | New obligation for R′. The old one is retired with `effective_to`. If the old one was MET, the new one starts **AT_RISK** with `REQUIREMENT_VERSION_CHANGED` (the practice existed; re-confirmation is due). A carry-forward command proposes links from the old ERs to matching new ERs, and these need review |
| E10 | Two workers recompute the same obligation                                        | Row lock plus `basis_digest` comparison: one writes, the other no-ops                                                                                                                                                                                                                                           |
| E11 | Fact recorded with `valid_from` in the future                                    | Not in the snapshot until then. `next_evaluation_at` covers that moment                                                                                                                                                                                                                                         |
| E12 | Dependency target requirement retired from the corpus                            | Corpus publication must remove the dependency edge in the same manifest. If missed, it gives `DEPENDENCY_NOT_ADOPTED` and A is capped. That is visible, not silent                                                                                                                                              |
| E13 | Tenant suspended (`platform.tenants.state = 'SUSPENDED'`)                        | Worker skips the tenant. No status changes while suspended. On resume, mark all obligations dirty                                                                                                                                                                                                               |
| E14 | Evidence contains personal data and an erasure request arrives, while under hold | Hold wins. Escalate to DPO and Legal. Never auto-resolved                                                                                                                                                                                                                                                       |
| E15 | `at_risk_grace_days` changed by the tenant                                       | Applies to new AT_RISK entries only. Existing `at_risk_until` values are not rewritten (no retroactive surprise)                                                                                                                                                                                                |

---

## 7. Open design questions

| #   | Question                                                                                                                                                      | Proposed default                                                                                                                                                                    | Owner              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Q1  | Confirm DPDP semantics: SDF criteria (s.10), family → category map (§1.4), clause numbering convention                                                        | Treat the prompt's SDF example as SYNTH. Production uses `sdf.notified`. Nothing legal-labelled is published before OPEN-01                                                         | Legal              |
| Q2  | `data.categories` / `org.industry` taxonomy. DPDP defines no "special category" set                                                                           | Tenant-neutral platform taxonomy stored in `fact_definitions.enum_values`, explicitly non-legal                                                                                     | Compliance + Legal |
| Q3  | AT_RISK grace default and auto-demotion                                                                                                                       | 30 days, auto-demote to raw after the deadline, `last_met_at` kept                                                                                                                  | Product            |
| Q4  | Must MET require a PASS control test?                                                                                                                         | 0.1: no (absence of FAIL is enough). 0.5: require PASS within the test schedule                                                                                                     | Compliance         |
| Q5  | "Alternative controls" (OR across controls for one obligation)                                                                                                | Not in v1 (AND only). If needed, add `obligation_control_groups` with explicit reviewed alternatives                                                                                | Compliance         |
| Q6  | Should automated APPLICABLE decisions also need approval?                                                                                                     | No (conservative direction). Revisit if DPOs need sign-off for the bid                                                                                                              | DPO / Legal        |
| Q7  | Object Lock mode GOVERNANCE vs COMPLIANCE; retention durations                                                                                                | GOVERNANCE + DB-driven retain_until. Durations blocked on OPEN-04                                                                                                                   | Security + Legal   |
| Q8  | Per-tenant encryption keys for evidence                                                                                                                       | Store `key_ref` now. Provider blocked on ADR-018 / OPEN-02                                                                                                                          | Security           |
| Q9  | `evidence.evidence_holds` vs LIFECYCLE-001 `legal_holds`                                                                                                      | Interim table now. LIFECYCLE-001 makes `legal_holds` authoritative and projects holds onto evidence                                                                                 | Architecture       |
| Q10 | Migration ledger is inconsistent: 0001/0006 write `platform.schema_migrations`, 0002/0004/0009 write `audit.schema_migrations`                                | 0011–0013 use `platform.schema_migrations`. Raise a separate cleanup ADR                                                                                                            | Platform           |
| Q11 | BUILD_PLAN order is ATOMIC-002 → ATOMIC-003 → COMPLIANCE-001 (`control_implementations`) → COMPLIANCE-002. `control_implementations` has no slot in 0011–0013 | Either renumber (0012 = implementations, 0013 = evidence, 0014 = status) or add a nullable `control_implementation_id` to `evidence_links` later. **Decide before 0012 is written** | Architecture       |
| Q12 | `packages/compliance-engine` vs the existing `packages/domain/compliance` (BUILD_PLAN names the latter)                                                       | Keep the engine as a separate pure package. domain/compliance keeps aggregate validation. Add both to `pnpm-workspace.yaml`                                                         | Architecture       |
| Q13 | Max evidence size                                                                                                                                             | 100 MiB per version. Multipart above that is deferred                                                                                                                               | Security / Product |
| Q14 | `has_any` is not in the AST allowlist in REGULATORY_INGESTION_SPEC ("membership" is in MODULE_BOUNDARIES)                                                     | Amend REGULATORY_INGESTION_SPEC to add `has_any` for `enum_set` facts                                                                                                               | Architecture       |
| Q15 | Are facts inherited from organisation to legal entity?                                                                                                        | No: facts are legal-entity-scoped only. UI may offer "copy to all entities"                                                                                                         | Product            |
| Q16 | Should "MET" appear anywhere user-facing?                                                                                                                     | No. Labels: Evidence complete / Partially evidenced / Not evidenced / Lapsing / Needs facts / Not applicable                                                                        | Product + Legal    |

---

## 8. Implementation order

1. **0011 + `applicability/*` + `dependencies/*`** (ATOMIC-002). Pure functions with full truth-table tests first, then the service and API.
2. **0012 + evidence ingest, scan and promotion** (COMPLIANCE-002/003), after Q11 is resolved. Storage contract tests against MinIO.
3. **`evidence/qualification.ts` + evidence_links commands.**
4. **0013 + `status/*` + worker drainer and sweeper.** Status tests before the dashboard (COMPLIANCE-006).

Each step stops at its acceptance criteria. Do not build the dashboard until the status transition tests pass.
