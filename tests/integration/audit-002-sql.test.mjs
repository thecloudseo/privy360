import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { URL } from "node:url";

const up = await readFile(
  new URL(
    "../../packages/database/migrations/0004_audit_delivery.up.sql",
    import.meta.url,
  ),
  "utf8",
);
const down = await readFile(
  new URL(
    "../../packages/database/migrations/0004_audit_delivery.down.sql",
    import.meta.url,
  ),
  "utf8",
);

test("delivery migration owns inbox, work items and dead-letter state", () => {
  for (const table of ["inbox_receipts", "work_items"])
    assert.match(
      up,
      new RegExp(`create table( if not exists)? audit\\.${table}`, "i"),
    );
  assert.match(up, /unique\s*\(scope, tenant_id, consumer, event_id\)/i);
  assert.match(up, /dead_letter/i);
  assert.match(up, /enable row level security/i);
  assert.match(up, /correlation_id/i);
  assert.match(up, /causation_id/i);
});

test("delivery rollback is audit-owned", () => {
  assert.match(down, /drop table if exists audit\.work_items/i);
  assert.match(down, /drop table if exists audit\.inbox_receipts/i);
  assert.doesNotMatch(down, /tenant|regulatory|identity/i);
});
