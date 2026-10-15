# DPDP Act 2023: Compliance Requirements Research

**Session 1 Research Document | October 2026**

## Executive Summary

The Digital Personal Data Protection (DPDP) Act, 2023 establishes India's primary privacy framework governing personal data processing. This document synthesizes compliance requirements from Sections 4–8 of the Act and supporting Rules (2025), organized for technical architecture and compliance engine design.

**Key timeline:**

- **13–14 November 2025**: Rules notified; Data Protection Board established
- **13 November 2026**: Consent Manager registration mandatory
- **14 May 2027**: Full enforcement of substantive obligations

---

## 1. Section 4: Lawful Grounds for Processing

### 1.1 Core Requirement

Personal data shall be processed only for a lawful purpose, and only on the basis of:

- **Consent** from the Data Principal, OR
- **Legitimate uses** specified in Section 7

### 1.2 Processing Definition

"Processing" includes collection, receipt, record, organization, structure, storage, adaptation, retrieval, use, erasure, or combination of personal data.

### 1.3 Lawful Purpose

- Must be pre-determined before processing begins
- Must be specified in the notice given to the Data Principal (Section 5)
- Cannot be repurposed for unrelated processing without fresh consent

### 1.4 Applicability Matrix

| Element                    | Applies To                | Exceptions                                             |
| -------------------------- | ------------------------- | ------------------------------------------------------ |
| Lawful purpose requirement | All Data Fiduciaries      | None specified in Act                                  |
| Consent basis              | Voluntary data submission | Section 7 legitimate uses (e.g., employment, benefits) |
| Legitimate uses            | Specific use cases        | Cannot override Section 8 general obligations          |

### 1.5 Compliance Architecture Impact

- Requires mapping of data flows to stated purposes
- Necessitates consent lifecycle management tied to purpose
- Mandates audit trail of purpose specifications

---

## 2. Section 5: Notice Requirement

### 2.1 Mandatory Disclosure Elements

A Data Fiduciary must provide clear notice containing:

1. **Identity of the Data Fiduciary** — name and contact details
2. **Personal data being collected** — list of categories and types
3. **Specified purpose(s)** — why data is being processed
4. **How to exercise rights** — mechanism for access, correction, erasure
5. **Grievance redressal details** — contact for complaints
6. **Withdrawal of consent** — how easily the Data Principal can withdraw

### 2.2 Notice Timing

- Must be provided **before or at the time of** data collection
- If collection is from third parties, notice must be provided within reasonable time afterward

### 2.3 Format and Presentation

- Rules specify notice structure (per Rule 3, DPDP Rules 2025)
- Must be in **clear, plain language** — not legalistic
- Separate notices required for different processing activities

### 2.4 Applicability Matrix

| Context                    | Notice Required        | Timing                | Special Rules                 |
| -------------------------- | ---------------------- | --------------------- | ----------------------------- |
| Direct collection          | Yes                    | Before collection     | Standard format               |
| Third-party collection     | Yes                    | Reasonable time after | May combine in privacy policy |
| Children's data            | Yes + parental consent | Before collection     | Age verification required     |
| Sensitive data             | Yes (enhanced)         | Before collection     | Purpose limitation stricter   |
| Significant Data Fiduciary | Yes + DPIA summary     | Before collection     | Rule 13 requirements          |

### 2.5 Compliance Architecture Impact

- Requires dynamic notice generation per data type
- Mandates consent UI/UX design specifications
- Necessitates multilingual notice templates (Hindi/English minimum)

---

## 3. Section 6: Consent Requirements

### 3.1 Valid Consent Attributes

Consent must be:

1. **Free** — no coercion, duress, or undue influence
2. **Specific** — given for a particular purpose, not blanket consent
3. **Informed** — based on adequate information (per Section 5 notice)
4. **Unconditional** — not tied to service access unless processing is necessary
5. **Unambiguous** — affirmative action by Data Principal

