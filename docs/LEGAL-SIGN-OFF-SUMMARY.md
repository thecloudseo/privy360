# OPEN-01: Legal Sign-Off Summary (Ready for Review)

**Prepared**: 2026-10-15 | **For**: Legal/Compliance Lead | **Purpose**: Session 1 implementation gate

---

## Three Decisions Needed

### 1. **SDF Classification Method** (CRITICAL)

**Current spec** (needs validation):

```
is_sdf = (employee_count >= 500)
      OR (processes_sensitive_category_data)
      OR (is_regulated_financial_entity)
```

**DPDP Act Section 10(1)** actual wording:

> Central Government, by notification, designates any data fiduciary as SDF based on specific criteria.

**Question for Legal**:

- Does the Central Govt notification already exist (as of 2026-10)?
- If yes: what are the actual SDF criteria?
- If no: should we use ITA 2000 "sensitive personal data" proxy + employee count heuristic?
- **RISK**: Wrong SDF classification → org misses stricter DPO, DPIA, and annual audit obligations

**Docs to review**:

- `/Developer/Privy360-Next/docs/dpdp-act-research.md` (Section 10 analysis, pg 45-50)
- `/Developer/Privy360-Next/docs/ARCHITECTURE-COMPLIANCE-ENGINE.md` (SDF section, pg 200+)

**Sign-off**: `[ ] Confirmed SDF criteria per latest Central Govt notification`

---

### 2. **DPDP Requirement Taxonomy** (50+ requirements)

**Mapped from**: Sections 4–10 of DPDP Act 2023 + Rules 2025

**Current coverage**:

- Section 4: Lawful grounds (4 reqs)
- Section 5: Notice requirements (8 reqs)
- Section 6: Consent management (9 reqs)
- Section 7: Legitimate uses (6 reqs)
- Section 8: General obligations (15 reqs)
- Section 9: Data subject rights (8 reqs)
- Section 10: SDF requirements (6 reqs)

**Review scope**:

- Are all requirements **accurate per the Act**?
- Are requirements **complete** (no missing obligations)?
- Are requirements **specific to DPDP** (not GDPR/CCPA concepts)?

**Docs to review**:

- `/Developer/Privy360-Next/docs/dpdp-act-research.md` (full taxonomy, 750 lines)

**Sign-off**: `[ ] DPDP requirement taxonomy approved (Sections 4-10 complete & accurate)`

---

### 3. **Architecture Design** (16 open questions)

**Current design**:

- Compliance state machine (requirements → applicability → status transitions)
- Evidence lifecycle (upload → scan → approve → expire)
- Processor agreement tracking
- Data subject rights workflows (access, correction, erasure)
- 30-day breach notification deadline enforcement

**Review scope**:

- Are design patterns **aligned with DPDP obligations**?
- Do workflows **meet timing deadlines** (30-day breach, November 2026 consent manager)?
- Does architecture **handle SDF-specific rules** (DPO, DPIA, annual audit)?

**16 open questions** (see `/Developer/Privy360-Next/docs/ARCHITECTURE-COMPLIANCE-ENGINE.md` section 7):

- Q1: Where does `control_implementations` table live? (migration 0011/0012)
- Q2: Use `platform.schema_migrations` or `audit.schema_migrations`?
- Q3: Need "has any of" rule operator for multi-value facts?
- [13 more — see full doc]

**Docs to review**:

- `/Developer/Privy360-Next/docs/ARCHITECTURE-COMPLIANCE-ENGINE.md` (comprehensive design, 81KB)

**Sign-off**: `[ ] Architecture design approved; 16 open questions resolved or deferred`

---

## Timeline & Next Steps

| Step                        | Owner               | Duration  | Blocker Until           |
| --------------------------- | ------------------- | --------- | ----------------------- |
| 1. Review 3 docs            | Legal/Compliance    | 2-5 days  | Approval received       |
| 2. Sync on SDF + Q1-Q16     | Engineering + Legal | 1-2 hours | Architecture locked     |
| 3. Session 1 Implementation | Engineering (Haiku) | 2-3 days  | All sign-offs confirmed |

---

## Session 1 Cannot Start Until All Checked ✅

- [ ] SDF definition confirmed
- [ ] Requirement taxonomy approved
- [ ] Architecture design approved (or all 16 Q's resolved)

**Once approved**: `/Developer/Privy360-Next/docs/DPDP-LEGAL-APPROVED.md` created as immutable record.

---

**Questions?** Contact engineering lead. Docs are in `/Developer/Privy360-Next/docs/`.
