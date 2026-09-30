import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("required verification jobs are declared", () => {
  const workflow = readFileSync(".github/workflows/foundation.yml", "utf8");
  for (const job of [
    "quality",
    "playwright",
    "semgrep",
    "codeql",
    "trivy",
    "gitleaks",
    "dependency-audit",
    "checkov",
    "sbom",
  ]) {
    assert.match(workflow, new RegExp(`^  ${job}:$`, "m"));
  }
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /pnpm audit --audit-level high/);
  assert.match(workflow, /verify-gitleaks-fixture/);
  assert.match(workflow, /verify-audit-fixture/);
  assert.match(workflow, /semgrep scan --config p\/security-audit --error/);
  assert.match(workflow, /assert-sarif-clean/);
  assert.match(workflow, /exit-code: "1"/);
  assert.match(workflow, /sha256sum -c -/);
  assert.match(workflow, /format: cyclonedx-json/);
  for (const match of workflow.matchAll(/uses: ([^\s]+)/g)) {
    assert.match(match[1], /@[0-9a-f]{40}$/);
  }
});
