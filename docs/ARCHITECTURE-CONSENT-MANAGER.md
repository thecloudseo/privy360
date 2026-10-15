# Consent Manager Architecture

**Session 3 | DPDP Compliance Platform | October 2026**

---

## Executive Summary

The Consent Manager is the core system for tracking and validating lawful grounds for personal data processing under the DPDP Act Section 6. It manages consent records (who consented to what, when, and with what proof), evaluates whether processing is lawful under alternative legal bases (Section 7), and provides immutable audit trails for regulatory defense.

**Key design decisions:**

- **State machine**: Consent lifecycle (GRANTED → ACTIVE → WITHDRAWN → ARCHIVED) with immutable transitions
- **Legal basis evaluation**: Three-valued logic (CONSENTED, REFUSED, UNKNOWN) mapping to Section 7 legitimate uses
- **Proof storage**: MinIO Object Lock with versioning and HMAC signatures for tamper detection
- **Audit trail**: Append-only event ledger (cannot delete historical records, only mark withdrawn)
- **RLS isolation**: All records filtered by `TrustedTenantContext`; no app-level consent leakage
- **Integration**: Feeds compliance engine (Section 6 obligation status), linked to data inventory (processing activities), consumed by privacy centre (withdrawal, access requests)

**Applicability:** All DPDP-covered organizations must implement; SDFs (Significant Data Fiduciaries) face enhanced audit requirements and 3-year retention.

**Compliance scope:** DPDP Sections 6 (consent attributes), 7 (legitimate uses), 8 (general obligations), 11-14 (data subject rights).

---

## 1. System Overview

### 1.1 Conceptual Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Consent Manager System                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Data Subject Interface (Privacy Centre)                     │  │
│  │  • Withdraw consent                                         │  │
│  │  • View consent history                                    │  │
│  │  • Download consent proof                                 │  │
│  │  • Request data access (linked to withdrawal)            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Consent API (NestJS app/api/src/consent/)                 │  │
│  │  • POST /consent → Record consent grant                   │  │
│  │  • GET /consent/history → Consent timeline               │  │
│  │  • POST /consent/withdrawal → Initiate withdrawal        │  │
│  │  • GET /consent/{id}/proof → Retrieve signed proof      │  │
│  │  • POST /legal-basis/evaluate → Check if processing OK  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                ↓                              ↓                     │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐   │
│  │ Consent Manager Package │  │  Legal Basis Evaluator      │   │
│  │ (TypeScript, zero IO)   │  │  (TypeScript, pure logic)   │   │
│  │                         │  │                             │   │
│  │ • Consent state machine │  │ • Employment relationship    │   │
│  │ • Proof generation      │  │ • Legal obligation         │   │
│  │ • Audit trail building  │  │ • Public task              │   │
│  │ • Withdrawal logic      │  │ • Contract necessity       │   │
│  └─────────────────────────┘  │ • Vital interest           │   │
│                                │ • Cybersecurity            │   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Postgres Database (RLS-enabled)                           │  │
│  │  • consent_records                                         │  │
│  │  • consent_proof (MinIO object references)               │  │
│  │  • legal_basis_evaluation                                │  │
│  │  • consent_withdrawal_request                           │  │
│  │  • consent_audit_trail (append-only events)            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              ↓                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  MinIO Object Storage                                        │  │
│  │  • Consent proof documents (PDF, recorded audio, forms)      │  │
│  │  • Object Lock enabled (WORM—Write Once, Read Many)         │  │
│  │  • Versioning enabled for tamper detection               │  │
│  │  • Expiry policy (7-year retention minimum per Rules)    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Integration Points                                          │  │
│  │  ← Compliance Engine: Feeds Section 6 status               │  │
│  │  ← Data Inventory: Linked processing activities           │  │
│  │  ← Risk Engine: Flags processing without valid consent    │  │
│  │  ← Audit Workflows: Triggers consent verification tasks   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow: Consent Grant

```
1. Data Principal interacts with consent UI
   (form, checkbox, click-to-agree, recorded audio)
   ↓
2. Privacy Centre captures:
   - Timestamp (UTC, server-side)
   - Method (UI_FORM, CHECKBOX, RECORDED_AUDIO, DIGITAL_SIGNATURE)
   - Device fingerprint (IP, user-agent, session ID)
   - Consent to: [purpose_id_1, purpose_id_2, ...]
   - Consent linked to Notice: [notice_id]
   ↓
3. POST /consent endpoint:
   - Validates notice exists and is current
   - Creates consent_record (status = GRANTED)
   - Generates HMAC signature of consent data
   - Stores proof document in MinIO (with Object Lock)
   - Writes event to consent_audit_trail
   ↓
4. Response: consent_id, proof_url, audit_event_id
   ↓
5. Compliance Engine notified:
   - Updates Section 6 obligation status
   - Linked purposes now satisfy "CONSENTED" basis
   ↓
6. Data Subject can access consent in Privacy Centre
   - View timestamp, method, proof
   - Download PDF/document proof
   - Withdraw if desired
```

### 1.3 Data Flow: Consent Withdrawal

```
1. Data Principal initiates withdrawal
   (via Privacy Centre "Withdraw Consent" button)
   ↓
2. POST /consent/{consent_id}/withdrawal:
   - Checks consent_record status (must be GRANTED or ACTIVE)
   - Creates consent_withdrawal_request record
   - Marks original consent_record.status = WITHDRAWN
   - Writes audit event (WITHDRAWAL_INITIATED)
   ↓
3. Background workflow (Temporal):
   - Notifies compliance engine: processing stops for withdrawn purposes
   - Triggers data erasure workflows (Section 8(7))
   - Records erasure proof in audit trail
   ↓
4. Compliance Engine:
   - Updates Section 6 status: processing now UNLAWFUL if no alternative basis
   - Escalates to Risk Engine if processing occurs without legal basis
   ↓
5. Data Subject receives confirmation
   - Timestamp of withdrawal
   - Notice period (if applicable)
   - What data will be deleted
```

### 1.4 Data Flow: Legal Basis Evaluation

```
1. API receives request to process data for purpose X
   (from app/api/compliance endpoint)
   ↓
2. Legal Basis Evaluator checks in order:
   a. Does data principal have ACTIVE consent?
      → YES: return CONSENTED
   b. Does Section 7 legitimate use apply?
      - Employment relationship?
      - Legal obligation?
      - Public task?
      - Medical/vital interest?
      - Cybersecurity?
      - Voluntary provision?
      → YES: return LEGITIMATE_USE (with type)
   c. Is basis "reasonable expectation" (publicly available)?
      → YES: return PUBLIC_EXPECTATION
   ↓
3. Return result with:
   - basis_type: CONSENTED | LEGITIMATE_USE | PUBLIC_EXPECTATION | REFUSED
   - confidence: HIGH | MEDIUM | LOW
   - rationale: human-readable explanation
   - audit_event_id: for regulatory defense
   ↓
4. Compliance Engine logs evaluation
   - If REFUSED → escalate to Risk Engine
   - If LEGITIMATE_USE → document basis for audit
```

---

## 2. Consent State Machine

### 2.1 States and Transitions

```
                      ┌─────────────┐
                      │   INITIAL   │
                      │ (no record) │
                      └──────┬──────┘
                             │
                      [Consent granted]
                             │
                             ↓
                      ┌─────────────┐
                      │  GRANTED    │ ← Consent record created
                      └──────┬──────┘
                             │
                 ┌───────────┴──────────┬──────────────┐
                 │                      │              │
          [Accepted by]     [Withdrawn]     [Expired]
        data principal       (anytime)    (e.g., 2yrs)
                 │                      │              │
                 ↓                      ↓              ↓
          ┌─────────────┐        ┌─────────────┐  ┌─────────────┐
          │   ACTIVE    │        │ WITHDRAWN   │  │  EXPIRED    │
          │ (lawful)    │        │ (no proof)  │  │ (stale)     │
          └──────┬──────┘        └──────┬──────┘  └──────┬──────┘
                 │                      │              │
          [Inactivity 2yr]          [Retention 7yr]  [Retention 7yr]
                 │                      │              │
                 ↓                      ↓              ↓
          ┌─────────────┐        ┌─────────────┐  ┌─────────────┐
          │   ARCHIVED  │        │  ARCHIVED   │  │  ARCHIVED   │
          │ (historical │        │ (historical │  │ (historical │
          │  record)    │        │  record)    │  │  record)    │
          └─────────────┘        └─────────────┘  └─────────────┘
```

### 2.2 State Semantics

