import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
const up = await readFile(
  new URL(
    "../../packages/database/migrations/0005_regulatory_intake.up.sql",
    import.meta.url,
  ),
  "utf8",
);
const down = await readFile(
  new URL(
    "../../packages/database/migrations/0005_regulatory_intake.down.sql",
    import.meta.url,
  ),
  "utf8",
);
test("intake migration is global, quarantined, deduplicated and bounded", () => {
  assert.match(up, /CREATE TABLE regulatory\.source_imports/);
  assert.match(up, /UNIQUE \(manifest_digest\)/);
  assert.match(up, /QUARANTINED/);
  assert.doesNotMatch(up, /tenant_id/);
  assert.match(down, /DROP TABLE IF EXISTS regulatory\.source_imports/);
});