### 3.2 Withdrawal of Consent

- **Withdrawal mechanism** must be as easy as giving consent
- Data Principal can withdraw for any reason, at any time
- Upon withdrawal, Data Fiduciary must cease processing
- **Exception**: If erasure is not possible, acknowledge withdrawal for non-use

### 3.3 Consent Validity

- Valid consent cannot be presumed
- Silence, pre-ticked checkboxes, or passive acceptance is **NOT** valid
- Consent is processing-specific — cannot bundle unrelated purposes
- Withdrawal is immediate; processing must stop within reasonable time

### 3.4 Special Consent Rules

| Data Category             | Special Consent Rules                  | Duration                   |
| ------------------------- | -------------------------------------- | -------------------------- |
| Children (under 18)       | Parental/guardian consent required     | Until child reaches age 18 |
| Sensitive personal data   | Enhanced notice + explicit consent     | Per purpose                |
| Cross-border transfer     | Separate consent required              | For each jurisdiction      |
| Automated decision-making | Explicit consent + human review option | Ongoing                    |

### 3.5 Compliance Architecture Impact

- Requires consent state machine (given → active → withdrawn)
- Mandates consent record immutability and audit logs
- Necessitates timestamp capture per Rule 5 (Consent Manager Rules)
- Data flow halt mechanism upon withdrawal

---

## 4. Section 7: Legitimate Uses (Alternative to Consent)

### 4.1 Listed Legitimate Uses

Data may be processed without consent if:

1. **Voluntary provision for specified purpose** — Data Principal voluntarily provides data for a specific processing activity (e.g., job application)

2. **Employment relationship** — Necessary to perform employment contract or legal obligations under labor law

3. **State benefit delivery** — Processing by government for social security, welfare, or public health benefits

4. **Law enforcement and judicial functions** — Court orders, statutory investigations, prevention of crime

5. **Medical and public health** — Registered medical practitioners or public health authorities for medical services, disease control, or pandemic response

6. **Cybersecurity and network integrity** — Protection against cyberattacks, fraud, or network security threats

7. **Reasonable expectation** — Data was made public by Data Principal themselves or is already publicly available

8. **Legal obligations** — Compliance with court orders, statutory duties, or regulatory mandates

### 4.2 Scope and Limitations

- **Strict construction**: Legitimate uses do NOT override Section 8 general obligations
- Processing under legitimate use still requires notice (Section 5)
- Purpose limitations apply: cannot use Section 7 as pretense for unrelated processing
- Data Fiduciary remains accountable for accuracy and security

### 4.3 Applicability Matrix

| Use Case             | Legitimate Use          | Additional Conditions              | Requires Notice                   |
| -------------------- | ----------------------- | ---------------------------------- | --------------------------------- |
| Hiring decisions     | Employment relationship | Necessary + proportionate          | Yes (Section 5)                   |
| Welfare disbursement | State benefit delivery  | Government entity only             | Yes                               |
| Fraud detection      | Cybersecurity           | Limited to threat mitigation       | Yes                               |
| Police investigation | Law enforcement         | Court order or statutory authority | Yes (after use if disclosed)      |
| Medical treatment    | Medical/public health   | Registered provider                | Yes (implied consent in practice) |

### 4.4 Compliance Architecture Impact

- Requires legitimate use classification engine
- Mandates notice generation even for non-consent processing
- Necessitates evidence/documentation of use justification
- Audit logging of legitimate use determination

---

## 5. Section 8: Data Fiduciary Obligations (General)

### 5.1 Core Principle

**Accountability**: A Data Fiduciary remains responsible for compliance with the Act, even when a Data Processor handles processing on its behalf. This responsibility **cannot be contracted away**.

### 5.2 Processor Engagement (Section 8(2))

**Mandatory Requirements:**