| State         | Meaning                                       | Data Processing Allowed | Duration                                  | Next State           |
| ------------- | --------------------------------------------- | ----------------------- | ----------------------------------------- | -------------------- |
| **GRANTED**   | Consent recorded; awaiting acknowledgment     | No (provisional)        | < 1 hour                                  | ACTIVE or WITHDRAWN  |
| **ACTIVE**    | Data principal confirmed; lawful basis exists | **Yes**                 | Until withdrawn or 2 years (configurable) | WITHDRAWN or EXPIRED |
| **WITHDRAWN** | Data principal revoked consent                | No (erasure triggered)  | 7 years (retention/audit)                 | ARCHIVED             |
| **EXPIRED**   | Deemed purpose fulfilled (inactivity 2 years) | No (auto-erasure)       | 7 years (audit trail)                     | ARCHIVED             |
| **ARCHIVED**  | Historical record (audit trail only)          | No                      | Indefinite (legal hold)                   | —                    |

### 2.3 Consent Lifecycle: Full Timeline Example

```
Oct 1, 2026 10:00 UTC   → GRANTED
  Consent record created; proof document stored in MinIO
  Data Principal sees "Confirm consent" in Privacy Centre

Oct 1, 2026 10:05 UTC   → ACTIVE
  Data Principal clicks "Confirm" in email/UI
  audit_trail: CONFIRMATION_RECEIVED
  compliance_engine: Section 6 SATISFIED for purpose

Oct 1, 2027 23:59 UTC   → EXPIRED (1-year inactivity cutoff)
  Data Principal has not logged in for 1 year
  Automated task: marks EXPIRED, triggers erasure request
  audit_trail: INACTIVITY_EXPIRATION
  Compliance Engine notified

Oct 2, 2027 10:00 UTC   → ARCHIVED
  Erasure completed; proof of deletion logged
  Record retained for audit trail (non-compliance defense)
  If regulator audits: "Show me proof consent was obtained → ✓ ARCHIVED record shows it was."
```

### 2.4 Withdrawal Scenario

```
Oct 1, 2026 10:00 UTC   → GRANTED, then ACTIVE
  (as above)

Jan 15, 2027 14:30 UTC  → WITHDRAWN
  Data Principal clicks "Withdraw Consent" in Privacy Centre
  POST /consent/{id}/withdrawal
  audit_trail: WITHDRAWAL_INITIATED
  Compliance Engine: processing for this purpose is now UNLAWFUL
  Temporal workflow starts: delete data

Jan 16, 2027 10:00 UTC  → ARCHIVED
  Erasure proof collected; withdrawal finalized
  audit_trail: WITHDRAWAL_COMPLETED
  Record remains for audit (proof of timely withdrawal processing)
```

---

## 3. Legal Basis Evaluator

The Legal Basis Evaluator determines whether processing is lawful, implementing DPDP Section 4 (lawful grounds) and Section 7 (legitimate uses).

### 3.1 Decision Tree

```
Input: purpose_id, data_principal_id, context (employment, geography, etc.)

┌─────────────────────────────────────────────────────────┐
│ 1. Does active CONSENT exist for this purpose?          │
│    Query: consent_records where                         │
│      data_principal_id = ? AND                         │
│      purposes @> [purpose_id] AND                      │
│      status = 'ACTIVE'                                 │
│                                                        │
│    IF found → return CONSENTED (HIGH confidence)       │
│    IF not found → continue to 2                        │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Is this EMPLOYMENT context?                         │
│    Check: org has employment relationship with DP?    │
│            processing is necessary for contract?      │
│                                                        │
│    IF yes → return EMPLOYMENT (Section 7.2) (HIGH)   │
│    IF no → continue to 3                              │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Is this a LEGAL OBLIGATION?                         │
│    Check: applicable law requires processing?         │
│            e.g., tax filing, court order, RBI audit  │
│                                                        │
│    IF yes → return LEGAL_OBLIGATION (Section 7.4) (HIGH) │
│    IF no → continue to 4                              │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Is this MEDICAL or VITAL INTEREST?                 │
│    Check: registered provider? Emergency?             │
│            health/safety at risk?                     │
│                                                        │
│    IF yes → return MEDICAL/VITAL (Section 7.5) (HIGH) │
│    IF no → continue to 5                              │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Is this CYBERSECURITY/FRAUD mitigation?             │
│    Check: threat detection? Fraud prevention?         │
│            limited to necessary scope?                │
│                                                        │
│    IF yes → return CYBERSECURITY (Section 7.6) (MED)  │
│    IF no → continue to 6                              │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Is data PUBLICLY AVAILABLE or DP-published?         │
│    Check: data sourced from public directory?         │
│            DP posted on social media?                 │
│            "reasonable expectation" test             │
│                                                        │
│    IF yes → return PUBLIC_EXPECTATION (Section 7.7) (MED) │
│    IF no → continue to 7                              │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Is data for VOLUNTARY PROVISION (Section 7.1)?      │
│    Check: DP initiated contact/application?           │
│            processing limited to stated purpose?      │
│                                                        │
│    IF yes → return VOLUNTARY_PROVISION (Section 7.1) (MED) │
│    IF no → continue to 8                              │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 8. Is this a PUBLIC TASK (government)?                 │
│    Check: government agency? Public function?         │
│            citizen/public task requirement?           │
│                                                        │
│    IF yes → return PUBLIC_TASK (Section 7 implied) (MED) │
│    IF no → 9 (REFUSED)                                │
└─────────────────────────────────────────────────────────┘
                      ↓
           ┌──────────────────────────────┐
           │ No lawful basis found        │
           │ Return REFUSED (LOW conf)    │
           │ Escalate to Risk Engine      │
           └──────────────────────────────┘
```

### 3.2 Evaluation Result Schema

```typescript
interface LegalBasisEvaluationResult {
  basis_type:
    | "CONSENTED"
    | "EMPLOYMENT"
    | "LEGAL_OBLIGATION"
    | "MEDICAL"
    | "CYBERSECURITY"
    | "PUBLIC_EXPECTATION"
    | "VOLUNTARY_PROVISION"
    | "PUBLIC_TASK"
    | "REFUSED";

  is_lawful: boolean; // true if basis_type !== 'REFUSED'

  confidence: "HIGH" | "MEDIUM" | "LOW";

  rationale: string; // e.g., "Active consent found (granted 2026-10-01, expires 2027-10-01)"

  consent_record_id?: string; // if basis_type = 'CONSENTED'

  legal_basis_id?: string; // if basis_type in [EMPLOYMENT, LEGAL_OBLIGATION, ...]

  audit_event_id: string; // for regulatory defense

  evaluated_at: ISO8601;

  requires_notice: boolean; // Section 5: always true

  requires_review_interval?: string; // e.g., "EMPLOYMENT" requires annual review
}
```

### 3.3 Confidence Levels and Actions

| Confidence | When                                                  | Action                                                                    |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| **HIGH**   | Consent exists (ACTIVE) or statutory obligation clear | Record evaluation; allow processing                                       |
| **MEDIUM** | Legitimate use plausible (cybersecurity, public data) | Record evaluation; flag for human review if sensitive data                |
| **LOW**    | Basis weak or multiple interpretations possible       | Record evaluation; escalate to Risk Engine; do not process until reviewed |

---

## 4. Database Schema

### 4.1 Core Tables

#### Table: `consent_records`

Captures each consent grant, with immutable state tracking.

```sql
CREATE TABLE consent_records (
  -- Identity
  consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id), -- RLS

  -- Data Principal
  data_principal_id UUID NOT NULL, -- DP's internal ID in org
  data_principal_email EMAIL, -- secondary index for retrieval

  -- Consent Details
  purposes TEXT[] NOT NULL, -- [purpose_id_1, purpose_id_2, ...]
  notice_id UUID NOT NULL REFERENCES notices(id),

  -- Status and Lifecycle
  status TEXT NOT NULL DEFAULT 'GRANTED'
    CHECK (status IN ('GRANTED', 'ACTIVE', 'WITHDRAWN', 'EXPIRED', 'ARCHIVED')),

  -- Timestamp Tracking (Rule 5: timestamp required for consent proof)
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP WITH TIME ZONE,
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,

  -- Consent Method (Rule 5)
  consent_method TEXT NOT NULL
    CHECK (consent_method IN (
      'UI_FORM',           -- HTML form submission
      'CHECKBOX',          -- Checkbox + button click
      'RECORDED_AUDIO',    -- Audio recording (voice consent)
      'DIGITAL_SIGNATURE', -- E-signature (esign)
      'CLICK_TO_AGREE',    -- Single-action consent (minimized)
      'QR_CODE',           -- Scan QR, confirm
      'API_INTEGRATION',   -- Programmatic (app-to-app)
      'WRITTEN_DOCUMENT'   -- Physical letter, fax, email
    )),

  -- Device Fingerprint (Rule 5: evidence)
  ip_address INET,
  user_agent TEXT,
  device_fingerprint_hash TEXT, -- HMAC of device ID
  session_id TEXT,

  -- Proof Reference
  proof_id UUID REFERENCES consent_proof(proof_id) ON DELETE RESTRICT,
  proof_object_key TEXT, -- MinIO object key (for direct retrieval)
  proof_object_version TEXT, -- MinIO version ID

  -- Signature for Tamper Detection
  proof_signature_hmac TEXT, -- HMAC-SHA256 of proof content
  signature_algorithm TEXT DEFAULT 'HMAC-SHA256',

  -- Children's Data (Rule 5 special handling)
  is_child_data BOOLEAN DEFAULT FALSE,
  parental_consent_id UUID REFERENCES consent_records(consent_id), -- Parent's consent
  child_age_verified_at TIMESTAMP WITH TIME ZONE,

  -- Retention and Expiry (per Rules 7-year minimum)
  legal_hold_until TIMESTAMP WITH TIME ZONE, -- Do not delete until date

  -- Audit
  created_by TEXT, -- User/system that recorded consent
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete (archival)

  CONSTRAINT consent_valid_period CHECK (
    (status = 'GRANTED' AND activated_at IS NULL) OR
    (status = 'ACTIVE' AND activated_at IS NOT NULL) OR
    (status = 'WITHDRAWN' AND withdrawn_at IS NOT NULL) OR
    (status = 'EXPIRED' AND expired_at IS NOT NULL) OR
    (status = 'ARCHIVED')
  )
);

CREATE INDEX consent_records_org_id ON consent_records(org_id);
CREATE INDEX consent_records_data_principal_id ON consent_records(data_principal_id);
CREATE INDEX consent_records_data_principal_email ON consent_records(data_principal_email);
CREATE INDEX consent_records_status ON consent_records(status);
CREATE INDEX consent_records_notice_id ON consent_records(notice_id);
CREATE INDEX consent_records_purposes ON consent_records USING GIN(purposes);

-- RLS Policy
CREATE POLICY consent_records_org_isolation ON consent_records
  USING (org_id = current_setting('app.org_id')::uuid);
```

