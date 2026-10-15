import { describe, expect, it, vi } from "vitest";
import { ConsentApiError, createConsentApi } from "./consent-api.ts";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const input = {
  dataPrincipalId: "principal-123",
  purpose: "marketing",
  grantConsent: true,
} as const;

describe("createConsentApi.create", () => {
  it("posts the contract body same-origin with no bearer token or tenant id", async () => {
    const fetchMock = vi
      .fn<(url: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        jsonResponse(201, { id: "c-1", principalId: "principal-123" }),
      );
    const api = createConsentApi(fetchMock);

    const created = await api.create(input);

    expect(created).toMatchObject({ id: "c-1" });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/consents");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("same-origin");
    const headers = init?.headers as Record<string, string>;
    expect(headers).not.toHaveProperty("authorization");
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it.each([
    [400, "validation"],
    [401, "unauthenticated"],
    [403, "forbidden"],
    [409, "duplicate"],
    [500, "unavailable"],
  ] as const)("maps HTTP %i to %s", async (status, kind) => {
    const api = createConsentApi(
      vi.fn().mockResolvedValue(jsonResponse(status, { error: "x" })),
    );
    await expect(api.create(input)).rejects.toMatchObject({ kind });
  });

  it("maps a network failure to unavailable without exposing the cause", async () => {
    const api = createConsentApi(
      vi
        .fn()
        .mockRejectedValue(new TypeError("socket hang up to internal-host")),
    );
    const error = await api.create(input).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConsentApiError);
    expect((error as ConsentApiError).kind).toBe("unavailable");
    expect((error as Error).message).not.toContain("internal-host");
  });

  it("keeps only known field names from server validation details", async () => {
    const api = createConsentApi(
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          error: "Validation failed",
          details: { purpose: "Invalid enum value", tenantId: "leak" },
        }),
      ),
    );
    const error = (await api
      .create(input)
      .catch((caught: unknown) => caught)) as ConsentApiError;
    expect(error.fields).toEqual(["purpose"]);
  });
});

describe("createConsentApi.list", () => {
  it("returns the items envelope", async () => {
    const api = createConsentApi(
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 }),
        ),
    );
    await expect(api.list()).resolves.toMatchObject({ total: 0, items: [] });
  });

  it("treats a malformed success body as unavailable", async () => {
    const api = createConsentApi(
      vi.fn().mockResolvedValue(jsonResponse(200, { unexpected: true })),
    );
    await expect(api.list()).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps 403 to forbidden", async () => {
    const api = createConsentApi(
      vi.fn().mockResolvedValue(jsonResponse(403, { error: "Forbidden" })),
    );
    await expect(api.list()).rejects.toMatchObject({ kind: "forbidden" });
  });
});
