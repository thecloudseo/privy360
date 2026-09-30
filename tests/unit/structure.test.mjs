import { test } from "node:test";
import { execFileSync } from "node:child_process";

test("repository paths and baseline remain intact", () => {
  execFileSync("node", ["scripts/check-structure.mjs"]);
});