- Data Processor may be engaged **only under a valid written contract**
- Contract must address:
  - Processing only on documented instructions from Data Fiduciary
  - Sub-processor engagement (requires written consent before engagement)
  - Data security safeguards (per Rule 6)
  - Breach notification to Data Fiduciary
  - Deletion of personal data upon contract termination
  - Cross-border transfer restrictions (if applicable)

**Fiduciary Liability:**

- Remains liable for Processor's acts or omissions
- Processor cannot process for own purposes

### 5.3 Accuracy (Section 8(3))

**Requirement:**
Personal data shall be kept complete, accurate, and consistent, **if** the data is used for:

- Making decisions about a Data Principal, OR
- Disclosure to another Data Fiduciary

**Scope:**

- Applies only to "decisions" (e.g., credit decisions, employment, access to services)
- Not a blanket accuracy requirement for all data
- Proportionality applies (accuracy level matches risk/impact)

**Implementation:**

- Validation at point of collection
- Update mechanisms for correction
- Audit trails of accuracy assurance

### 5.4 Technical and Organizational Measures (Section 8(4))

**Requirement:**
Implement appropriate technical and organizational measures, including safeguards proportionate to:

- Risk of personal data breach
- Nature of personal data
- Volume of data
- Scope of processing

**Examples:**

- Encryption (in transit and at rest)
- Access controls (role-based, least privilege)
- Segmentation and isolation
- Monitoring and logging
- Incident response procedures

### 5.5 Security Safeguards (Section 8(5))

**Mandatory Requirement:**
Implement **reasonable security safeguards** to prevent personal data breach.

**Minimum Safeguards (Rule 6):**

1. User access control — authentication, authorization, role-based access
2. Data encryption — end-to-end or in-transit encryption per data sensitivity
3. Secure communication — TLS/SSL for data transmission
4. Network security — firewalls, intrusion detection, DDoS protection
5. Physical security — restricted access to data centers
6. Employee security — background checks, NDAs, access provisioning
7. Change management — documented procedures for system changes
8. Incident management — breach detection and containment procedures
9. Deletion procedures — secure data destruction upon purpose fulfillment
10. Audit and logging — maintain logs for minimum 1 year (per Rule 7)
11. Business continuity — backup, recovery, resilience procedures
12. Vendor management — third-party security assessment, contracts

### 5.6 Breach Notification (Section 8(6))

**Trigger:** Personal data breach occurs when data is "accidentally or unlawfully disclosed, altered, lost, stolen, or destroyed."

**Timeline (Rule 7):**

- Notify **Data Protection Board** as soon as reasonably practicable
- Notify **affected Data Principals** within **72 hours** of knowing of breach
- May be delayed if law enforcement requests delay for investigation (max 30 days)

**Content of Notification:**

- Nature and scope of breach
- Personal data categories and approximate number of individuals affected
- Identity of the fiduciary
- Contact details for grievance redressal
- Measures taken or proposed to remediate

**Exception:**

- No notification required if reasonable security measures were in place and data was encrypted or rendered inaccessible to unauthorized persons

### 5.7 Data Erasure (Section 8(7))

**Trigger:** Erasure required when:

1. **Consent withdrawn** — Data Principal withdraws consent
2. **Purpose fulfilled** — Specified purpose no longer requires retention
3. **Whichever comes first**

**Exception:**

- Retention if required by law (tax, regulatory, contractual obligations)
- Document basis for any legal retention

**Obligation to Processor:**

- Data Fiduciary must ensure Processor also erases data
- Data must be **deleted**, not merely de-identified (unlike GDPR return-or-delete option)

**Deemed Purpose Fulfillment (Rule 11):**

- If Data Principal has not contacted fiduciary for a prescribed period (typically 2 years)
- Purpose deemed fulfilled, triggering automatic erasure obligation

### 5.8 Data Protection Officer (Section 8(8))

**For Significant Data Fiduciaries:**