#### Table: `consent_proof`

Links consent records to proof documents stored in MinIO.

```sql
CREATE TABLE consent_proof (
  -- Identity
  proof_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES consent_records(consent_id) ON DELETE CASCADE,
  org_id UUID NOT NULL, -- Denormalized for RLS

  -- MinIO Object Reference
  object_key TEXT NOT NULL, -- s3://bucket/org/{org_id}/consent/{consent_id}/proof
  object_version TEXT, -- MinIO version ID (for WORM detection)
  object_size_bytes BIGINT,
  object_content_type TEXT, -- application/pdf, audio/mpeg, etc.

  -- Verification
  object_etag TEXT, -- MinIO ETag (hash)
  scan_status TEXT DEFAULT 'PENDING'
    CHECK (scan_status IN ('PENDING', 'SCANNED', 'CLEAN', 'FLAGGED', 'FAILED')),
  virus_scan_result TEXT, -- ClamAV result if scanned

  -- Expiry (Rule 7: 7-year retention minimum)
  expiry_date DATE, -- Calculated: granted_at + 7 years

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT one_proof_per_consent UNIQUE (consent_id)
);

CREATE INDEX consent_proof_org_id ON consent_proof(org_id);
CREATE INDEX consent_proof_expiry_date ON consent_proof(expiry_date);
```

#### Table: `legal_basis_evaluation`

Immutable record of each legal basis assessment (for audit defense).

```sql
CREATE TABLE legal_basis_evaluation (
  -- Identity
  eval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL, -- RLS

  -- What was evaluated
  data_principal_id UUID NOT NULL,
  purpose_id TEXT NOT NULL, -- Which processing purpose
  consent_record_id UUID REFERENCES consent_records(consent_id) ON DELETE SET NULL,

  -- Evaluation result
  legal_basis_type TEXT NOT NULL
    CHECK (legal_basis_type IN (
      'CONSENTED', 'EMPLOYMENT', 'LEGAL_OBLIGATION', 'MEDICAL',
      'CYBERSECURITY', 'PUBLIC_EXPECTATION', 'VOLUNTARY_PROVISION',
      'PUBLIC_TASK', 'REFUSED'
    )),

  is_lawful BOOLEAN NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  rationale TEXT NOT NULL, -- Human-readable explanation

  -- Additional Context
  processing_category TEXT, -- Data type being processed (SENSITIVE, GENERAL, etc.)
  jurisdiction TEXT, -- Country of data principal

  -- Audit
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  evaluated_by TEXT, -- System or user performing evaluation

  CONSTRAINT eval_linked_to_basis CHECK (
    (legal_basis_type = 'CONSENTED' AND consent_record_id IS NOT NULL) OR
    (legal_basis_type != 'CONSENTED')
  )
);

CREATE INDEX legal_basis_evaluation_org_id ON legal_basis_evaluation(org_id);
CREATE INDEX legal_basis_evaluation_data_principal_id ON legal_basis_evaluation(data_principal_id);
CREATE INDEX legal_basis_evaluation_purpose_id ON legal_basis_evaluation(purpose_id);
CREATE INDEX legal_basis_evaluation_is_lawful ON legal_basis_evaluation(is_lawful);
```

#### Table: `consent_withdrawal_request`

Tracks withdrawal initiation and completion (for SLA tracking).

```sql
CREATE TABLE consent_withdrawal_request (
  -- Identity
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,

  -- Withdrawal Details
  data_principal_id UUID NOT NULL,
  consent_id UUID NOT NULL REFERENCES consent_records(consent_id) ON DELETE CASCADE,

  -- Status
  status TEXT NOT NULL DEFAULT 'INITIATED'
    CHECK (status IN ('INITIATED', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'FAILED')),

  -- Timing
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  reason TEXT, -- Why withdrawal was requested
  contact_method TEXT, -- EMAIL, PHONE, IN_PERSON, API

  -- Temporal Workflow Reference
  temporal_workflow_id TEXT, -- Temporal workflow that processes erasure

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX consent_withdrawal_request_org_id ON consent_withdrawal_request(org_id);
CREATE INDEX consent_withdrawal_request_data_principal_id ON consent_withdrawal_request(data_principal_id);
CREATE INDEX consent_withdrawal_request_status ON consent_withdrawal_request(status);
```

#### Table: `consent_audit_trail` (Append-Only Event Log)

Immutable log of all consent events for regulatory defense.

```sql
CREATE TABLE consent_audit_trail (
  -- Event Identity
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL, -- RLS

  -- What happened
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'CONSENT_GRANTED',           -- Consent recorded
      'CONSENT_ACTIVATED',         -- DP confirmed consent
      'CONSENT_WITHDRAWAL_INITIATED', -- DP requested withdrawal
      'CONSENT_WITHDRAWAL_CONFIRMED', -- DP confirmed withdrawal
      'CONSENT_EXPIRED',           -- Auto-expiry due to inactivity
      'CONSENT_ARCHIVED',          -- Record archived (7yr retention)
      'PROOF_GENERATED',           -- Proof document created
      'PROOF_VERIFIED',            -- Proof integrity verified
      'PROOF_SIGNED',              -- HMAC signature created
      'LEGAL_BASIS_EVALUATED',     -- Basis check performed
      'WITHDRAWAL_DATA_DELETED',   -- Erasure completed
      'PARENTAL_CONSENT_VERIFIED', -- Child data consent validated
      'SDF_AUDIT_CONDUCTED'        -- SDF audit review
    )),

  -- Entity References
  consent_id UUID REFERENCES consent_records(consent_id) ON DELETE SET NULL,
  data_principal_id UUID,
  withdrawal_request_id UUID REFERENCES consent_withdrawal_request(request_id) ON DELETE SET NULL,
  legal_basis_eval_id UUID REFERENCES legal_basis_evaluation(eval_id) ON DELETE SET NULL,

  -- Event Details
  event_data JSONB, -- Event-specific payload
  -- e.g., CONSENT_GRANTED: {consent_method, purposes, proof_id}
  -- e.g., LEGAL_BASIS_EVALUATED: {basis_type, rationale, is_lawful}

  -- Context
  actor_type TEXT, -- SYSTEM, USER, DATA_PRINCIPAL, REGULATOR
  actor_id TEXT, -- User ID or system name
  ip_address INET,

  -- Timing
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Immutability
  CONSTRAINT audit_trail_immutable CHECK (event_id IS NOT NULL)
);

CREATE INDEX consent_audit_trail_org_id ON consent_audit_trail(org_id);
CREATE INDEX consent_audit_trail_event_type ON consent_audit_trail(event_type);
CREATE INDEX consent_audit_trail_consent_id ON consent_audit_trail(consent_id);
CREATE INDEX consent_audit_trail_event_timestamp ON consent_audit_trail(event_timestamp);

-- Prevent updates/deletes (enforced by application logic, but policy reinforces)
CREATE POLICY consent_audit_trail_immutable ON consent_audit_trail
  AS PERMISSIVE FOR DELETE
  USING (FALSE); -- Cannot delete, ever
```

### 4.2 Integration Tables (Foreign Keys to Other Modules)

#### Table: `notices`

(Referenced by `consent_records.notice_id` and `data_inventory.notice_id`)

Created in Session 2 (Data Inventory). Consent Manager consumes but does not create.

