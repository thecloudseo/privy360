import { randomUUID } from "node:crypto";

export interface ApiErrorResponse {
  readonly type: "about:blank";
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly correlationId: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export interface PaginationInput {
  readonly limit?: string | number;
  readonly cursor?: string;
}

export interface Pagination {
  readonly limit: number;
  readonly cursor?: string;
}

export type DtoValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly fieldErrors: Readonly<Record<string, string>>;
    };

const SAFE_CORRELATION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESERVED_FIELDS = new Set([
  "tenant_id",
  "actor_id",
  "created_by",
  "approved_by",
  "owner_id",
  "policy_override",
]);

export function createCorrelationId(candidate?: string): string {
  return candidate && SAFE_CORRELATION_ID.test(candidate)
    ? candidate
    : randomUUID();
}

export function createApiErrorResponse(
  error: unknown,
  options: {
    readonly correlationId?: string;
    readonly status?: 400 | 401 | 403 | 404 | 409 | 412 | 422 | 429 | 500;
    readonly code?: string;
    readonly fieldErrors?: Readonly<Record<string, string>>;
  } = {},
): ApiErrorResponse {
  const status = options.status ?? 500;
  const clientError = status < 500;
  return {
    type: "about:blank",
    title: clientError
      ? "Request could not be processed"
      : "Internal Server Error",
    status,
    code: options.code ?? (clientError ? "REQUEST_INVALID" : "INTERNAL_ERROR"),
    correlationId: createCorrelationId(options.correlationId),
    ...(options.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
  };
}

export function validateDto<T extends Record<string, unknown>>(
  input: Record<string, unknown>,
  allowedFields: readonly (keyof T & string)[],
): DtoValidationResult<T> {
  const allowed = new Set<string>(allowedFields);
  const fieldErrors: Record<string, string> = {};
  for (const field of Object.keys(input)) {
    if (RESERVED_FIELDS.has(field)) fieldErrors[field] = "FIELD_NOT_ALLOWED";
    else if (!allowed.has(field)) fieldErrors[field] = "FIELD_NOT_ALLOWED";
  }
  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, value: input as T };
}

export function parsePagination(input: PaginationInput): Pagination {
  const rawLimit = input.limit ?? 25;
  const limit = typeof rawLimit === "number" ? rawLimit : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("limit must be an integer from 1 to 100");
  }
  if (
    input.cursor !== undefined &&
    (input.cursor.length === 0 || input.cursor.length > 2048)
  ) {
    throw new RangeError("cursor is invalid");
  }
  return {
    limit,
    ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
  };
}

export function isRoutePermissionAllowed(
  permission: string,
  registry: ReadonlyMap<string, boolean>,
): boolean {
  return registry.get(permission) === true;
}