- Must appoint a **Data Protection Officer (DPO)**
- DPO must be **based in India**
- DPO must report to board or governing body
- Function: monitor compliance, point of contact with Data Protection Board

**For Other Fiduciaries:**

- Can be a designated responsible person or team
- No statutory title required

### 5.9 Contact Details Publication (Section 8(9))

**Requirement:**

- Publish and maintain **contact details** of Data Protection Officer or authorized person
- Must be prominently placed on website or data collection interface
- Must be provided in responses to Data Principal queries

### 5.10 Grievance Redressal (Section 8(10))

**Mandatory Mechanism:**

- Establish **effective grievance mechanism** for Data Principals to lodge complaints
- Acknowledge receipt within reasonable time (typically 5-7 days per Rule 12)
- Provide substantive response within 30 days (per Rule 12)
- Must not charge Data Principal for grievance redressal

**Scope:**

- Consent withdrawal queries
- Accuracy/correction requests
- Breach notifications
- Denial of rights
- General privacy concerns

### 5.11 Section 8 Obligations Summary Table

| Obligation          | Requirement                                    | Applicability                | Compliance Deadline                |
| ------------------- | ---------------------------------------------- | ---------------------------- | ---------------------------------- |
| Processor contracts | Written agreement required                     | All using processors         | Before engagement                  |
| Accuracy            | Keep complete/accurate if used for decisions   | Decision-making processing   | Ongoing                            |
| Technical measures  | Proportionate to risk                          | All processing               | Before processing begins           |
| Security safeguards | Reasonable safeguards per Rule 6               | All processing               | Before processing begins           |
| Breach notification | 72 hours to Board + principals                 | Upon breach detection        | Ongoing (May 14, 2027 enforcement) |
| Data erasure        | Upon consent withdrawal or purpose fulfillment | All processing               | Within reasonable time             |
| DPO appointment     | For SDFs; base in India                        | Significant Data Fiduciaries | May 2027                           |
| Contact publication | DPO/authorized person details                  | All fiduciaries              | Ongoing                            |
| Grievance redressal | Effective mechanism with timelines             | All fiduciaries              | Ongoing (May 2027 enforcement)     |

---

## 6. Section 5 (Data Protection Board): Regulatory Framework

### 6.1 Board Establishment

- **Established:** 13 November 2025 (G.S.R. 844(E))
- **Head Office:** National Capital Region (Delhi)
- **Initial composition:** 4 members (Chair + 3 members)
- **Appointment process:** Government commenced in May 2026; as of September 2026, no appointments confirmed

### 6.2 Board Powers and Functions (Section 27)

**Jurisdiction:**

- Inquire into personal data breaches
- Receive complaints from Data Principals
- Process references from Government
- Execute court-ordered investigations

**Powers:**

- Issue compliance orders
- Accept voluntary undertakings
- Impose monetary penalties (see Section 6.3)
- Powers similar to civil court (summon witnesses, require documents)

**Limitations:**

- Cannot entertain civil disputes between private parties
- Cannot override court orders or statutory obligations

### 6.3 Penalty Regime (Sections 33, 34, 35)

**Penalty Ceilings (per violation):**

| Violation                                          | Maximum Penalty | Details                   |
| -------------------------------------------------- | --------------- | ------------------------- |
| Failing to maintain reasonable security safeguards | ₹250 crore      | Highest penalty tier      |
| Failing to notify breach to Board/principals       | ₹200 crore      | Major enforcement failure |
| Children's data violations                         | ₹200 crore      | Enhanced protection zone  |
| Other breaches (notice, consent, erasure, etc.)    | ₹50 crore       | General non-compliance    |

**Penalty Mitigation:**

- Self-disclosure before regulatory action
- Prompt remediation of breach
- Cooperation with investigation
- Evidence of good-faith compliance efforts

### 6.4 Appeals and Dispute Resolution

