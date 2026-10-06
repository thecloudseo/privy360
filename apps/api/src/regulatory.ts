import {
  createApiErrorResponse,
  createCorrelationId,
  parsePagination,
} from "@privy360/api-common";
import {
  listPublishedRegulations,
  projectPublishedCorpus,
  selectPublishedRequirementVersions,
  selectPublishedRegulation,
  type PublishedCorpus,
  type RegulatoryLibraryCorpus,
} from "@privy360/regulatory";

export type RegulatoryReadContext = Readonly<{
  authorized: boolean;
  correlationId?: string;
  source: string;
}>;

export type LibraryReadAudit = Readonly<{
  action: "REGULATORY_LIBRARY_VIEWED";
  resourceType: "regulatory_library";
  resourceId: string;
  correlationId: string;
}>;

type RequestBase = Readonly<{
  corpus: RegulatoryLibraryCorpus;
  context: RegulatoryReadContext;
  audit?: (event: LibraryReadAudit) => void;
}>;

type ApiResponse<T> = Readonly<{
  status: number;
  body: T;
}>;

function errorResponse(
  context: RegulatoryReadContext,
  status: 400 | 403 | 404,
  code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND",
): ApiResponse<ReturnType<typeof createApiErrorResponse>> {
  const correlationId = createCorrelationId(context.correlationId);
  return {
    status,
    body: createApiErrorResponse(new Error(), { status, code, correlationId }),
  };
}

function requireReadAccess(request: RequestBase): string | undefined {
  if (!request.context.authorized) return undefined;
  return createCorrelationId(request.context.correlationId);
}

function auditRead(
  request: RequestBase,
  correlationId: string,
  resourceId: string,
): void {
  request.audit?.({
    action: "REGULATORY_LIBRARY_VIEWED",
    resourceType: "regulatory_library",
    resourceId,
    correlationId,
  });
}

function sourceDtos(corpus: PublishedCorpus, sourceIds: readonly string[]) {
  return corpus.sources
    .filter((source) => sourceIds.includes(source.sourceId))
    .map((source) => ({
      sourceId: source.sourceId,
      issuer: source.issuer,
      canonicalUri: source.canonicalUri,
      title: source.title,
      language: source.language,
      publishedAt: source.publishedAt,
      retrievedAt: source.retrievedAt,
      checksum: source.checksum,
      verificationState: source.verificationState,
      authoritative: source.authoritative,
    }));
}

export async function getRegulations(
  request: RequestBase &
    Readonly<{
      query: { limit?: string | number; cursor?: string; query?: string };
    }>,
): Promise<ApiResponse<unknown>> {
  const correlationId = requireReadAccess(request);
  if (!correlationId) return errorResponse(request.context, 403, "FORBIDDEN");
  let pagination;
  try {
    pagination = parsePagination(request.query);
  } catch {
    return errorResponse(request.context, 400, "BAD_REQUEST");
  }
  const corpus = projectPublishedCorpus(request.corpus);
  const page = listPublishedRegulations(corpus, {
    ...pagination,
    ...(request.query.query ? { query: request.query.query } : {}),
  });
  const items = page.items.map((item) => ({
    regulation: item.regulation,
    versions: item.versions.map((version) => ({
      ...version,
      sources: sourceDtos(corpus, version.sourceIds),
    })),
  }));
  auditRead(request, correlationId, "regulations");
  return {
    status: 200,
    body: {
      items,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    },
  };
}

export async function getRegulation(
  request: RequestBase & Readonly<{ regulationId: string }>,
): Promise<ApiResponse<unknown>> {
  const correlationId = requireReadAccess(request);
  if (!correlationId) return errorResponse(request.context, 403, "FORBIDDEN");
  const corpus = projectPublishedCorpus(request.corpus);
  try {
    const selected = selectPublishedRegulation(corpus, request.regulationId);
    auditRead(request, correlationId, request.regulationId);
    return {
      status: 200,
      body: {
        ...selected,
        versions: selected.versions.map((version) => ({
          ...version,
          sources: sourceDtos(corpus, version.sourceIds),
        })),
      },
    };
  } catch {
    return errorResponse(request.context, 404, "NOT_FOUND");
  }
}

export async function getProvision(
  request: RequestBase & Readonly<{ provisionId: string }>,
): Promise<ApiResponse<unknown>> {
  const correlationId = requireReadAccess(request);
  if (!correlationId) return errorResponse(request.context, 403, "FORBIDDEN");
  const corpus = projectPublishedCorpus(request.corpus);
  const provision = corpus.provisions.find(
    (item) => item.provisionId === request.provisionId,
  );
  if (!provision) return errorResponse(request.context, 404, "NOT_FOUND");
  const versions = corpus.provisionVersions.filter(
    (version) => version.provisionId === request.provisionId,
  );
  auditRead(request, correlationId, request.provisionId);
  return {
    status: 200,
    body: {
      provision,
      versions,
      citations: corpus.citations.filter((citation) =>
        versions.some((version) => version.citationId === citation.citationId),
      ),
    },
  };
}

export async function getRequirementVersions(
  request: RequestBase & Readonly<{ requirementId: string }>,
): Promise<ApiResponse<unknown>> {
  const correlationId = requireReadAccess(request);
  if (!correlationId) return errorResponse(request.context, 403, "FORBIDDEN");
  const corpus = projectPublishedCorpus(request.corpus);
  try {
    const versions = selectPublishedRequirementVersions(
      corpus,
      request.requirementId,
    );
    const requirement = corpus.requirements.find(
      (item) => item.requirementId === request.requirementId,
    );
    auditRead(request, correlationId, request.requirementId);
    return {
      status: 200,
      body: {
        requirement,
        versions,
        citations: corpus.citations.filter((citation) =>
          versions.some((version) =>
            version.citationIds.includes(citation.citationId),
          ),
        ),
      },
    };
  } catch {
    return errorResponse(request.context, 404, "NOT_FOUND");
  }
}
