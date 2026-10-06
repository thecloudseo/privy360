import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { URL } from "node:url";
import {
  TenantContextDeniedError,
  createTrustedTenantContext,
  withTenantTransaction,
} from "../../packages/security/src/index.ts";

const ids = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  actorId: "22222222-2222-4222-8222-222222222222",
  membershipId: "33333333-3333-4333-8333-333333333333",
};
const context = createTrustedTenantContext({
  ...ids,
  source: "SESSION",
  verified: true,
});

test("trusted context rejects malformed or unverified tenant selection", () => {
  assert.throws(
    () =>
      createTrustedTenantContext({
        ...ids,
        tenantId: "other",
        source: "SESSION",
        verified: true,
      }),
    TenantContextDeniedError,
  );
  assert.throws(
    () =>
      createTrustedTenantContext({
        ...ids,
        source: "SESSION",
        verified: false,
      }),
    TenantContextDeniedError,
  );
});

test("missing context fails before transaction and context is transaction-local", async () => {
  let transactions = 0;
  await assert.rejects(
    () =>
      withTenantTransaction(
        {
          transaction: async () => {
            transactions += 1;
            return true;
          },
        },
        undefined,
        async () => true,
      ),
    TenantContextDeniedError,
  );
  assert.equal(transactions, 0);
  const queries = [];
  const fakeTx = {
    query: async (sql, parameters) => {
      queries.push({ sql, parameters });
    },
  };
  await assert.rejects(
    () =>
      withTenantTransaction(
        {
          transaction: async (work) => {
            transactions += 1;
            return work(fakeTx);
          },
        },
        context,
        async (tx) => {
          await tx.query("select 1", []);
          throw new Error("business failure");
        },
      ),
    /business failure/,
  );
  assert.equal(queries.length, 2);
  assert.match(
    queries[0].sql,
    /set_config\('privy360\.tenant_id', \$1, true\)/,
  );
  assert.deepEqual(queries[0].parameters, [context.tenantId]);
});

test("mismatched nested tenant context is denied", async () => {
  const other = createTrustedTenantContext({
    ...ids,
    tenantId: "44444444-4444-4444-8444-444444444444",
    source: "WORKER",
    verified: true,
  });
  await assert.rejects(
    () =>
      withTenantTransaction(
        { transaction: async () => true },
        other,
        async () => true,
        context,
      ),
    TenantContextDeniedError,
  );
});

test("fixture preserves composite tenant FK and RLS boundary", async () => {
  const sql = await readFile(
    new URL("../../tests/tenancy/fixtures/tenant-context.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /foreign key\s*\(tenant_id, resource_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /with check/i);
  assert.match(sql, /tenant_id cannot be changed/i);
  assert.match(sql, /nobypassrls/i);
});