```sql
-- Defined in Session 2
-- Structure (for reference):
CREATE TABLE notices (
  notice_id UUID PRIMARY KEY,
  org_id UUID NOT NULL, -- RLS
  notice_version INT,
  content_html TEXT, -- Plain-language notice content
  created_at TIMESTAMP WITH TIME ZONE,
  effective_at TIMESTAMP WITH TIME ZONE,
  deprecated_at TIMESTAMP WITH TIME ZONE -- Null if current
);
```

#### Table: `purposes`

(Referenced by `consent_records.purposes` and legal basis evaluations)

Created in Session 1 (Compliance Engine). Structure:

```sql
CREATE TABLE purposes (
  purpose_id TEXT PRIMARY KEY, -- e.g., 'MARKETING', 'SERVICE_DELIVERY', 'FRAUD_DETECTION'
  org_id UUID NOT NULL,
  purpose_name TEXT NOT NULL,
  purpose_description TEXT,
  requires_consent BOOLEAN DEFAULT TRUE, -- false if Section 7 legitimate use covers it
  retention_days INT, -- How long data retained for this purpose
  sensitive_data BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE
);
```

### 4.3 Migration Script

```sql
-- Migration 0014: Consent Records Table
CREATE TABLE consent_records (
  -- [Full schema as above]
);
CREATE POLICY consent_records_org_isolation ON consent_records
  USING (org_id = current_setting('app.org_id')::uuid);
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- Migration 0015: Consent Proof & Audit Trail
CREATE TABLE consent_proof ( -- [schema above] );
CREATE TABLE legal_basis_evaluation ( -- [schema above] );
CREATE TABLE consent_withdrawal_request ( -- [schema above] );
CREATE TABLE consent_audit_trail ( -- [schema above] );

-- Enable RLS on all
ALTER TABLE consent_proof ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_basis_evaluation ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_withdrawal_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY consent_proof_org_isolation ON consent_proof
  USING (org_id = current_setting('app.org_id')::uuid);
CREATE POLICY legal_basis_evaluation_org_isolation ON legal_basis_evaluation
  USING (org_id = current_setting('app.org_id')::uuid);
CREATE POLICY consent_withdrawal_request_org_isolation ON consent_withdrawal_request
  USING (org_id = current_setting('app.org_id')::uuid);
CREATE POLICY consent_audit_trail_org_isolation ON consent_audit_trail
  USING (org_id = current_setting('app.org_id')::uuid);

-- Migration 0016: Indexes for Query Performance
CREATE INDEX consent_records_org_id ON consent_records(org_id);
CREATE INDEX consent_records_data_principal_id ON consent_records(data_principal_id);
CREATE INDEX consent_records_status ON consent_records(status);
CREATE INDEX consent_proof_expiry_date ON consent_proof(expiry_date);
CREATE INDEX legal_basis_evaluation_is_lawful ON legal_basis_evaluation(is_lawful);
```

---

## 5. Package Architecture

### 5.1 `packages/consent-manager/`

**Purpose**: Pure TypeScript consent logic—zero I/O, pure functions, testable in isolation.

**Files**:

```
packages/consent-manager/
├── src/
│   ├── index.ts                    # Barrel export
│   │
│   ├── domain/
│   │   ├── consent.ts              # Consent data model (TypeScript interfaces)
│   │   ├── legal-basis.ts          # Legal basis types & definitions
│   │   ├── consent-state-machine.ts # State transitions logic
│   │   └── proof.ts                # Proof generation logic
│   │
│   ├── consent-state-machine.ts    # Core state transitions
│   │   ├── canTransitionTo(state, newState) → boolean
│   │   ├── transitionConsent(state, event) → ConsentRecord
│   │   └── validateStateTransition(...)
│   │
│   ├── legal-basis-evaluator.ts    # Decision tree implementation
│   │   ├── evaluateLegalBasis(context) → EvaluationResult
│   │   ├── hasActiveConsent(...) → boolean
│   │   ├── isEmploymentContext(...) → boolean
│   │   ├── isLegalObligation(...) → boolean
│   │   ├── isMedicalVitalInterest(...) → boolean
│   │   ├── isCybersecurity(...) → boolean
│   │   └── [remaining checks]
│   │
│   ├── proof-builder.ts            # Construct proof payloads
│   │   ├── buildConsentProof(record) → ProofPayload
│   │   ├── hashProofContent(proof) → string (HMAC)
│   │   └── signProof(proof, key) → Signature
│   │
│   ├── audit-events.ts             # Event construction
│   │   ├── consentGrantedEvent(...)
│   │   ├── withdrawalInitiatedEvent(...)
│   │   └── [other event constructors]
│   │
│   └── errors.ts                   # Domain errors
│       ├── InvalidConsentStateError
│       ├── NoLawfulBasisError
│       └── ProofSignatureError
│
├── tests/
│   ├── consent-state-machine.test.ts
│   ├── legal-basis-evaluator.test.ts
│   ├── proof-builder.test.ts
│   └── audit-events.test.ts
│
└── package.json
```

**Key exports**:

```typescript
export { ConsentRecord, ConsentStatus, ConsentMethod } from "./domain/consent";
export { LegalBasisType, EvaluationResult } from "./domain/legal-basis";
export { ConsentStateMachine } from "./consent-state-machine";
export { LegalBasisEvaluator } from "./legal-basis-evaluator";
export { ProofBuilder } from "./proof-builder";
export { AuditEventBuilder } from "./audit-events";
```

**Rules**:

- No NestJS decorators (pure TS)
- No database calls (passed as params)
- No HTTP clients
- Immutable inputs (use `as const` and Readonly<T>)
- Full test coverage (100% path coverage for legal basis decision tree)

### 5.2 `apps/api/src/consent/`

**Purpose**: NestJS HTTP endpoints + database integration.

**Files**:

```
apps/api/src/consent/
├── consent.module.ts              # NestJS module registration
├── consent.controller.ts           # Endpoints
├── consent.service.ts              # Business logic (orchestration)
├── legal-basis.service.ts          # Evaluation + persistence
├── withdrawal.service.ts           # Withdrawal workflows
│
├── dto/
│   ├── create-consent.dto.ts       # POST /consent
│   ├── withdrawal-request.dto.ts   # POST /consent/{id}/withdrawal
│   └── legal-basis-query.dto.ts    # POST /legal-basis/evaluate
│
├── repositories/
│   ├── consent.repository.ts       # consent_records CRUD
│   ├── proof.repository.ts         # consent_proof CRUD
│   ├── legal-basis.repository.ts   # legal_basis_evaluation CRUD
│   ├── withdrawal.repository.ts    # consent_withdrawal_request CRUD
│   └── audit-trail.repository.ts   # consent_audit_trail APPEND
│
└── tests/
    ├── consent.controller.test.ts
    └── consent.service.test.ts
```

**Endpoints**:

- `POST /consent` — Record consent grant
- `GET /consent/{id}` — Retrieve consent record (with RLS filter)
- `GET /consent/data-principal/{id}/history` — List DP's consent timeline
- `POST /consent/{id}/withdrawal` — Initiate withdrawal
- `GET /consent/{id}/proof` — Download proof document URL
- `POST /legal-basis/evaluate` — Check if processing lawful
- `GET /legal-basis/evaluation/{id}` — Retrieve evaluation record

### 5.3 `apps/privacy-centre/`

**Purpose**: Data subject interface (withdrawal, consent history, proof download).

**Files**:

```
apps/privacy-centre/
├── pages/
│   ├── my-consent.tsx             # Consent timeline UI
│   ├── withdraw-consent.tsx       # Withdrawal flow
│   └── download-proof.tsx         # Proof document retrieval
│
└── hooks/
    └── useConsentManager.ts       # React hook wrapping API
```

**Flows**:

1. Data Principal sees list of active consents
2. Clicks "Withdraw" → confirmation dialog
3. API processes withdrawal → emails confirmation
4. Can download proof document (PDF or audio)

---

## 6. Evidence Handling

### 6.1 Proof Storage: MinIO Object Lock (WORM)

**Why Object Lock?** DPDP Rule 5 requires tamper-proof evidence. Object Lock prevents deletion or modification—perfect for regulatory defense.

**Configuration**:

```
Bucket: s3://privy360-consent-proofs/

Object structure:
  org/{org_id}/consent/{consent_id}/proof.{extension}

Object Lock settings:
  - Governance Mode (allows compliance officer override if needed)
  - Legal Hold: ON (until 7-year retention expires)
  - Retention Period: 7 years (per DPDP Rule 7 retention minimum)
  - Versioning: ENABLED (detect tamper attempts)
```

**Metadata stored per object**:

```json
{
  "consent_id": "uuid",
  "data_principal_id": "uuid",
  "consent_method": "UI_FORM",
  "granted_at": "2026-10-01T10:00:00Z",
  "proof_type": "application/pdf",
  "hmac_sha256": "0x1234...",
  "signature_algorithm": "HMAC-SHA256"
}
```

### 6.2 Proof Types by Consent Method

