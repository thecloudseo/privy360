# OPEN-01: Legal DPDP Corpus Approval

**Deadline**: Before Session 1 implementation start

## Decisions Needed

### 1. SDF Definition (Critical)

**Issue**: Spec assumes employee count threshold; DPDP Act references Central Govt notification.

**Spec approach** (current, synthetic):

```typescript
is_sdf: org.employee_count >= 500 ||
  org.processes_special_category_data ||
  org.is_regulated_financial_entity;
```

**DPDP Act approach** (actual):

- Central Government notifies SDF status under Section 10(1)
- No statutory headcount threshold
- "Special category" data doesn't exist in DPDP (GDPR concept)

**Action**: Confirm correct SDF assessment method. Docs to review:

- `/Developer/Privy360-Next/docs/dpdp-act-research.md` (Section 10 analysis)
- `/Developer/Privy360-Next/docs/ARCHITECTURE-COMPLIANCE-ENGINE.md` (SDF section)

**Blocker Until**: Legal confirms correct SDF rules

---

### 2. DPDP Requirement Taxonomy (50+ requirements)

**Review**: `/Developer/Privy360-Next/docs/dpdp-act-research.md`

Verify all Section 4-10 requirements are:

- Accurate per DPDP Act 2023
- Complete (no missing obligations)
- Applicable to India-based orgs only (not GDPR/CCPA)

**Blocker Until**: Legal approves requirement list

---

### 3. Architecture Design

**Review**: `/Developer/Privy360-Next/docs/ARCHITECTURE-COMPLIANCE-ENGINE.md`

Confirm design handles:

- Consent state machine (Section 6)
- Processor agreements (Section 7)
- Breach notification (30-day deadline)
- Data subject rights (access, correction, erasure)
- DPO appointment & DPIA for SDF orgs

**Note**: Document includes 16 open questions (section 7). Recommend architecture + legal align before implementation.

---

## Sign-Off Required

- [ ] SDF definition confirmed (sync with engineering)
- [ ] Requirement taxonomy approved
- [ ] Architecture design approved
- [ ] No additional DPDP requirements identified

**Owner**: [Legal/Compliance Lead]  
**Target Completion**: [Date]