- **First appeal:** Telecom Disputes Settlement and Appellate Tribunal (TDSAT)
- **Deadline:** Within 60 days of Board order
- **Further appeals:** High Court and Supreme Court

### 6.5 Enforcement Timeline

- **13 November 2025**: Board framework established
- **13 November 2026**: Consent Manager registration + Board jurisdiction over consent managers
- **14 May 2027**: Full enforcement of penalties and breach notification obligations
- **Open question:** Board composition as of October 2026 uncertain (affects enforcement velocity)

---

## 7. Section 10: Significant Data Fiduciary (SDF) Designation

### 7.1 Definition and Criteria

Central Government may notify any Data Fiduciary or class of Fiduciaries as an SDF, based on assessment of:

**Volume of Personal Data:**

- Processing data of **50 lakh+ Indian residents** (indicative, not statutory minimum)
- **₹250 crore+ annual revenue**
- **Multi-sectoral presence**

**Impact and Risk Factors:**

1. **Decision-making impact**: Significantly affects Data Principals' access to credit, employment, opportunities, or public services
2. **Sensitive data processing**: Financial, health, biometric, genetic, caste, religion, political affiliation, sexual orientation, criminal records
3. **Data combination**: Merging data from multiple sources for profiling, prediction, or behavior analysis
4. **Key Information Infrastructure (KII) status**: Operator under IT Act 2000, Section 70
5. **Geographic scope**: Operations in multiple sectors or regions

**Self-Assessment Scoring (indicative):**

- 3+ High-weight "yes" answers → Likely SDF
- 2+ "yes" answers → Possible SDF
- <2 → Unlikely SDF

### 7.2 Mandatory SDF Obligations (In Addition to Section 8)

**1. Data Protection Officer (DPO)**

- Must appoint a DPO (individual or team)
- **Must be based in India**
- Reports to board/governing body
- **Appointment deadline**: Within 90 days of SDF notification (estimated May-August 2027)

**DPO Functions:**

- Monitor compliance with DPDP Act
- Point of contact for Data Protection Board
- Conduct Data Protection Impact Assessments (DPIA)
- Maintain compliance records
- Facilitate grievance redressal
- Coordinate with independent auditors

**2. Data Protection Impact Assessments (DPIA)**

- Mandatory for:
  - **Automated decision-making** systems (credit scoring, hiring, content moderation)
  - **Large-scale processing** of sensitive personal data
  - **Behavioral profiling** or predictive analytics
  - **New processing activities** with privacy risks
- **Frequency**: At least annually; ad-hoc when processing changes
- **Content of DPIA**:
  - Description of processing activity
  - Necessity and proportionality analysis
  - Risks to Data Principals' rights
  - Risk mitigation measures
  - Stakeholder consultation (where applicable)
  - Documented conclusions and recommendations

**3. Independent Data Audits**

- Conduct **independent audits** at least annually
- **Auditor qualification**: Data protection expertise (legal and technical)
- **Audit scope**:
  - Overall compliance with DPDP Act and Rules
  - Adequacy of data protection safeguards
  - Data Principal rights fulfillment
  - Breach response procedures
  - Record-keeping accuracy
- **Audit report**: Submitted to DPO and board; retained for 3+ years

**4. Enhanced Record-Keeping**

- Maintain and retain for minimum **3 years** (or longer if sector requires):
  - **Processing Register**: Purpose, categories, retention, third-party sharing
  - **Consent records**: Timestamped, immutable, linked to notice
  - **Incident logs**: Breaches, their investigation, remediation
  - **DPIA and audit reports**: Complete documentation
  - **Data Principal requests**: Access, correction, erasure + responses
  - **Processor agreements**: All contracts and amendments
  - **Personnel training logs**: Privacy training, onboarding
  - **Third-party processor documentation**: Assessments, audits, contracts

### 7.3 SDF Applicability Matrix

