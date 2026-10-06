import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";

const up = await readFile(
  new URL(
    "../../packages/database/migrations/0009_regulatory_publication.up.sql",
    import.meta.url,
  ),
  "utf8",
);
const down = await readFile(
  new URL(
    "../../packages/database/migrations/0009_regulatory_publication.down.sql",
    import.meta.url,
  ),
  "utf8",
);

test("publication migration is global, attributed, supersession-aware and immutable", () => {
  assert.match(up, /CREATE TABLE regulatory\.regulatory_reviews/);
  assert.match(up, /reviewer_ref/);
  assert.match(up, /publisher_ref/);
  assert.match(up, /supersedes_manifest_id/);
  assert.match(
    up,
    /CHECK \(state IN \('DRAFT',\s*'REVIEWED',\s*'PUBLISHED',\s*'SUPERSEDED'\)\)/,
  );
  assert.match(up, /published regulatory manifests are immutable/i);
  assert.doesNotMatch(up, /tenant_id/);
  assert.match(down, /DROP TABLE IF EXISTS regulatory\.regulatory_reviews/);
});
