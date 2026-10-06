import { createHash } from "node:crypto";
import { createApiErrorResponse, parsePagination } from "@privy360/api-common";

export type AuditReadScope = "TENANT" | "GLOBAL_CORPUS";
export type AuditResult = "SUCCESS" | "FAILURE" | "DENIED";

export type TrustedAuditReadContext = Readonly<{
  scope: AuditReadScope;
  tenantId?: string;
  actorId: string;
  permissions: ReadonlySet<string>;
  correlationId: string;
}>;

export type AuditEventQuery = Readonly<{
  scope: AuditReadScope;
  tenantId?: string;
  limit: number;
  cursor?: string;
  filters: {
    action?: string;
    resourceType?: string;
    result?: AuditResult;
    actorKind?: string;
    occurredFrom?: string;
    occurredTo?: string;
    streamId?: string;
  };
}>;

export type AuditEventRecord = Readonly<{
  eventId: string;
  scope: AuditReadScope;
  tenantId?: string;
  sequence: string;
  actor: Readonly<{ id: string; kind: string }>;
  action: string;
  resourceType: string;
  resourceId: string;
  result: AuditResult;
  occurredAt: string;
  recordedAt: string;
  correlationId: string;
  causationId?: string;
  policyDecisionId?: string;
  streamId?: string;
  changedFieldNames: readonly string[];
  beforeDigest?: string;
  afterDigest?: string;
  integrityStatus?: "CHAIN_VERIFIED" | "ANCHOR_VERIFIED" | "UNVERIFIED";
  payload?: unknown;
}>;

export type AuditEventSummary = Omit<AuditEventRecord, "payload">;
export type AuditEventPage = Readonly<{
  items: readonly AuditEventSummary[];
  nextCursor?: string;
  scope: AuditReadScope;
  tenantId?: string;
}>;

export interface AuditEventReader {
  read(query: AuditEventQuery): Promise<readonly AuditEventRecord[]>;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;
const SAFE_CURSOR = /^[A-Za-z0-9_-]{1,2048}$/;
const ALLOWED = new Set([
  "limit",
  "cursor",
  "action",
  "resourceType",
  "result",
  "actorKind",
  "occurredFrom",
  "occurredTo",
  "streamId",
]);

function fail(
  status: 400 | 403 | 500,
  code: string,
  correlationId: string,
  fieldErrors?: Record<string, string>,
): never {
  const response = createApiErrorResponse(new Error(code), {
    status,
    code,
    correlationId,
    ...(fieldErrors ? { fieldErrors } : {}),
  });
  const error = new Error(
    `${response.code}${fieldErrors ? `:${Object.keys(fieldErrors).join(",")}` : ""}`,
  );
  Object.assign(error, response);
  throw error;
}

function assertUuid(
  value: string | undefined,
  label: string,
  correlationId: string,
): void {
  if (!value || !UUID.test(value))
    fail(403, "FORBIDDEN", correlationId, { [label]: "SCOPE_REQUIRED" });
}

function cursorDigest(query: AuditEventQuery): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        scope: query.scope,
        tenantId: query.tenantId,
        filters: query.filters,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}

function makeCursor(offset: number, query: AuditEventQuery): string {
  return Buffer.from(
    JSON.stringify({ offset, digest: cursorDigest(query) }),
    "utf8",
  ).toString("base64url");
}

function readCursor(cursor: string, query: AuditEventQuery): number {
  if (!SAFE_CURSOR.test(cursor))
    fail(
      400,
      "REQUEST_INVALID",
      query.tenantId ?? "00000000-0000-4000-8000-000000000000",
      { cursor: "INVALID" },
    );
  try {
    const value = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { offset?: number; digest?: string };
    const offset = value.offset;
    if (
      value.digest !== cursorDigest(query) ||
      typeof offset !== "number" ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    )
      throw new Error("cursor");
    return offset;
  } catch {
    fail(
      400,
      "REQUEST_INVALID",
      query.tenantId ?? "00000000-0000-4000-8000-000000000000",
      { cursor: "INVALID" },
    );
  }
}

