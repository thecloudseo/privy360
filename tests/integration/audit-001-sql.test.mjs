import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { URL } from "node:url";

const up = await readFile(
  new URL(
    "../../packages/database/migrations/0002_audit_foundation.up.sql",
    import.meta.url,
  ),
  "utf8",
);
const down = await readFile(
  new URL(
    "../../packages/database/migrations/0002_audit_foundation.down.sql",
    import.meta.url,
  ),
  "utf8",
);

test("audit migration establishes tenant/platform streams and durable outbox", () => {
  for (const table of [
    "audit_streams",
    "audit_events",
    "platform_audit_streams",
    "platform_audit_events",
    "outbox_events",
    "idempotency_records",
  ])
    assert.match(
      up,
      new RegExp(`create table( if not exists)? [a-z_]+\\.${table}`, "i"),
    );
  assert.match(up, /tenant_id\s+uuid\s+not null/i);
  assert.match(up, /correlation_id\s+uuid\s+not null/i);
  assert.match(up, /unique\s*\(stream_id, sequence\)/i);
  assert.match(up, /previous_hash/i);
  assert.match(up, /event_hash/i);
  assert.match(up, /for update|update audit\.audit_streams/i);
  assert.match(up, /digest\(/i);
  assert.match(up, /create unique index.*idempotency/i);
});

test("audit migration protects immutability and runtime role boundaries", () => {
  assert.match(up, /enable row level security/i);
  assert.match(up, /force row level security/i);
  assert.match(up, /revoke\s+(update|delete).*audit/i);
  assert.match(up, /trigger.*append|append.*trigger/i);
  assert.match(
    up,
    /if exists \(select 1 from pg_roles where rolname = 'privy360_app'\)/i,
  );
  assert.match(up, /payload.*password|prohibited/i);
});

test("audit rollback is bounded to audit-owned schemas and objects", () => {
  assert.match(down, /drop schema if exists audit cascade/i);
  assert.match(down, /drop schema if exists platform_audit cascade/i);
  assert.doesNotMatch(
    down.replace(/^--.*$/gm, ""),
    /tenant|regulatory|identity/i,
  );
});
