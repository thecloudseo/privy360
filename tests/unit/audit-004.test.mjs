import assert from "node:assert/strict";
import test from "node:test";
import { queryAuditEvents } from "../../packages/audit/src/query.ts";

const tenant = "11111111-1111-4111-8111-111111111111";
const event = {
  eventId: tenant,
  tenantId: tenant,
  scope: "TENANT",
  sequence: "7",
  actor: { id: tenant, kind: "USER" },
  action: "RIGHTS_REQUEST_SUBMITTED",
  resourceType: "rights_request",
  resourceId: tenant,
  result: "SUCCESS",
  occurredAt: "2026-10-07T10:00:00.000Z",
  recordedAt: "2026-10-07T10:00:01.000Z",
  correlationId: tenant,
  causationId: tenant,
  changedFieldNames: ["state"],
  beforeDigest: "before",
  afterDigest: "after",
  payload: { principalEmail: "must-not-leak" },
};

const context = {
  scope: "TENANT",
  tenantId: tenant,
  actorId: tenant,
  permissions: new Set(["audit.events.read"]),
  correlationId: tenant,
};

test("returns a redacted bounded audit page for an authorized tenant", async () => {
  const result = await queryAuditEvents(
    { read: async () => [event] },
    context,
    { limit: 25, action: "RIGHTS_REQUEST_SUBMITTED" },
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].action, event.action);
  assert.equal("payload" in result.items[0], false);
  assert.equal("beforeDigest" in result.items[0], true);
});

test("denies missing permission and caller-controlled tenant fields", async () => {
  await assert.rejects(
    () =>
      queryAuditEvents(
        { read: async () => [event] },
        { ...context, permissions: new Set() },
        {},
      ),
    /forbidden/i,
  );
  await assert.rejects(
    () =>
      queryAuditEvents({ read: async () => [event] }, context, {
        tenantId: tenant,
      }),
    /field|tenant/i,
  );
});

test("rejects unsafe filters, bounds and cross-scope records", async () => {
  await assert.rejects(
    () =>
      queryAuditEvents({ read: async () => [event] }, context, { limit: 101 }),
    /limit/i,
  );
  await assert.rejects(
    () =>
      queryAuditEvents({ read: async () => [event] }, context, {
        sort: "raw_sql",
      }),
    /field|filter|sort/i,
  );
  await assert.rejects(
    () =>
      queryAuditEvents(
        {
          read: async () => [
            { ...event, tenantId: "22222222-2222-4222-8222-222222222222" },
          ],
        },
        context,
        {},
      ),
    /scope|tenant/i,
  );
});

test("repository failures become safe correlated errors", async () => {
  await assert.rejects(
    () =>
      queryAuditEvents(
        {
          read: async () => {
            throw new Error("postgres password=secret");
          },
        },
        context,
        {},
      ),
    (error) =>
      error.code === "INTERNAL_ERROR" &&
      error.correlationId === tenant &&
      !error.message.includes("secret"),
  );
});
