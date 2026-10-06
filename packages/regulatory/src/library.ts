import type {
  RegulatorySource,
  SourceCitation,
  Requirement,
  RequirementVersion,
} from "./index.ts";

export type LibraryRegulation = Readonly<{
  regulationId: string;
  jurisdiction: string;
  authority: string;
  code: string;
  title: string;
}>;

export type LibraryRegulationVersion = Readonly<{
  regulationVersionId: string;
  regulationId: string;
  revision: number;
  effectiveFrom: string;
  effectiveTo?: string;
  state: "PUBLISHED";
  sourceIds: readonly string[];
}>;

export type LibraryProvision = Readonly<{
  provisionId: string;
  regulationId: string;
  code: string;
}>;

export type LibraryProvisionVersion = Readonly<{
  provisionVersionId: string;
  provisionId: string;
  regulationVersionId: string;
  language: string;
  textContent: string;
  locator: string;
  effectiveFrom: string;
  effectiveTo?: string;
  citationId: string;
}>;

export type RegulatoryLibraryCorpus = Readonly<{
  sources: readonly RegulatorySource[];
  citations: readonly SourceCitation[];
  regulations: readonly LibraryRegulation[];
  regulationVersions: readonly (Omit<LibraryRegulationVersion, "state"> & {
    state: "DRAFT" | "REVIEWED" | "PUBLISHED" | "SUPERSEDED" | "RETIRED";
  })[];
  provisions: readonly LibraryProvision[];
  provisionVersions: readonly LibraryProvisionVersion[];
  requirements: readonly Requirement[];
  requirementVersions: readonly RequirementVersion[];
}>;

export type PublishedCorpus = Readonly<{
  sources: readonly RegulatorySource[];
  citations: readonly SourceCitation[];
  regulations: readonly LibraryRegulation[];
  regulationVersions: readonly LibraryRegulationVersion[];
  provisions: readonly LibraryProvision[];
  provisionVersions: readonly LibraryProvisionVersion[];
  requirements: readonly Requirement[];
  requirementVersions: readonly RequirementVersion[];
}>;

function fail(message: string): never {
  throw new Error(message);
}

function findBy<T>(
  rows: readonly T[],
  predicate: (row: T) => boolean,
  label: string,
): T {
  const result = rows.find(predicate);
  return result ?? fail(`${label} not found`);
}

export function projectPublishedCorpus(
  corpus: RegulatoryLibraryCorpus,
): PublishedCorpus {
  const regulationVersions: LibraryRegulationVersion[] =
    corpus.regulationVersions
      .filter((version) => version.state === "PUBLISHED")
      .map((version) => ({ ...version, state: "PUBLISHED" as const }));
  const publishedRegulationIds = new Set(
    regulationVersions.map((version) => version.regulationId),
  );
  const regulationVersionIds = new Set(
    regulationVersions.map((version) => version.regulationVersionId),
  );
  const provisionVersions = corpus.provisionVersions.filter((version) =>
    regulationVersionIds.has(version.regulationVersionId),
  );
  const provisionIds = new Set(
    provisionVersions.map((version) => version.provisionId),
  );
  const requirementVersions = corpus.requirementVersions.filter(
    (version) => version.reviewState === "PUBLISHED",
  );
  const requirementIds = new Set(
    requirementVersions.map((version) => version.requirementId),
  );
  const sourceIds = new Set(
    regulationVersions.flatMap((version) => version.sourceIds),
  );
  provisionVersions.forEach((version) =>
    sourceIds.add(
      findBy(
        corpus.citations,
        (citation) => citation.citationId === version.citationId,
        "citation",
      ).sourceId,
    ),
  );
  const citationIds = new Set(
    provisionVersions.map((version) => version.citationId),
  );
  requirementVersions.forEach((version) =>
    version.citationIds.forEach((citationId) => citationIds.add(citationId)),
  );
  const citations = corpus.citations.filter((citation) =>
    citationIds.has(citation.citationId),
  );
  citations.forEach((citation) => sourceIds.add(citation.sourceId));
  return {
    sources: corpus.sources.filter((source) => sourceIds.has(source.sourceId)),
    citations,
    regulations: corpus.regulations.filter((regulation) =>
      publishedRegulationIds.has(regulation.regulationId),
    ),
    regulationVersions,
    provisions: corpus.provisions.filter((provision) =>
      provisionIds.has(provision.provisionId),
    ),
    provisionVersions,
    requirements: corpus.requirements.filter((requirement) =>
      requirementIds.has(requirement.requirementId),
    ),
    requirementVersions,
  };
}

export type RegulationListQuery = Readonly<{
  limit: number;
  cursor?: string;
  query?: string;
}>;
export type PublishedRegulationSummary = Readonly<{
  regulation: LibraryRegulation;
  versions: readonly LibraryRegulationVersion[];
}>;
export type RegulationListPage = Readonly<{
  items: readonly PublishedRegulationSummary[];
  nextCursor?: string;
}>;

export function listPublishedRegulations(
  corpus: PublishedCorpus,
  query: RegulationListQuery,
): RegulationListPage {
  const normalized = query.query?.trim().toLocaleLowerCase("en-IN");
  const summaries = corpus.regulations
    .map((regulation) => ({
      regulation,
      versions: corpus.regulationVersions.filter(
        (version) => version.regulationId === regulation.regulationId,
      ),
    }))
    .filter(
      ({ regulation }) =>
        !normalized ||
        [regulation.code, regulation.title, regulation.authority].some(
          (value) => value.toLocaleLowerCase("en-IN").includes(normalized),
        ),
    )
    .sort((a, b) => a.regulation.code.localeCompare(b.regulation.code));
  const start = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  if (!Number.isInteger(start) || start < 0) fail("cursor is invalid");
  const items = summaries.slice(start, start + query.limit);
  return {
    items,
    ...(start + query.limit < summaries.length
      ? { nextCursor: String(start + query.limit) }
      : {}),
  };
}

export function selectPublishedRequirementVersions(
  corpus: PublishedCorpus,
  requirementId: string,
): readonly RequirementVersion[] {
  findBy(
    corpus.requirements,
    (requirement) => requirement.requirementId === requirementId,
    "requirement",
  );
  return corpus.requirementVersions.filter(
    (version) => version.requirementId === requirementId,
  );
}

export function selectPublishedRegulation(
  corpus: PublishedCorpus,
  regulationId: string,
): PublishedRegulationSummary {
  const regulation = findBy(
    corpus.regulations,
    (item) => item.regulationId === regulationId,
    "regulation",
  );
  return {
    regulation,
    versions: corpus.regulationVersions.filter(
      (version) => version.regulationId === regulationId,
    ),
  };
}
