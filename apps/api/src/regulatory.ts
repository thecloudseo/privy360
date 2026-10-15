/**
 * Regulatory API stubs - regulatory module pending full implementation
 * Required by regulatory-004-api.test.mjs
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

export function getProvision(_regulatoryCorpus: unknown, provisionId: string) {
  return { provisionId };
}

export function getRegulations(_regulatoryCorpus: unknown) {
  return [];
}

export function getRequirementVersions(
  _regulatoryCorpus: unknown,
  _requirementId: string,
) {
  return [];
}
