import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";

const up = await readFile(
  new URL(
    "../../packages/database/migrations/0006_atomic_controls.up.sql",
    import.meta.url,
  ),
  "utf8",
);
const down = await readFile(
  new URL(
    "../../packages/database/migrations/0006_atomic_controls.down.sql",
    import.meta.url,
  ),
  "utf8",
);

test("atomic-control migration creates bounded compliance tables and tenant isolation", () => {
  for (const table of [
    "control_templates",
    "controls",
    "control_mappings",
    "obligations",
    "obligation_controls",
    "evidence_requirements",
  ]) {
    assert.match(
      up,
      new RegExp(
        `create table( if not exists)? (global_compliance|compliance)\\.${table}`,
        "i",
      ),
    );
  }
  assert.match(
    up,
    /row level security|tenant_id.*current_setting|tenant_isolation/i,
  );
  assert.match(up, /requirement_version_id/);
  assert.match(up, /citation_id|source_ref|applicability_rule/);
});

test("atomic-control rollback is bounded", () => {
  assert.match(down, /drop table if exists compliance\.evidence_requirements/i);
  assert.match(down, /drop schema if exists compliance cascade/i);
  assert.doesNotMatch(down, /drop schema if exists regulatory|tenant|audit/i);
});
