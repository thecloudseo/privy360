export const BASELINE_COMMIT = "a432fbd861e918b8c2438da074fd74de263dfaa3";
export const REQUIRED_ARCHITECTURE_DOCUMENTS = [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "SECURITY_ARCHITECTURE.md",
  "DEPLOYMENT_ARCHITECTURE.md",
  "THREAT_MODEL.md",
  "DOMAIN_MODEL.md",
  "MODULE_BOUNDARIES.md",
  "DATABASE_SPEC.md",
  "API_ARCHITECTURE.md",
  "EVENT_MODEL.md",
  "RBAC_ABAC.md",
];

export function baselineErrors(tagCommit, presentFiles) {
  const errors = [];
  if (!tagCommit) errors.push("Architecture baseline tag missing.");
  else if (tagCommit !== BASELINE_COMMIT)
    errors.push("Architecture baseline tag changed.");
  for (const file of REQUIRED_ARCHITECTURE_DOCUMENTS)
    if (!presentFiles.has(file))
      errors.push(`Missing required architecture document: ${file}`);
  return errors;
}
