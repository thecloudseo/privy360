import assert from "node:assert/strict";
import test from "node:test";
import { queryAuditEvents } from "../../packages/audit/src/query.ts";

test("query reader receives only authorized bounded query data", async () => {
  let received;
  const tenant = "11111111-1111-4111-8111-111111111111";
  await queryAuditEvents(
    {
      read: async (query) => {
        received = query;
        return [];
      },
    },
    {
      scope: "TENANT",
      tenantId: tenant,
      actorId: tenant,
      permissions: new Set(["audit.events.read"]),
      correlationId: tenant,
    },
    { limit: 10, result: "DENIED" },
  );
  assert.deepEqual(received, {
    scope: "TENANT",
    tenantId: tenant,
    limit: 10,
    filters: { result: "DENIED" },
  });
});

test("audit query is read-only and does not expose integrity internals", async () => {
  const tenant = "11111111-1111-4111-8111-111111111111";
  const result = await queryAuditEvents(
    { read: async () => [] },
    {
      scope: "TENANT",
      tenantId: tenant,
      actorId: tenant,
      permissions: new Set(["audit.events.read"]),
      correlationId: tenant,
    },
    {},
  );
  assert.deepEqual(result, { items: [], scope: "TENANT", tenantId: tenant });
});