| Requirement                                     | All Fiduciaries | SDF Only               |
| ----------------------------------------------- | --------------- | ---------------------- |
| Section 8 obligations (consent, notice, breach) | Yes             | Yes + enhanced         |
| Processor contracts                             | Yes             | Yes                    |
| Data Protection Officer                         | Optional        | **Mandatory**          |
| Annual DPIA                                     | No              | **Mandatory**          |
| Independent audit                               | No              | **Mandatory (annual)** |
| Enhanced records                                | 1-year logs     | **3+ year records**    |

---

## 8. Data Subject Rights (Sections 11-14)

### 8.1 Right to Information (Section 11)

**Entitlement:**

- Access to personal data and metadata (how long retained, who has access, etc.)
- Records of third-party sharing
- Purpose(s) of processing

**Implementation:**

- Must provide in clear, plain language
- Within reasonable time (typical: 7-30 days per Rules)
- No unreasonable burden on Data Fiduciary
- No requirement to create new data (provide only existing records)

### 8.2 Right to Correction and Completion (Section 12)

**Entitlement:**

- Correct inaccurate or incomplete personal data
- Data Fiduciary must correct or explain non-correction

**Scope:**

- Limited to **factual inaccuracy** (e.g., wrong address)
- Does not extend to subjective assessments or algorithmic outputs
- Data Fiduciary can refuse if correction would violate law

**Process:**

- Submission of correction request
- Acknowledgment within 5 days
- Response within 30 days
- Notification to recipients of old data (if disclosure has occurred)

### 8.3 Right to Erasure

**Entitlement:**

- Erasure when consent withdrawn OR specified purpose fulfilled (Section 8(7))
- NOT a standalone "right to be forgotten" as in GDPR

**Exceptions:**

- Legal retention requirements (tax, regulatory)
- Court orders
- Ongoing litigation
- Data protection itself (e.g., fraud detection)

**Implementation:**

- Erasure within reasonable time after request
- Confirm erasure to Data Principal
- Ensure Processors also erase

### 8.4 Right to Grievance Redressal (Section 13)

**Entitlement:**

- Lodge grievances for alleged violations
- Receive response within 30 days (per Rule 12)
- Escalate to Data Protection Board if unsatisfied

**Scope:**

- Denial or delay in exercising above rights
- Privacy concerns
- Breach not disclosed
- Unauthorized processing

**No charge for exercise**: Data Fiduciary cannot charge Data Principal for exercising rights

### 8.5 Right to Nominate (Section 14)

**Entitlement:**

- Nominate another person to exercise rights on behalf of Data Principal
- Relevant in cases of death, incapacity, guardianship

**Scope:**

- Guardian for minors (parental consent)
- Legal representative/power of attorney for incapacitated persons
- Executors/heirs in estate matters

---

## 9. Compliance Timeline and Phases

### 9.1 Phase 1: Foundation (13–14 November 2025)

- Data Protection Board established
- Procedural rules published (G.S.R. 843(E), G.S.R. 844(E), G.S.R. 846(E))
- Key definitions effective
- Government rule-making powers active
- Civil court jurisdiction excluded for Act disputes

**Compliance Action**: Organizations should:

- Assess SDF status under draft criteria
- Conduct data inventory
- Map processor relationships
- Begin notice/consent documentation review

### 9.2 Phase 2: Consent Manager Registration (13 November 2026)

- Consent Manager registration mandatory (Rule 4)
- Registration conditions take effect (Part A, First Schedule)
- Board gains jurisdiction over non-compliant consent managers

**Registration Criteria:**

- Indian incorporated company
- ₹2 crore minimum net worth
- Technical, operational, financial capacity
- Reputable directors/management
- Conflict-of-interest policies

**Ongoing Obligations:**

- 7-year consent record retention (Part B)
- Prevent readability of routed personal data
- Maintain separation from Data Fiduciary role

**Compliance Action**: Organizations should:

