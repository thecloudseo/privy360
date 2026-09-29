# Regulatory ingestion and publication specification

No legal documents are present in this workspace. No external lookup/import was authorized in this architecture session. This contract specifies a future verified intake process; it does not assert text, legal commencement, statutory deadlines or applicability. MASTER_SPEC examples and requirement codes are illustrative until independently sourced and approved.

## Intake manifest

A candidate bundle includes bundle_id, schema_version, jurisdiction, issuing_authority, regulation_code, document_kind (ACT/RULES/CORRIGENDUM/COMMENCEMENT/AMENDMENT/OTHER), original official URI or offline acquisition provenance, title, language, published_date if known, retrieved_at, byte_length, MIME, SHA-256, immutable object reference, source locator scheme, acquiring actor, verification status and signature when provided. A signature is useful provenance, not assumed present on every official document. Unknown dates remain null with explicit reason/status, never guessed.

Sources are allowlisted by approved authority policy before connected ingestion. Fetch workers use restricted egress, no arbitrary URL from a public API, revalidate redirects/DNS and validate bytes in quarantine. Offline deployments accept uploaded manifest+documents with digest verification and documented chain of custody. Preserve originals immutably; text extraction/OCR outputs are derivatives with tool/version/digest/confidence and page/paragraph offsets. OCR never becomes statutory truth without review of uncertain spans.

## Review sequence

1. Acquire original bytes and compute digest; deduplicate exact artefact without erasing retrieval history.
2. Verify official publisher/acquisition provenance and identify document kind/language. Human source verifier records decision.
3. Parse hierarchy into stable regulation/provision identities and immutable versions. Store locators sufficient to reopen exact source passage.
4. Propose atomic requirements and mark LEGAL_REQUIREMENT versus IMPLEMENTATION_CONTROL versus RECOMMENDED_GOOD_PRACTICE. Record interpretation separately from quotation; require citation for every legal assertion.
5. Model applicability AST, effective/commencement relationships, exceptions and deadline semantics only from reviewed source. UNKNOWN facts produce UNKNOWN, not non-applicability. Corrigenda/amendments supersede specific versions with provenance.
6. Map requirement versions to control templates, test methods and evidence requirements. Cover all 28 taxonomy families with applicability notes; absent statutory basis stays unverified, never filled by model memory.
7. Independent Legal publisher verifies the manifest, source citations, stable IDs, version lineage and interpretations. Maker cannot publish own mapping. Entire bundle is atomically marked published and signed by approved platform key service.
8. Emit global RegulationChanged, create tenant-specific impact work. Existing obligations/tests remain pinned until reviewed tenant adoption. Generate diff, proposed obligations/control changes, workflow impact and remediation suggestions; no automatic legal decision.

## Applicability expression contract

Versioned AST permits `all`, `any`, `not`, `eq`, `in`, `gt/gte/lt/lte` on registered fact keys and typed values. No arbitrary SQL, code, network lookup or natural-language evaluator. Fact record includes key, value, source, observed_at, valid interval, reviewer and confidence. Three-valued logic: all(false,unknown)=false; all(true,unknown)=unknown; any(true,unknown)=true; any(false,unknown)=unknown; not(unknown)=unknown. Decision response includes outcome, evaluated rule version, fact versions, evaluation time, rationale tree and unresolved facts. A human override is a separately approved decision with cited reason, never an unlogged AST mutation.

Deadline definition stores trigger type, duration/calendar interpretation, timezone, business-calendar reference if source requires, pause/resume conditions if verified, and source version. No generic default statutory SLA. Missing/ambiguous timer displays LEGAL_REVIEW_REQUIRED and creates a task; operational service targets are separately labeled and cannot be presented as law.

## Coverage and publication gates

Every legal control: published source → provision version → canonical requirement version/code → applicability rule → effective_from known → >=1 evidence requirement → test method. Stable ID examples in MASTER_SPEC define a naming convention, not legal content. Legacy DPDP-SEC-* aliases require explicit reviewed mapping. 150–250 atomic controls is a planning target; do not split/create fictitious legal obligations to satisfy count. Maintain source coverage matrix with provision, mapped atomic requirements, exclusions/uncertainty and Legal approval. CI tests structural traceability; only human legal review determines whether wording/mapping is correct.

Synthetic fixtures use a distinct SYNTH-* namespace, non-legal classification, synthetic=true manifest and conspicuous labels. They may exercise publication/graph mechanics in test/demo tenants but are blocked from authoritative/legal-labelled catalog and production corpus import. A bid with unapproved sources may demonstrate mechanics only; it cannot be represented as the approved DPDP compliance library.

## International growth and conflicts

Jurisdiction and authority are first-class. Parallel laws can impose distinct obligations on one activity; versioned obligations remain separate even if one control satisfies several. Record conflicting interpretations and escalation rather than silently merging. Source-language text and reviewed translations are distinct; translation is never silently authoritative. Government, BFSI, health and EdTech packs instantiate draft inventory/questions/control suggestions against installed corpus versions; no pack establishes legal applicability by industry name alone.

## Required evidence and tests

Tampered manifest, source checksum mismatch, OCR uncertainty, missing citation, unreviewed effective date, alias collision, self-publication, incomplete bundle, duplicate import, concurrent version publication, superseded query and unauthorized tenant write to global corpus tests. No network/source fetch in this session. Future ingestion requires source-specific authorization and supplied official documents under the user's workspace boundary.
