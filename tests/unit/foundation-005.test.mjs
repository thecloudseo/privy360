import assert from "node:assert/strict";
import test from "node:test";

import {
  createApiErrorResponse,
  createCorrelationId,
  parsePagination,
  validateDto,
  isRoutePermissionAllowed,
} from "../../packages/api-common/src/index.ts";

test("creates a non-disclosing error response with correlation id", () => {
  const response = createApiErrorResponse(new Error("secret token=abc"), {
    correlationId: "550e8400-e29b-41d4-a716-446655440000",
  });

  assert.deepEqual(response, {
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    code: "INTERNAL_ERROR",
    correlationId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.doesNotMatch(JSON.stringify(response), /secret|abc/);
});

test("generates a fresh correlation id for unsafe input", () => {
  const id = createCorrelationId("not a correlation id");
  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("validates DTOs and rejects caller-controlled security fields", () => {
  assert.deepEqual(validateDto({ name: "Synthetic" }, ["name"]), {
    ok: true,
    value: { name: "Synthetic" },
  });
  const result = validateDto({ name: "Synthetic", tenant_id: "tenant" }, [
    "name",
  ]);
  assert.equal(result.ok, false);
  if (!result.ok)
    assert.equal(result.fieldErrors.tenant_id, "FIELD_NOT_ALLOWED");
});

test("parses bounded pagination with a safe default", () => {
  assert.deepEqual(parsePagination({}), { limit: 25 });
  assert.deepEqual(parsePagination({ limit: "100", cursor: "opaque" }), {
    limit: 100,
    cursor: "opaque",
  });
  assert.throws(() => parsePagination({ limit: "101" }), /limit/);
  assert.throws(() => parsePagination({ cursor: "x".repeat(2049) }), /cursor/);
});

test("denies unknown permissions and allows only explicitly registered routes", () => {
  const registered = new Map([["health.read", true]]);
  assert.equal(isRoutePermissionAllowed("unknown.route", registered), false);
  assert.equal(isRoutePermissionAllowed("health.read", registered), true);
  registered.set("disabled.route", false);
  assert.equal(isRoutePermissionAllowed("disabled.route", registered), false);
});
