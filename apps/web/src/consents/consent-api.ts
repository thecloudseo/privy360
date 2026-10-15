import {
  type ConsentField,
  type ConsentListResponse,
  type Consent,
  type CreateConsentInput,
} from "./consent-contract.ts";

/**
 * Failure categories the UI is allowed to distinguish. Authorization failures
 * collapse into one "forbidden" kind so the reason for a denial is never shown.
 */
export type ConsentApiErrorKind =
  "validation" | "unauthenticated" | "forbidden" | "duplicate" | "unavailable";

export class ConsentApiError extends Error {
  readonly kind: ConsentApiErrorKind;
  readonly fields: readonly ConsentField[];

  constructor(kind: ConsentApiErrorKind, fields: readonly ConsentField[] = []) {
    super(kind);
    this.name = "ConsentApiError";
    this.kind = kind;
    this.fields = fields;
  }
}

export type ConsentApi = Readonly<{
  list(): Promise<ConsentListResponse>;
  create(input: CreateConsentInput): Promise<Consent>;
}>;

// Same-origin BFF path (ADR-002): the session cookie authenticates the request
// and the server resolves tenant context. No bearer token is held in the browser.
const CONSENTS_PATH = "/api/v1/consents";

const KNOWN_FIELDS: readonly ConsentField[] = [
  "dataPrincipalId",
  "purpose",
  "grantConsent",
];

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type RequestSpec = Readonly<{
  method: "GET" | "POST";
  headers?: Readonly<Record<string, string>>;
  body?: string;
}>;

async function send(
  fetchImpl: FetchLike,
  path: string,
  spec: RequestSpec,
): Promise<Response> {
  try {
    return await fetchImpl(path, {
      ...spec,
      credentials: "same-origin",
      cache: "no-store",
      headers: { accept: "application/json", ...spec.headers },
    });
  } catch {
    throw new ConsentApiError("unavailable");
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function fieldsFromDetails(body: unknown): ConsentField[] {
  if (typeof body !== "object" || body === null || !("details" in body)) {
    return [];
  }
  const details = (body as { details: unknown }).details;
  if (typeof details !== "object" || details === null) return [];
  return KNOWN_FIELDS.filter((field) => field in details);
}

async function failureFor(response: Response): Promise<ConsentApiError> {
  switch (response.status) {
    case 400:
      return new ConsentApiError(
        "validation",
        fieldsFromDetails(await readJson(response)),
      );
    case 401:
      return new ConsentApiError("unauthenticated");
    case 403:
      return new ConsentApiError("forbidden");
    case 409:
      return new ConsentApiError("duplicate");
    default:
      return new ConsentApiError("unavailable");
  }
}

function isConsentListResponse(body: unknown): body is ConsentListResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { items?: unknown }).items)
  );
}

export function createConsentApi(fetchImpl: FetchLike = fetch): ConsentApi {
  return {
    async list() {
      const response = await send(fetchImpl, CONSENTS_PATH, { method: "GET" });
      if (!response.ok) throw await failureFor(response);
      const body = await readJson(response);
      if (!isConsentListResponse(body))
        throw new ConsentApiError("unavailable");
      return body;
    },

    async create(input) {
      const response = await send(fetchImpl, CONSENTS_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataPrincipalId: input.dataPrincipalId,
          purpose: input.purpose,
          grantConsent: input.grantConsent,
        }),
      });
      if (!response.ok) throw await failureFor(response);
      const body = await readJson(response);
      if (typeof body !== "object" || body === null) {
        throw new ConsentApiError("unavailable");
      }
      return body as Consent;
    },
  };
}