| Method                | Proof Type                      | Storage | Example                                                     |
| --------------------- | ------------------------------- | ------- | ----------------------------------------------------------- |
| **UI_FORM**           | PDF screenshot + form data JSON | MinIO   | Form submission timestamp, fields, IP                       |
| **CHECKBOX**          | PNG screenshot + checkbox state | MinIO   | Screenshot of checked box, timestamp                        |
| **RECORDED_AUDIO**    | MP3 + transcript                | MinIO   | Audio consent recording, transcript (processed by Temporal) |
| **DIGITAL_SIGNATURE** | XML + certificate               | MinIO   | PKIX signature, certificate chain                           |
| **CLICK_TO_AGREE**    | JSON event log                  | MinIO   | Click timestamp, coordinates, device fingerprint            |
| **QR_CODE**           | PDF + scan log                  | MinIO   | QR code content, scan timestamp, device                     |
| **API_INTEGRATION**   | JSON request/response           | MinIO   | API signature, timestamp, headers (sanitized)               |
| **WRITTEN_DOCUMENT**  | PDF scan + metadata             | MinIO   | Scan date, document type, attestation                       |

### 6.3 Proof Signature and Tamper Detection

**HMAC Generation**:

```typescript
// From proof-builder.ts
import crypto from "crypto";

function signProof(proof: ConsentProof): string {
  const payload = JSON.stringify(proof, null, 2); // Canonical JSON
  const key = process.env.CONSENT_PROOF_SIGNING_KEY; // Server secret

  const hmac = crypto.createHmac("sha256", key).update(payload).digest("hex");

  return hmac;
}
```

**Verification (on audit)**:

```typescript
function verifyProof(proof: ConsentProof, storedHmac: string): boolean {
  const computedHmac = signProof(proof);
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(computedHmac),
    Buffer.from(storedHmac),
  );
}
```

### 6.4 Expiry and Lifecycle

**Timeline**:

```
Oct 1, 2026   → Proof created in MinIO
              → HMAC signature stored in consent_proof.proof_signature_hmac
              → Object Lock retention set to Oct 1, 2033 (7 years)

Oct 1, 2033   → Object Lock expires
              → Lifecycle policy deletes object from MinIO
              → audit_trail record remains in Postgres (historical)
              → Consent record marked ARCHIVED
```

**Lifecycle Policy** (MinIO):

```json
{
  "Rules": [
    {
      "ID": "delete-expired-proofs",
      "Status": "Enabled",
      "Expiration": {
        "Days": 2555 // 7 years
      },
      "Filter": {
        "Prefix": "org/"
      }
    }
  ]
}
```

### 6.5 Scanning and Malware Detection

**ClamAV integration** (Temporal workflow):

```typescript
// Pseudocode: scan-proof-workflow.ts
async function scanProofWorkflow(consentId: string, objectKey: string) {
  // 1. Download from MinIO
  const proof = await minioClient.getObject(bucket, objectKey);

  // 2. Scan with ClamAV
  const result = await clamav.scan(proof);

  if (result.infected) {
    // Log in audit_trail: PROOF_FLAGGED
    await auditTrail.append({
      event_type: "PROOF_FLAGGED",
      event_data: { reason: "MALWARE_DETECTED", ...result },
    });

    // Alert compliance officer
    await slack.notify(`⚠️ Consent proof ${consentId} contains malware`);
  } else {
    // Update scan_status
    await proofRepository.updateScanStatus(consentId, "CLEAN");
  }
}
```

---

## 7. API Contracts

### 7.1 POST /consent — Record Consent Grant

**Request**:

```json
{
  "data_principal_id": "dp-uuid",
  "data_principal_email": "user@example.com",
  "purposes": ["MARKETING", "SERVICE_DELIVERY"],
  "notice_id": "notice-uuid",
  "consent_method": "UI_FORM",
  "proof": {
    "type": "form_submission",
    "form_data": {
      "checkbox_consents": true,
      "terms_accepted": true
    },
    "document_url": "s3://bucket/form-submission.pdf"
  },
  "device_context": {
    "ip_address": "203.0.113.42",
    "user_agent": "Mozilla/5.0...",
    "session_id": "sess-abc123"
  },
  "is_child_data": false,
  "parental_consent_id": null
}
```

**Response** (201 Created):

```json
{
  "consent_id": "consent-uuid",
  "org_id": "org-uuid",
  "status": "GRANTED",
  "purposes": ["MARKETING", "SERVICE_DELIVERY"],
  "consent_method": "UI_FORM",
  "granted_at": "2026-10-01T10:00:00Z",
  "proof_id": "proof-uuid",
  "proof_url": "s3://bucket/proof.pdf",
  "audit_event_id": "event-uuid",
  "next_action": "await_confirmation_email"
}
```

**Errors**:

- `400 Bad Request` — Missing required fields
- `404 Not Found` — Notice ID invalid
- `409 Conflict` — Active consent already exists for same purposes

### 7.2 GET /consent/{id} — Retrieve Consent Record

**Request**:

```
GET /consent/consent-uuid
Authorization: Bearer <token>
```

**Response**:

```json
{
  "consent_id": "consent-uuid",
  "status": "ACTIVE",
  "purposes": ["MARKETING"],
  "notice_id": "notice-uuid",
  "consent_method": "UI_FORM",
  "granted_at": "2026-10-01T10:00:00Z",
  "activated_at": "2026-10-01T10:05:00Z",
  "proof_id": "proof-uuid",
  "proof_object_key": "org/org-uuid/consent/consent-uuid/proof.pdf",
  "audit_events": [
    {
      "event_id": "event-1",
      "event_type": "CONSENT_GRANTED",
      "event_timestamp": "2026-10-01T10:00:00Z"
    },
    {
      "event_id": "event-2",
      "event_type": "CONSENT_ACTIVATED",
      "event_timestamp": "2026-10-01T10:05:00Z"
    }
  ]
}
```

### 7.3 GET /consent/data-principal/{id}/history — Consent Timeline

**Request**:

```
GET /consent/data-principal/dp-uuid/history?status=ACTIVE,WITHDRAWN&limit=20
Authorization: Bearer <token>
```

**Response**:

```json
{
  "data_principal_id": "dp-uuid",
  "total": 5,
  "consents": [
    {
      "consent_id": "consent-1",
      "purposes": ["MARKETING"],
      "status": "ACTIVE",
      "granted_at": "2026-10-01T10:00:00Z",
      "can_withdraw": true
    },
    {
      "consent_id": "consent-2",
      "purposes": ["ANALYTICS"],
      "status": "WITHDRAWN",
      "granted_at": "2026-08-15T14:00:00Z",
      "withdrawn_at": "2026-09-01T10:00:00Z",
      "can_withdraw": false
    }
  ],
  "pagination": { "offset": 0, "limit": 20 }
}
```

### 7.4 POST /consent/{id}/withdrawal — Initiate Withdrawal

**Request**:

```json
{
  "consent_id": "consent-uuid",
  "reason": "No longer comfortable with marketing emails",
  "contact_method": "EMAIL"
}
```

**Response** (202 Accepted):

```json
{
  "request_id": "withdraw-request-uuid",
  "consent_id": "consent-uuid",
  "status": "INITIATED",
  "requested_at": "2026-10-15T14:30:00Z",
  "expected_completion": "2026-10-16T14:30:00Z",
  "audit_event_id": "event-uuid",
  "temporal_workflow_id": "temporal-workflow-uuid"
}
```

**SLA**: Withdrawal processed within 24 hours (DPDP Rule 5: "as easy as giving consent").

### 7.5 GET /consent/{id}/proof — Download Proof Document

**Request**:

```
GET /consent/consent-uuid/proof
Authorization: Bearer <token>
```

**Response** (302 Redirect):

```
Location: s3://bucket/org/{org_id}/consent/{consent_id}/proof.pdf?signed=true&expires=3600
Content-Type: application/pdf
```

**Behavior**:

- Generates pre-signed MinIO URL (1-hour expiry)
- RLS-checked: only DP or org staff can access
- Logs access in audit_trail

### 7.6 POST /legal-basis/evaluate — Check Processing Lawfulness

**Request**:

```json
{
  "data_principal_id": "dp-uuid",
  "purpose_id": "MARKETING",
  "processing_context": {
    "data_type": "EMAIL",
    "sensitivity": "GENERAL",
    "jurisdiction": "IN",
    "employment_status": null,
    "legal_obligation_statute": null
  }
}
```

**Response**:

```json
{
  "eval_id": "eval-uuid",
  "data_principal_id": "dp-uuid",
  "purpose_id": "MARKETING",
  "legal_basis_type": "CONSENTED",
  "is_lawful": true,
  "confidence": "HIGH",
  "rationale": "Active consent exists (granted 2026-10-01, no withdrawal)",
  "consent_record_id": "consent-uuid",
  "requires_notice": true,
  "audit_event_id": "event-uuid",
  "evaluated_at": "2026-10-15T14:30:00Z"
}
```

**Alternative response** (REFUSED):

