import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { URL } from "node:url";

const up = await readFile(
  new URL(
    "../../packages/database/migrations/0007_audit_integrity.up.sql",
    import.meta.url,
  ),
  "utf8",
);
const down = await readFile(
  new URL(
    "../../packages/database/migrations/0007_audit_integrity.down.sql",
    import.meta.url,
  ),
  "utf8",
);

test("integrity migration owns append-only tenant and platform anchors", () => {
  assert.match(up, /create table if not exists audit\.audit_anchors/i);
  assert.match(
    up,
    /create table if not exists platform_audit\.platform_audit_anchors/i,
  );
  assert.match(up, /canonicalization_version/i);
  assert.match(up, /key_ref/i);
  assert.match(up, /signature/i);
  assert.match(up, /enable row level security/i);
  assert.match(up, /before update or delete/i);
  assert.match(up, /AUDIT-003-SQL-V1/);
});

test("integrity rollback is bounded", () => {
  assert.match(down, /drop table if exists audit\.audit_anchors/i);
  assert.match(
    down,
    /drop table if exists platform_audit\.platform_audit_anchors/i,
  );
  assert.doesNotMatch(
    down,
    /drop schema|audit_events|outbox_events|tenant|identity/i,
  );
});