- Evaluate consent manager needs
- Identify compliant platforms
- Prepare registration applications
- Implement consent workflow automation

### 9.3 Phase 3: Full Enforcement (14 May 2027)

- Most substantive obligations take effect
- Notice and consent requirements enforceable
- Breach notification mandatory (72 hours)
- Data fiduciary general obligations enforceable
- SDF additional duties enforceable
- Board penalty powers active
- Data principal rights enforceable

**What becomes enforceable:**

- Section 4 lawful grounds
- Section 5 notice
- Section 6 consent withdrawal
- Section 8 general obligations (accuracy, security, breach notification, erasure, grievance)
- Sections 11-14 data subject rights
- Section 10 SDF designation and duties

**Compliance Action**: Organizations should:

- Deploy notice/consent management systems
- Implement processor agreements for all vendors
- Establish breach notification procedures
- Deploy data erasure workflows
- Appoint DPOs (SDFs)
- Conduct DPIA (SDFs)
- Engage independent auditors (SDFs)

---

## 10. Significant Data Fiduciary: Likely Categories

Based on assessment criteria, these sectors/entities are likely SDF candidates (as of May 2027 enforcement):

### 10.1 Financial Services

- **Banks** (RBI-regulated)
- **Insurance companies** (IRDAI-regulated)
- **NBFCs** (> ₹100 crore AUM)
- **Payment processors** (NPCI entities)
- **Investment platforms** (stock brokers, mutual fund houses)

**Reason**: High volume (50+ lakh customers), sensitive financial data, decision-making impact (credit), KII status for systemically important institutions

### 10.2 Digital Platforms & E-Commerce

- **E-commerce marketplaces** (Flipkart, Amazon, Meesho, etc.)
- **Social media platforms** (Meta, YouTube, Twitter, Telegram entities in India)
- **Search engines** (Google, Bing)
- **Content platforms** (Swiggy, Ola, Netflix, etc.)

**Reason**: Massive volume (100+ lakh users), behavioral profiling, cross-data combination, algorithmic decision-making

### 10.3 Telecom & ISP

- **Telecom operators** (Jio, Airtel, VI, etc.)
- **ISPs and broadband providers**

**Reason**: Volume (100+ million subscribers), sensitive location/communication data, KII designation

### 10.4 Government and Public Services

- **Aadhaar database authority** (UIDAI)
- **Government health schemes** (Ayushman Bharat, vaccination registries)
- **Welfare distribution systems**
- **Election data handlers**

**Reason**: Exceptional volume, sensitive data, democratic impact, mandatory government data flows

### 10.5 Healthcare & Wellness

- **Major hospital chains** (Apollo, Fortis, Max, etc.)
- **Health insurance TPA platforms**
- **Online health consultation platforms**

**Reason**: Sensitive medical data, decision-making (insurance, treatment), large user bases

### 10.6 Employer/HR Systems

- **Large corporations** (> 10,000 employees)
- **Staffing and HR platforms**
- **Employee verification services** (background checks)

**Reason**: Employment decisions, sensitive HR data, volume threshold

### 10.7 Technology/Cloud Providers

- **Cloud service providers** (AWS India, Azure, GCP)
- **SaaS platforms** processing customer data at scale
- **Cybersecurity vendors** (ISS, Kaspersky regional operations)

**Reason**: Volume of data processed, cross-customer data combination, cybersecurity infrastructure

---

## 11. Key Architectural Requirements for Compliance Engine

Based on the above requirements, a compliance engine must support:

### 11.1 Consent Management

- [ ] Consent state machine (given → active → withdrawn)
- [ ] Purpose-linked consent granularity
- [ ] Timestamp capture and immutability (Rule 5)
- [ ] Withdrawal mechanism as easy as grant
- [ ] Parental consent workflows for minors
- [ ] Consent manager integration (Rule 4)

### 11.2 Notice Management

