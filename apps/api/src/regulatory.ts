/**
 * Regulatory API stubs - regulatory module pending full implementation
 * Required by regulatory-004-api.test.mjs
 */

export function getProvision(regulatoryCorpus: unknown, provisionId: string) {
  return { provisionId };
}

export function getRegulations(regulatoryCorpus: unknown) {
  return [];
}

export function getRequirementVersions(regulatoryCorpus: unknown, requirementId: string) {
  return [];
}
