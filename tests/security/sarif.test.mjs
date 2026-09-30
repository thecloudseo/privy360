import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("CodeQL result gate rejects a synthetic finding", () => {
  const clean = spawnSync(
    "node",
    ["scripts/assert-sarif-clean.mjs", "tests/security/fixtures/clean"],
    { encoding: "utf8" },
  );
  const finding = spawnSync(
    "node",
    ["scripts/assert-sarif-clean.mjs", "tests/security/fixtures/finding"],
    { encoding: "utf8" },
  );
  assert.equal(clean.status, 0);
  assert.notEqual(finding.status, 0);
});