```json
{
  "eval_id": "eval-uuid",
  "legal_basis_type": "REFUSED",
  "is_lawful": false,
  "confidence": "HIGH",
  "rationale": "No active consent and no Section 7 legitimate use identified. Processing unauthorized.",
  "audit_event_id": "event-uuid",
  "evaluated_at": "2026-10-15T14:30:00Z"
}
```

### 7.7 GET /legal-basis/evaluation/{id} — Retrieve Evaluation Record

**Request**:

```
GET /legal-basis/evaluation/eval-uuid
Authorization: Bearer <token>
```

**Response**: Same as 7.6 response body (for audit trail).

---

## 8. Integration Points

### 8.1 Compliance Engine Integration

**Input to Compliance Engine**:

Consent Manager outputs **Section 6 obligation status** (requirement satisfied or not).

```typescript
// From compliance-engine service
async updateSection6Status(orgId: string, dataSubjectId: string) {
  // 1. Query Consent Manager: Does lawful basis exist?
  const evaluation = await consentManager.evaluateLegalBasis({
    data_principal_id: dataSubjectId,
    purpose_id: 'SERVICE_DELIVERY'
  });

  // 2. Update compliance_obligation record
  if (evaluation.is_lawful) {
    await complianceEngine.updateObligation({
      section: 'SECTION_6',
      status: 'SATISFIED',
      evidence_id: evaluation.eval_id
    });
  } else {
    await complianceEngine.updateObligation({
      section: 'SECTION_6',
      status: 'NOT_SATISFIED',
      gap_description: evaluation.rationale
    });
  }
}
```

### 8.2 Data Inventory Integration

**Input to Consent Manager** (from Data Inventory):

Data inventory identifies **processing activities and purposes**. Consent Manager tracks consent per purpose.

```typescript
// Data inventory table (from Session 2)
CREATE TABLE processing_activities (
  activity_id UUID,
  org_id UUID,
  purpose_id TEXT REFERENCES purposes(purpose_id),
  data_categories TEXT[],
  retention_days INT,
  requires_consent BOOLEAN
);

// Consent Manager uses this to validate:
// "Is consent required for this purpose?"
async function validateConsentRequirement(
  purposeId: string,
  orgId: string
): Promise<boolean> {
  const activity = await inventoryDb.findByPurpose(purposeId, orgId);
  return activity.requires_consent ?? true; // Default: require consent
}
```

### 8.3 Risk Engine Integration (Session 6)

**Input to Risk Engine**:

Consent Manager flags **processing without lawful basis**.

```typescript
// Post-withdrawal, if processing continues without basis
async function checkRiskOnWithdrawal(consentId: string, dataSubjectId: string) {
  // 1. Withdrawal processed
  const consent = await consentRepository.find(consentId);

  // 2. Check: Is processing still occurring for withdrawn purposes?
  const activeProcessing = await dataInventory.hasActiveProcessing(
    dataSubjectId,
    consent.purposes,
  );

  if (activeProcessing) {
    // 3. Escalate to Risk Engine
    await riskEngine.reportUnlawfulProcessing({
      data_subject_id: dataSubjectId,
      purpose_ids: consent.purposes,
      processing_status: "ACTIVE",
      severity: "CRITICAL",
    });
  }
}
```

### 8.4 Privacy Centre Integration

**Endpoints consumed by Privacy Centre**:

1. `GET /consent/data-principal/{id}/history` — Show DP's consents
2. `POST /consent/{id}/withdrawal` — DP withdraws consent
3. `GET /consent/{id}/proof` — Download proof document
4. WebSocket subscription to `withdrawal/{request_id}` — Real-time status updates

---

## 9. Open Questions (16 questions requiring decisions)

### Data & Proof

1. **Q1: Is MinIO Object Lock sufficient for tamper detection, or do we need HMAC + signatures?**
   - Current: HMAC-SHA256 + MinIO Object Lock versioning
   - Rationale: Defense-in-depth; HMAC detects document tampering; Object Lock prevents deletion
   - Alternative: Blockchain notarization (overkill, expensive)
   - **Decision needed**: Accept current approach or escalate to security review?

2. **Q2: Should we support consent proof in multiple formats (PDF, audio, video), or restrict to PDF + audio?**
   - Current: Support 8 consent methods (form, checkbox, recorded audio, digital signature, etc.)
   - Rationale: Regulatory flexibility; different orgs will prefer different methods
   - Concern: Maintenance burden of supporting video, biometric consent
   - **Decision needed**: Scope of consent methods for MVP launch?

3. **Q3: How do we handle children's data (minors under 18) parental consent verification?**
   - DPDP Rule 5 requires enhanced verification
   - Options:
     a. Parent email confirmation (simple, weak)
     b. Parental consent form + government ID upload (stronger)
     c. Third-party parental consent service integration (strongest, but cost)
   - **Decision needed**: Which approach aligns with target customer risk tolerance?

### Lifecycle & Timing

4. **Q4: Should consent withdrawal be immediate or staged (e.g., 30-day notice)?**
   - DPDP Section 6: withdrawal "as easy as giving consent"
   - Current: Immediate withdrawal (data deletion cascades)
   - Concern: Some orgs may want notice period for business continuity
   - **Decision needed**: Enforce immediate withdrawal, or allow org config?

5. **Q5: How long should consent be valid? Fixed period (1 year, 2 years) or org-configurable?**
   - Current: 2-year inactivity auto-expiry (Rule 11 deemed purpose fulfillment)
   - Concern: GDPR uses no fixed expiry; DPDP Rule 11 is unclear on intervals
   - **Decision needed**: Hardcode 2-year expiry, or allow org customization per purpose?

6. **Q6: When does "inactivity" auto-expire consent? Definition: no login, no data access, or no processing?**
   - Current: No login to Privacy Centre for 2 years → auto-expire
   - Concern: Privacy Centre access ≠ data processing; could be false positive
   - **Decision needed**: Track engagement with Privacy Centre, or sync with actual data use logs?

### Geographic & Multi-Jurisdiction

7. **Q7: How do we handle data principals in multiple jurisdictions (EU/US/India)?**
   - Some DPs may be in EU (GDPR consent stricter) or US
   - Current: Single consent model; no jurisdiction-specific logic
   - Options:
     a. Flag international DPs; apply stricter consent rules
     b. Tenant config: "Apply GDPR if DP in EU"
     c. Global consent applies to all jurisdictions
   - **Decision needed**: Scope for MVP (India-only, or multi-jurisdiction)?

8. **Q8: Should Consent Manager be org-specific, or support multi-tenant consent services (like OneTrust)?**
   - Current: Embedded in each org's Privy360 instance
   - Alternative: Separate consent manager service (DPDP Rule 4 compliant)
   - Implication: Significant architectural change if pursuing standalone service
   - **Decision needed**: Build embedded (simpler) or SaaS consent platform (more scalable)?

### Legal Basis Evaluation

9. **Q9: For Section 7.7 "reasonable expectation" (public data), what's the confidence threshold?**
   - Current: MEDIUM confidence (human review optional)
   - Concern: "Reasonable expectation" is vague; what makes data "public"?
   - Options:
     a. High confidence only if data appears in 3+ public sources
     b. Medium confidence if DP published themselves (LinkedIn, Twitter)
     c. Reject Section 7.7 as too vague; require explicit consent or legitimate use
   - **Decision needed**: Confidence level for public data processing?

10. **Q10: For Section 7.2 employment context, should we require explicit employment contract reference?**
    - Current: Check employment relationship exists; infer necessity
    - Concern: "Necessary for employment" is subjective; could be misused (e.g., salary history processing)
    - **Decision needed**: Require explicit purpose link in employment contract, or allow inferred necessity?

11. **Q11: For Section 7.6 cybersecurity, how do we define "necessary and proportionate" scope?**
    - Current: No scope limit; assumes fraud detection is proportionate
    - Concern: Could justify broad data access (e.g., facial recognition, location tracking)
    - **Decision needed**: Hard limit on data types (e.g., no biometric data for cybersecurity), or case-by-case review?

### Withdrawal & Erasure

12. **Q12: Should withdrawal trigger immediate data deletion, or staged deletion with audit hold?**
    - Current: Immediate deletion (wrapped in Temporal workflow)
    - Concern: What if DP withdraws, then requests data access 1 day later (wants to see what was deleted)?
    - Options:
      a. Immediate deletion; no recovery possible
      b. 30-day grace period; DP can cancel withdrawal
      c. Soft delete; keep encrypted copies for 90 days
    - **Decision needed**: Deletion strategy for compliance + customer support?

13. **Q13: Should we support "right to be forgotten" (GDPR-style), or only Section 8(7) erasure (DPDP)?**
    - DPDP: Erasure only when consent withdrawn OR purpose fulfilled
    - GDPR: Broader "right to be forgotten" (exception: lawful obligation)
    - Current: DPDP-only (no standalone right to be forgotten)
    - **Decision needed**: Add right to be forgotten as SDF feature, or strictly DPDP-compliant?

### Audit & Compliance

