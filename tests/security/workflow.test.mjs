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
    "container-images",
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
  assert.match(workflow, /scan-type: image/);
  const productionImageJob =
    workflow.split("  container-images:")[1]?.split("\n  gitleaks:")[0] ?? "";
  assert.match(productionImageJob, /severity: HIGH,CRITICAL/);
  assert.match(productionImageJob, /exit-code: "1"/);
  assert.doesNotMatch(
    productionImageJob,
    /local-image-evidence|dispositions\.json|ignore-unfixed|continue-on-error/,
  );
  assert.match(workflow, /pnpm check:production-boundary/);
  const images = JSON.parse(
    readFileSync("infra/docker/security/images.json", "utf8"),
  ).images;
  for (const image of new Set(Object.values(images).map((item) => item.image)))
    assert.ok(
      workflow.includes(image),
      `Missing immutable scan image: ${image}`,
    );
  for (const match of workflow.matchAll(/uses: ([^\s]+)/g)) {
    assert.match(match[1], /@[0-9a-f]{40}$/);
  }
});
