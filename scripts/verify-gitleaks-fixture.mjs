import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const fixture = ".ci-fixture/gitleaks";
mkdirSync(fixture, { recursive: true });
try {
  const marker = ["AK", "IA"].join("") + "1234567890ABCDEF";
  writeFileSync(`${fixture}/synthetic.txt`, `synthetic_access_key=${marker}\n`);
  const localArgs = [
    "dir",
    "--redact",
    "--report-format",
    "json",
    "--report-path",
    `${fixture}/report.json`,
    `${fixture}/synthetic.txt`,
  ];
  const result = spawnSync(process.env.GITLEAKS_BIN ?? "gitleaks", localArgs, {
    encoding: "utf8",
    timeout: 60000,
  });
  if (result.error) throw result.error;
  if (result.status !== 1)
    throw new Error(
      `Gitleaks did not reject the canary (exit ${result.status})`,
    );
  const findings = JSON.parse(readFileSync(`${fixture}/report.json`, "utf8"));
  if (!Array.isArray(findings) || findings.length === 0)
    throw new Error("Gitleaks returned no canary finding");
  process.stdout.write("Gitleaks synthetic secret rejected\n");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
