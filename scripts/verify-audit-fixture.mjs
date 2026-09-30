import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const fixture = ".ci-fixture/audit";
mkdirSync(fixture, { recursive: true });
try {
  writeFileSync(
    `${fixture}/package.json`,
    JSON.stringify({
      name: "synthetic-vulnerable-fixture",
      version: "0.0.0",
      private: true,
      dependencies: { lodash: "4.17.20" },
    }),
  );
  writeFileSync(`${fixture}/pnpm-workspace.yaml`, 'packages:\n  - "."\n');
  const install = spawnSync(
    "pnpm",
    ["--dir", fixture, "install", "--lockfile-only", "--ignore-scripts"],
    { encoding: "utf8" },
  );
  if (install.status !== 0)
    throw new Error(`Fixture lockfile generation failed: ${install.stderr}`);
  const audit = spawnSync(
    "pnpm",
    ["--dir", fixture, "audit", "--audit-level", "high"],
    { encoding: "utf8" },
  );
  if (audit.status === 0 || !audit.stdout.includes("lodash"))
    throw new Error(
      `Dependency audit did not identify the vulnerable fixture (exit ${audit.status}): ${audit.stdout} ${audit.stderr}`,
    );
  process.stdout.write("Dependency audit synthetic vulnerability rejected\n");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