- [ ] Dynamic notice generation per data type and purpose
- [ ] Plain-language template library
- [ ] Multilingual support (Hindi/English)
- [ ] Notice presentation tracking (acknowledgment)
- [ ] Rule 3 format compliance

### 11.3 Data Lifecycle Management

- [ ] Purpose-based retention tracking
- [ ] Automatic erasure triggers (consent withdrawal, purpose fulfillment, inactivity)
- [ ] Proof of erasure/deletion logs
- [ ] Processor deletion coordination
- [ ] Legal hold exceptions

### 11.4 Breach Response

- [ ] Breach detection and classification
- [ ] 72-hour notification orchestration (Board + principals)
- [ ] Breach notification template per Rule 7
- [ ] Incident log retention (1+ year)

### 11.5 Data Subject Rights

- [ ] Access request workflow (data export)
- [ ] Correction/completion workflows
- [ ] Erasure request processing
- [ ] Grievance ticket management
- [ ] Response SLA tracking (30 days typical)

### 11.6 Processor Agreement Management

- [ ] Contract template library (Section 8(2))
- [ ] Sub-processor tracking and consent workflows
- [ ] Audit rights management
- [ ] Deletion obligation tracking

### 11.7 SDF-Specific Capabilities

- [ ] DPIA workflow (mandatory annually)
- [ ] Independent audit management
- [ ] DPO assignment and contact publication
- [ ] Enhanced record retention (3+ years)
- [ ] Processing register automation

### 11.8 Audit and Reporting

- [ ] Compliance dashboard (obligations vs. completion)
- [ ] Penalty risk calculator (Section 33-35)
- [ ] SDF readiness assessment
- [ ] Regulatory reporting templates
- [ ] Board inquiry response management

---

## 12. Appendix: Regulatory Sources & References

### Primary Sources

- **DPDP Act 2023**: [Ministry of Law and Justice](https://www.dpdpact2023.com/)
- **DPDP Rules 2025**: G.S.R. 843(E), 844(E), 846(E) — Notified 13–14 November 2025
- **Data Protection Board**: [Official website](https://dpdp.ind.in/) (registration portal opened pending)

### Secondary Research Sources

- [Shardul Amarchand Mangaldas: DPDP Enforcement Timeline](https://www.amsshardul.com/insight/enforcement-of-the-dpdp-act-and-notification-of-the-dpdp-rules/)
- [AZB Partners: Phased Rollout & Milestones](https://www.azbpartners.com/bank/indias-digital-personal-data-protection-act-phased-rollout-and-key-compliance-milestones/)
- [MiniOrange: Data Fiduciary Obligations Guide](https://www.miniorange.com/blog/data-fiduciary-obligations-dpdp-act/)
- [Vrâtex: DPDP Compliance Framework](https://www.vratex.com/dpdp-act/)
- [DPDP Consultants: SDF Assessment](https://www.dpdpconsultants.com/)
- [TCSA: DPDP Rules 2025 Roadmap](https://www.tcsa.in/resources/dpdp-rules-2025-implementation-roadmap)
- [TSaaro: Consent Managers & Board Powers](https://tsaaro.com/blogs/)

### Research Limitations & Caveats

1. **Board Composition**: As of September 2026, the Data Protection Board had no appointed members despite government invitations in May 2026. Enforcement velocity uncertain.
2. **Rule Interpretation**: Gazette text (G.S.R. 843/844/846(E)) is authoritative. Many secondary sources interpret conflictingly—verify against official text.
3. **SDF Thresholds**: The Act does not codify a numerical threshold (e.g., "50 lakh residents"). Indicative figures above are from advisory commentary, not statute.
4. **Constitutional Challenges**: Legal uncertainty exists around potential constitutional challenges to penalty provisions and Board jurisdiction. Litigate risk factored into SDF planning.

---

**Document Status**: Complete research synthesis as of October 2026
**Next Step**: Feed into Architecture Agent for compliance engine design (Session 2)