14. **Q14: Should audit trail be queryable by compliance officers, or read-only for regulators only?**
    - Current: Queryable by org compliance officers (with RLS)
    - Concern: Compliance officers might accidentally (or intentionally) misinterpret data
    - **Decision needed**: Expose audit trail in compliance dashboard, or restrict to DPB audits only?

15. **Q15: For SDFs, should we enforce annual consent audit (re-verify consents), or assume immutability?**
    - Current: Immutable audit trail; no re-verification
    - DPDP Section 10 (SDF): "Independent audit" but doesn't specify consent audit
    - **Decision needed**: Implement automated consent audit workflows for SDFs?

16. **Q16: Should Consent Manager integrate with external Consent Managers (DPDP Rule 4), or remain embedded?**
    - DPDP Rule 4: Organizations can use registered external consent managers
    - Current: Embedded in Privy360
    - Concern: If org uses external consent manager (e.g., OneTrust), do we import consent records, or operate separately?
    - **Decision needed**: Support import/sync from external consent managers, or scope to embedded only?

---

## 10. Implementation & Test Strategy

### 10.1 Unit Tests (packages/consent-manager/)

**Focus**: Pure logic, no database.

```typescript
// consent-state-machine.test.ts
describe("ConsentStateMachine", () => {
  describe("state transitions", () => {
    test("GRANTED → ACTIVE allowed", () => {
      const record = { status: "GRANTED", activated_at: null };
      expect(canTransitionTo(record, "ACTIVE")).toBe(true);
    });

    test("ACTIVE → WITHDRAWN allowed", () => {
      const record = { status: "ACTIVE", withdrawn_at: null };
      expect(canTransitionTo(record, "WITHDRAWN")).toBe(true);
    });

    test("WITHDRAWN → ACTIVE rejected", () => {
      const record = { status: "WITHDRAWN" };
      expect(canTransitionTo(record, "ACTIVE")).toBe(false);
    });

    test("ARCHIVED → any state rejected", () => {
      const record = { status: "ARCHIVED" };
      ["ACTIVE", "WITHDRAWN", "EXPIRED"].forEach((state) => {
        expect(canTransitionTo(record, state)).toBe(false);
      });
    });
  });
});

// legal-basis-evaluator.test.ts
describe("LegalBasisEvaluator", () => {
  describe("decision tree", () => {
    test("returns CONSENTED if active consent exists", () => {
      const context = {
        activeConsentFound: true,
        consentRecord: { status: "ACTIVE" },
      };
      const result = evaluateLegalBasis(context);
      expect(result.basis_type).toBe("CONSENTED");
      expect(result.is_lawful).toBe(true);
    });

    test("returns EMPLOYMENT if employment context verified", () => {
      const context = {
        activeConsentFound: false,
        employmentStatus: "ACTIVE",
        processingNecessary: true,
      };
      const result = evaluateLegalBasis(context);
      expect(result.basis_type).toBe("EMPLOYMENT");
      expect(result.confidence).toBe("HIGH");
    });

    test("returns REFUSED if no basis found", () => {
      const context = {
        activeConsentFound: false,
        employmentStatus: null,
        legalObligation: null,
        // ... all other bases false
      };
      const result = evaluateLegalBasis(context);
      expect(result.basis_type).toBe("REFUSED");
      expect(result.is_lawful).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("handles conflicting signals (e.g., employment + withdrawal)", () => {
      const context = {
        employmentStatus: "ACTIVE",
        consentWithdrawn: true,
      };
      const result = evaluateLegalBasis(context);
      // Employment context should still be valid (doesn't require consent)
      expect(result.basis_type).toContain("EMPLOYMENT");
    });
  });
});

// proof-builder.test.ts
describe("ProofBuilder", () => {
  test("generates HMAC signature correctly", () => {
    const proof = {
      consent_id: "uuid",
      method: "UI_FORM",
      timestamp: "2026-10-01T10:00:00Z",
    };
    const hmac = signProof(proof);
    expect(hmac).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
  });

  test("detects tampering via HMAC verification", () => {
    const proof = { consent_id: "uuid", method: "UI_FORM" };
    const originalHmac = signProof(proof);

    proof.method = "CHECKBOX"; // Tamper
    const tamperedHmac = signProof(proof);

    expect(originalHmac).not.toBe(tamperedHmac);
  });
});
```

**Coverage target**: 100% of legal basis decision tree paths.

### 10.2 Integration Tests (apps/api/src/consent/)

**Focus**: Database interactions, API endpoints, RLS.

```typescript
// consent.service.int.test.ts
describe('ConsentService (Integration)', () => {
  beforeEach(async () => {
    // Create test org, data principal
    testOrg = await orgRepository.create({ name: 'Test Org' });
    testDP = await dpRepository.create({ org_id: testOrg.id, email: 'test@example.com' });
  });

  test('creates consent record with proof', async () => {
    const result = await consentService.grantConsent({
      org_id: testOrg.id,
      data_principal_id: testDP.id,
      purposes: ['MARKETING'],
      notice_id: noticeId,
      consent_method: 'UI_FORM',
      proof: { /* ... */ }
    });

    expect(result.consent_id).toBeDefined();
    expect(result.status).toBe('GRANTED');

    // Verify proof stored
    const proof = await proofRepository.find(result.proof_id);
    expect(proof.object_key).toMatch(/s3:\/\/bucket\/org\//);
  });

  test('appends audit trail event', async () => {
    const result = await consentService.grantConsent({...});

    const events = await auditTrailRepository.findByConsentId(result.consent_id);
    expect(events).toContainEqual(
      expect.objectContaining({ event_type: 'CONSENT_GRANTED' })
    );
  });

  test('RLS: prevents cross-org consent access', async () => {
    const otherOrg = await orgRepository.create({ name: 'Other Org' });
    const otherDP = await dpRepository.create({ org_id: otherOrg.id });

    // Create consent in testOrg
    const consent = await consentService.grantConsent({
      org_id: testOrg.id,
      data_principal_id: testDP.id,
      purposes: ['MARKETING'],
      notice_id: noticeId,
      consent_method: 'UI_FORM',
      proof: {}
    });

    // Try to access from otherOrg context
    const ctx = { app: { org_id: otherOrg.id } };
    const found = await consentRepository.findWithContext(consent.consent_id, ctx);

    expect(found).toBeNull(); // RLS blocks access
  });

  test('withdrawal transitions state and triggers erasure', async () => {
    const consent = await consentService.grantConsent({...});
    await consentService.activateConsent(consent.consent_id);

    const withdrawal = await consentService.withdrawConsent({
      consent_id: consent.consent_id,
      reason: 'No longer interested'
    });

    expect(withdrawal.status).toBe('INITIATED');

    // Verify audit event
    const events = await auditTrailRepository.findByConsentId(consent.consent_id);
    expect(events).toContainEqual(
      expect.objectContaining({ event_type: 'CONSENT_WITHDRAWAL_INITIATED' })
    );
  });
});

// legal-basis.service.int.test.ts
describe('LegalBasisService (Integration)', () => {
  test('evaluates based on active consent', async () => {
    const consent = await consentService.grantConsent({...});
    await consentService.activateConsent(consent.consent_id);

    const result = await legalBasisService.evaluate({
      data_principal_id: testDP.id,
      purpose_id: 'MARKETING'
    });

    expect(result.basis_type).toBe('CONSENTED');
    expect(result.consent_record_id).toBe(consent.consent_id);
  });

  test('falls back to legitimate use if no consent', async () => {
    const result = await legalBasisService.evaluate({
      data_principal_id: testDP.id,
      purpose_id: 'PAYROLL', // Employment purpose
      context: { employment_status: 'ACTIVE' }
    });

    expect(result.basis_type).toBe('EMPLOYMENT');
    expect(result.is_lawful).toBe(true);
  });

  test('returns REFUSED if no basis', async () => {
    const result = await legalBasisService.evaluate({
      data_principal_id: testDP.id,
      purpose_id: 'MARKETING'
      // No consent, no employment, no other basis
    });

    expect(result.basis_type).toBe('REFUSED');
    expect(result.is_lawful).toBe(false);
  });
});
```

### 10.3 E2E Tests (Playwright)

**Focus**: Full user journeys (consent grant, withdrawal, proof download).