function validateInput(
  context: TrustedAuditReadContext,
  input: Record<string, unknown>,
): { limit: number; cursor?: string; filters: AuditEventQuery["filters"] } {
  if (!UUID.test(context.correlationId) || !UUID.test(context.actorId))
    fail(403, "FORBIDDEN", context.correlationId);
  if (!context.permissions.has("audit.events.read"))
    fail(403, "FORBIDDEN", context.correlationId);
  if (context.scope === "TENANT")
    assertUuid(context.tenantId, "tenantId", context.correlationId);
  else if (context.tenantId) fail(403, "FORBIDDEN", context.correlationId);
  const unknown = Object.keys(input).filter((key) => !ALLOWED.has(key));
  if (unknown.length)
    fail(
      400,
      "REQUEST_INVALID",
      context.correlationId,
      Object.fromEntries(unknown.map((key) => [key, "FIELD_NOT_ALLOWED"])),
    );
  let pagination;
  try {
    pagination = parsePagination({
      ...(input.limit !== undefined
        ? { limit: input.limit as string | number }
        : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor as string } : {}),
    });
  } catch {
    fail(400, "REQUEST_INVALID", context.correlationId, { limit: "INVALID" });
  }
  const filters: AuditEventQuery["filters"] = {};
  for (const key of [
    "action",
    "resourceType",
    "actorKind",
    "streamId",
    "occurredFrom",
    "occurredTo",
  ] as const) {
    const value = input[key];
    if (value !== undefined) {
      if (
        typeof value !== "string" ||
        !value ||
        (key !== "occurredFrom" &&
          key !== "occurredTo" &&
          !SAFE_NAME.test(value))
      )
        fail(400, "REQUEST_INVALID", context.correlationId, {
          [key]: "INVALID",
        });
      filters[key] = value;
    }
  }
  if (
    input.result !== undefined &&
    input.result !== "SUCCESS" &&
    input.result !== "FAILURE" &&
    input.result !== "DENIED"
  )
    fail(400, "REQUEST_INVALID", context.correlationId, { result: "INVALID" });
  if (input.result !== undefined) filters.result = input.result as AuditResult;
  return {
    limit: pagination!.limit,
    ...(pagination!.cursor ? { cursor: pagination!.cursor } : {}),
    filters,
  };
}

function project(
  event: AuditEventRecord,
  context: TrustedAuditReadContext,
): AuditEventSummary {
  if (event.scope !== context.scope || event.tenantId !== context.tenantId)
    fail(403, "FORBIDDEN", context.correlationId, { scope: "MISMATCH" });
  return Object.fromEntries(
    Object.entries(event).filter(([key]) => key !== "payload"),
  ) as AuditEventSummary;
}

export async function queryAuditEvents(
  reader: AuditEventReader,
  context: TrustedAuditReadContext,
  input: Record<string, unknown>,
): Promise<AuditEventPage> {
  const validated = validateInput(context, input);
  const query: AuditEventQuery = {
    scope: context.scope,
    ...(context.tenantId ? { tenantId: context.tenantId } : {}),
    limit: validated.limit,
    ...(validated.cursor ? { cursor: validated.cursor } : {}),
    filters: validated.filters,
  };
  let records: readonly AuditEventRecord[];
  try {
    records = await reader.read(query);
  } catch {
    fail(500, "INTERNAL_ERROR", context.correlationId);
  }
  const offset = validated.cursor ? readCursor(validated.cursor, query) : 0;
  const page = records
    .slice(offset, offset + validated.limit + 1)
    .map((event) => project(event, context));
  const hasNext = page.length > validated.limit;
  return {
    items: hasNext ? page.slice(0, validated.limit) : page,
    ...(hasNext
      ? { nextCursor: makeCursor(offset + validated.limit, query) }
      : {}),
    scope: context.scope,
    ...(context.tenantId ? { tenantId: context.tenantId } : {}),
  };
}

export function createAuditIntegritySummary(input: {
  anchorStatus?: string;
  lastVerifiedAt?: string;
}): Readonly<{
  status: "ANCHOR_VERIFIED" | "CHAIN_VERIFIED" | "UNVERIFIED";
  lastVerifiedAt?: string;
}> {
  const status =
    input.anchorStatus === "ANCHOR_VERIFIED"
      ? "ANCHOR_VERIFIED"
      : input.anchorStatus === "CHAIN_VERIFIED"
        ? "CHAIN_VERIFIED"
        : "UNVERIFIED";
  return {
    status,
    ...(input.lastVerifiedAt ? { lastVerifiedAt: input.lastVerifiedAt } : {}),
  };
}
