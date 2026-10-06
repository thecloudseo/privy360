export const ATOMIC_CONTROL_FAMILIES = {
  GOV: "GOV",
  APP: "APP",
  LPU: "LPU",
  NOT: "NOT",
  CON: "CON",
  CMI: "CMI",
  ACC: "ACC",
  SEC: "SEC",
  BRE: "BRE",
  RET: "RET",
  DEL: "DEL",
  CTC: "CTC",
  CHD: "CHD",
  GRD: "GRD",
  SDF: "SDF",
  DPA: "DPA",
  COR: "COR",
  ERS: "ERS",
  GRV: "GRV",
  NOM: "NOM",
  DUT: "DUT",
  XBR: "XBR",
  EXM: "EXM",
  PRC: "PRC",
  DPI: "DPI",
  AUD: "AUD",
  ALG: "ALG",
  REG: "REG",
} as const;

export type AtomicControlFamily =
  (typeof ATOMIC_CONTROL_FAMILIES)[keyof typeof ATOMIC_CONTROL_FAMILIES];
export type ControlClassification =
  "LEGAL_REQUIREMENT" | "IMPLEMENTATION_CONTROL" | "GOOD_PRACTICE";

export type AtomicControl = Readonly<{
  tenantId: string;
  controlId: string;
  templateId?: string;
  requirementVersionId?: string;
  code: string;
  revision: number;
  title: string;
  classification: ControlClassification;
  family: AtomicControlFamily;
  state: "DRAFT" | "REVIEW" | "APPROVED" | "RETIRED";
  effectiveFrom: string;
  requirement?: Readonly<{
    requirementVersionId: string;
    reviewState: "DRAFT" | "REVIEWED" | "PUBLISHED" | "SUPERSEDED" | "RETIRED";
    effectiveFrom: string;
    effectiveTo?: string;
    sourceCitationId?: string;
    applicabilityRuleId?: string;
  }>;
  requirementTenantId?: string;
  evidenceRequirements: readonly Readonly<{
    id: string;
    code: string;
    requiredType: string;
    freshnessDays?: number;
    sufficiencyCriteria: string;
    revision: number;
  }>[];
}>;

export type ValidationError = Readonly<{
  code: string;
  path: string;
  message: string;
}>;
export type ValidationResult = Readonly<{
  valid: boolean;
  errors: readonly ValidationError[];
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function error(
  errors: ValidationError[],
  code: string,
  path: string,
  message: string,
): void {
  errors.push({ code, path, message });
}

export function validateAtomicControl(
  control: AtomicControl,
): ValidationResult {
  const errors: ValidationError[] = [];
  if (!Object.values(ATOMIC_CONTROL_FAMILIES).includes(control.family))
    error(
      errors,
      "UNSUPPORTED_TAXONOMY_FAMILY",
      "family",
      "Control family is not registered",
    );
  if (!UUID.test(control.tenantId))
    error(
      errors,
      "INVALID_TENANT_ID",
      "tenantId",
      "Tenant identifier is invalid",
    );
  if (control.requirementTenantId)
    error(
      errors,
      "GLOBAL_REFERENCE_TENANT_BOUNDARY",
      "requirementTenantId",
      "Regulatory references are global",
    );
  const requirement = control.requirement;
  if (control.classification === "LEGAL_REQUIREMENT") {
    if (!requirement || requirement.reviewState !== "PUBLISHED")
      error(
        errors,
        "REQUIREMENT_NOT_PUBLISHED",
        "requirement.reviewState",
        "Legal controls require a published requirement version",
      );
    if (!requirement?.sourceCitationId)
      error(
        errors,
        "SOURCE_CITATION_REQUIRED",
        "requirement.sourceCitationId",
        "Legal controls require source provenance",
      );
    if (!requirement?.applicabilityRuleId)
      error(
        errors,
        "APPLICABILITY_RULE_REQUIRED",
        "requirement.applicabilityRuleId",
        "Legal controls require an approved applicability rule",
      );
  }
  if (requirement && control.effectiveFrom < requirement.effectiveFrom)
    error(
      errors,
      "CONTROL_BEFORE_REQUIREMENT",
      "effectiveFrom",
      "Control cannot predate its requirement version",
    );
  if (
    requirement?.effectiveTo &&
    requirement.effectiveFrom >= requirement.effectiveTo
  )
    error(
      errors,
      "INVALID_REQUIREMENT_INTERVAL",
      "requirement.effectiveTo",
      "Requirement effective interval is invalid",
    );
  if (!control.evidenceRequirements.length)
    error(
      errors,
      "EVIDENCE_REQUIREMENT_REQUIRED",
      "evidenceRequirements",
      "A control requires at least one evidence requirement",
    );
  for (const [index, evidence] of control.evidenceRequirements.entries()) {
    if (
      !evidence.code.trim() ||
      !evidence.requiredType.trim() ||
      !evidence.sufficiencyCriteria.trim()
    )
      error(
        errors,
        "INCOMPLETE_EVIDENCE_REQUIREMENT",
        `evidenceRequirements[${index}]`,
        "Evidence requirement semantics are incomplete",
      );
    if (
      evidence.freshnessDays !== undefined &&
      (!Number.isInteger(evidence.freshnessDays) || evidence.freshnessDays < 1)
    )
      error(
        errors,
        "INVALID_EVIDENCE_FRESHNESS",
        `evidenceRequirements[${index}].freshnessDays`,
        "Freshness must be a positive number of days",
      );
  }
  return { valid: errors.length === 0, errors };
}