```typescript
// consent.e2e.test.ts
test.describe("Consent Manager E2E", () => {
  test("data principal grants and withdraws consent", async ({
    page,
    browser,
  }) => {
    // 1. Login to Privacy Centre
    await page.goto("/login");
    await page.fill('input[name="email"]', "test@example.com");
    await page.click('button:text("Sign In")');

    // 2. View consent dashboard
    await page.goto("/dashboard/consents");
    await expect(page.locator("text=My Consents")).toBeVisible();

    // 3. Initiate new consent flow
    await page.click('button:text("Give Consent")');
    await page.selectOption('select[name="purpose"]', "MARKETING");
    await page.check('input[name="accept_terms"]');
    await page.click('button:text("Confirm")');

    // 4. Verify consent appears in list
    await expect(page.locator("text=MARKETING")).toBeVisible();

    // 5. Download proof
    await page.click('button:text("Download Proof")');
    const downloadPath = await page.waitForEvent("popup");
    expect(downloadPath.url()).toContain("s3://");

    // 6. Withdraw consent
    await page.click('button:text("Withdraw")');
    await page.fill('textarea[name="reason"]', "No longer interested");
    await page.click('button:text("Confirm Withdrawal")');

    // 7. Verify status change
    await expect(page.locator("text=WITHDRAWN")).toBeVisible();

    // 8. Verify email confirmation received
    const emails = await emailService.getReceivedByTo("test@example.com");
    expect(emails).toContainEqual(
      expect.objectContaining({ subject: /Consent withdrawn/i }),
    );
  });
});
```

---

## 11. Applicability & Scope

### 11.1 Which Organizations Must Implement Consent Manager?

**Requirement**: Section 4 DPDP Act (Lawful grounds for processing)

All DPDP-covered organizations must comply. Specifically:

| Entity Type                                   | Implements Consent Manager | Reason                                                               |
| --------------------------------------------- | -------------------------- | -------------------------------------------------------------------- |
| **Any org collecting personal data in India** | YES                        | Section 4: lawful grounds required                                   |
| **Data Fiduciaries** (defined in Section 2)   | YES                        | Consent or legitimate use required                                   |
| **Significant Data Fiduciaries (SDF)**        | YES + enhanced             | Annual audit, DPIA, audit trail retention                            |
| **Data Processors**                           | Depends on contract        | If contract requires consent management; else Data Fiduciary handles |
| **Data Localization**                         | India-based data           | Section 5: certain data types must stay in India                     |

### 11.2 When Consent NOT Required (Section 7: Legitimate Uses)

Consent Manager must still evaluate, but consent can be waived if legitimate use applies:

| Scenario                     | Consent Required | Legitimate Use                            | Implementation                   |
| ---------------------------- | ---------------- | ----------------------------------------- | -------------------------------- |
| Employment contract          | No               | YES (Section 7.2)                         | Check employment relationship    |
| Tax filing                   | No               | YES (Section 7.4: Legal obligation)       | Check RBI/Income Tax requirement |
| Police investigation         | No               | YES (Section 7.4: Law enforcement)        | Check court order                |
| Medical emergency            | No               | YES (Section 7.5: Vital interest)         | Check vital interest criteria    |
| Public data (e.g., LinkedIn) | No               | YES (Section 7.7: Reasonable expectation) | Check public availability        |

**Implementation**: Legal basis evaluator checks all 8 bases before returning REFUSED.

---

## 12. Migration & Rollout Strategy

### 12.1 Rollout Phases

| Phase     | Timeline    | Scope                                                           | Actions                                                             |
| --------- | ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Alpha** | 6 weeks     | Internal testing + 2 pilot orgs                                 | Deploy migrations 0014-0016; test state machine + legal basis logic |
| **Beta**  | 8 weeks     | 10-20 mid-market orgs                                           | Gather feedback on UX, proof formats, withdrawal SLA                |
| **GA**    | 13 Nov 2026 | All orgs (compliance deadline for Consent Manager registration) | Full feature set; enhanced audit trails for SDFs                    |

### 12.2 Data Migration from Legacy Systems

**Assumptions**:

- Some orgs may have legacy consent records (spreadsheets, forms, external systems)
- Need one-time import, then ongoing tracking in Privy360

**Migration process**:

```
Legacy Data → Extract (CSV/API) → Normalize → Postgres (consent_records) + MinIO (proof)
```

**Validation**:

- Check consent_records have proof_id (no orphan records)
- Verify timestamps are valid and in correct timezone
- Test RLS isolation post-migration

---

## 13. Glossary & References

### 13.1 Key Terms

| Term                                 | Definition                                                                | DPDP Section |
| ------------------------------------ | ------------------------------------------------------------------------- | ------------ |
| **Data Principal**                   | Any individual whose personal data is processed                           | Section 2    |
| **Data Fiduciary**                   | Entity determining purpose and means of processing                        | Section 2    |
| **Consent**                          | Affirmative action by DP; must be free, specific, informed, unconditional | Section 6    |
| **Withdrawal**                       | DP revokes consent; must be as easy as grant                              | Section 6    |
| **Legitimate Use**                   | Processing without consent, if falls under Section 7 category             | Section 7    |
| **Significant Data Fiduciary (SDF)** | Fiduciary with enhanced obligations (DPO, DPIA, audit)                    | Section 10   |
| **Lawful Basis**                     | Either consent (Section 6) or legitimate use (Section 7)                  | Section 4    |
| **Personal Data**                    | Any information relating to DP; definition broad                          | Section 2    |
| **Processing**                       | Any operation on data (collection, use, deletion, etc.)                   | Section 2    |

### 13.2 References

**Primary Sources**:

- DPDP Act 2023: [https://dpdpact2023.com/](https://dpdpact2023.com/)
- DPDP Rules 2025: G.S.R. 843(E), 844(E), 846(E)
- Data Protection Board: [https://dpdp.ind.in/](https://dpdp.ind.in/)

**Related Architecture Documents**:

- Session 1: `/Developer/Privy360-Next/docs/ARCHITECTURE-COMPLIANCE-ENGINE.md`
- Session 2: `/Developer/Privy360-Next/docs/ARCHITECTURE-DATA-INVENTORY.md`
- Research: `/Developer/Privy360-Next/docs/dpdp-act-research.md`

---

## 14. Success Criteria & Metrics

### 14.1 Technical Success

| Metric                               | Target          | Owner       |
| ------------------------------------ | --------------- | ----------- |
| Unit test coverage (consent-manager) | 100%            | Engineering |
| E2E test coverage (consent flows)    | 80%+            | QA          |
| API response time (GET /consent)     | < 200ms p95     | Backend     |
| MinIO object lock uptime             | 99.9%+          | Ops         |
| RLS policy enforcement               | 100% (no leaks) | Security    |

### 14.2 Compliance Success

| Metric                                   | Target | Owner            |
| ---------------------------------------- | ------ | ---------------- |
| Consent state machine PASSED review      | 100%   | Legal/Compliance |
| Legal basis decision tree PASSED review  | 100%   | Legal/Compliance |
| Proof tamper-detection PASSED sec review | 100%   | Security         |
| Audit trail immutability verified        | 100%   | Audit            |

### 14.3 Customer Success

| Metric                               | Target | Owner        |
| ------------------------------------ | ------ | ------------ |
| Consent withdrawal SLA < 24h         | 100%   | Customer Ops |
| Proof document download success rate | 99%+   | Ops          |
| Privacy Centre withdrawal UX NPS     | > 8/10 | Product      |

---

## Appendix: Example Workflows

### A.1 Workflow: New Org Onboarding (Sets up Consent)

```
Day 1: Org Admin logs into Privy360
        ↓
        1. Creates "purposes" (MARKETING, SERVICE_DELIVERY, etc.)
        2. Uploads notice templates (HTML)
        3. Configures consent methods (form, email, etc.)
        4. Sets retention periods per purpose
        ↓
Day 2: Marketing team embeds consent form in website
        ↓
        User submits form → POST /consent
        ↓
        Consent recorded (GRANTED)
        Proof stored in MinIO
        Email sent: "Confirm your consent"
        ↓
Day 3: User clicks confirmation link
        ↓
        Consent state: GRANTED → ACTIVE
        Compliance Engine: Section 6 SATISFIED for user
        ↓
Day 4-365: User can view, download proof, or withdraw anytime
```

### A.2 Workflow: Withdrawal & Cascade

```
User clicks "Withdraw Consent" in Privacy Centre
        ↓
POST /consent/{id}/withdrawal
        ↓
1. Create withdrawal_request (status = INITIATED)
2. Mark consent_record.status = WITHDRAWN
3. Append audit event: CONSENT_WITHDRAWAL_INITIATED
        ↓
Temporal Workflow starts (background):
        ↓
4. Notify compliance engine: Processing UNLAWFUL for this purpose
5. Compliance engine escalates to Risk Engine
6. Risk Engine checks: Is data still being processed?
        ↓
7. If yes: Trigger data erasure (GDPR-style deletion cascade)
   - Delete from all systems
   - Collect proof of deletion
   - Log in audit_trail: WITHDRAWAL_DATA_DELETED
        ↓
8. If no: Mark withdrawal complete
9. Append audit event: CONSENT_WITHDRAWAL_COMPLETED
10. Email user: "Your consent has been withdrawn"
        ↓
User verifies in Privacy Centre: Consent status = WITHDRAWN
        ↓
(After 7 years) Consent archived, proof remains for audit
```

---

**Document Status**: Architecture complete; awaiting decisions on 16 open questions before implementation.

**Session Next**: Implementation of core state machine and legal basis evaluator (Haiku), followed by API integration tests (Haiku) and E2E workflows (QA).
