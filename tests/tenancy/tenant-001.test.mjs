import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { URL } from "node:url";

const up = await readFile(
  new URL(
    "../../packages/database/migrations/0001_tenant_foundation.up.sql",
    import.meta.url,
  ),
  "utf8",
);
const down = await readFile(
  new URL(
    "../../packages/database/migrations/0001_tenant_foundation.down.sql",
    import.meta.url,
  ),
  "utf8",
);

test("tenant foundation owns the platform registry and tenant hierarchy", () => {
  for (const table of [
    "platform.tenants",
    "platform.deployments",
    "tenant.organisations",
    "tenant.legal_entities",
    "tenant.business_units",
    "tenant.departments",
    "tenant.actor_refs",
    "tenant.resource_registry",
  ])
    assert.match(
      up,
      new RegExp(
        `create table( if not exists)? ${table.replace(".", "\\.")}`,
        "i",
      ),
    );

  assert.match(up, /uuidv7/i);
  assert.match(up, /tenant_id\s+uuid\s+not null/i);
  assert.match(up, /foreign key\s*\(tenant_id, legal_entity_id\)/i);
  assert.match(up, /enable row level security/i);
  assert.match(up, /force row level security/i);
  assert.match(up, /nobypassrls/i);
  assert.match(up, /security definer/i);
});

test("tenant foundation rejects hierarchy ambiguity and cycles", () => {
  assert.match(up, /check_business_unit_hierarchy/i);
  assert.match(up, /parent_id\s+is null\s+or\s+parent_id\s*<>\s*id/i);
  assert.match(up, /legal_entity_id.*parent_id|parent_id.*legal_entity_id/is);
  assert.match(up, /while cursor_id is not null/i);
});

test("bootstrap actors are restricted and ordinary app roles cannot own or bypass", () => {
  assert.match(up, /actor_kind.*bootstrap/i);
  assert.match(up, /provision_bootstrap_actor/i);
  assert.match(
    up,
    /revoke all on all tables in schema tenant from privy360_app/i,
  );
  assert.match(
    up,
    /alter role privy360_app\s+nosuperuser\s+nocreatedb\s+nocreaterole\s+nobypassrls/i,
  );
  assert.doesNotMatch(up, /grant privy360_app bypassrls/i);
});

test("upgrade and rollback artifacts are bounded to this migration", () => {
  assert.match(up, /0001_tenant_foundation/i);
  assert.match(down, /drop schema( if exists)? tenant cascade/i);
  assert.match(down, /drop schema( if exists)? platform cascade/i);
  assert.doesNotMatch(down, /drop schema public/i);
  assert.doesNotMatch(
    down.replace(/^--.*$/gm, ""),
    /audit|regulatory|identity/i,
  );
});
