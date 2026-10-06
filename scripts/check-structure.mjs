import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import process from "node:process";
import {
  baselineErrors,
  REQUIRED_ARCHITECTURE_DOCUMENTS,
} from "./baseline-policy.mjs";

const paths = [
  ...REQUIRED_ARCHITECTURE_DOCUMENTS,
  "apps/web",
  "apps/api",
  "apps/privacy-centre",
  "apps/worker",
  "apps/docs",
  "packages/ui",
  "packages/database",
  "packages/auth",
  "packages/regulatory",
  "packages/workflows",
  "packages/audit",
  "packages/integrations",
  "packages/security",
  "packages/notifications",
  "packages/ai",
  "packages/contracts",
  "packages/domain",
  "regulations/india/dpdp/act-2023",
  "regulations/india/dpdp/rules-2025",
  "regulations/india/dpdp/corrigenda",
  "regulations/india/dpdp/notifications",
  "regulations/india/dpdp/controls",
  "regulations/india/dpdp/evidence",
  "specs/product",
  "specs/architecture",
  "specs/api",
  "specs/database",
  "specs/security",
  "specs/ux",
  "specs/workflows",
  "specs/acceptance",
  "infra/docker",
  "infra/terraform",
  "infra/kubernetes",
  "infra/helm",
  "tests/unit",
  "tests/integration",
  "tests/e2e",
  "tests/security",
  "tests/tenancy",
  "tests/regulatory",
  "scripts",
  "docs",
];
for (const path of paths)
  if (!existsSync(path)) throw new Error(`Missing target path: ${path}`);
let baselineCommit;
try {
  baselineCommit = execFileSync(
    "git",
    ["rev-parse", "architecture-baseline-v1^{}"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim();
} catch {
  throw new Error("Architecture baseline tag missing.");
}
const baselineProblems = baselineErrors(
  baselineCommit,
  new Set(REQUIRED_ARCHITECTURE_DOCUMENTS.filter(existsSync)),
);
if (baselineProblems.length) throw new Error(baselineProblems.join("\n"));
for (const app of ["web", "api", "privacy-centre", "worker"]) {
  const sourcePath = `apps/${app}/src`;
  const files = readdirSync(sourcePath);
  const allowed =
    app === "web" || app === "privacy-centre"
      ? ["shell.ts", "workspace.ts", "regulatory.ts"]
      : app === "api"
        ? ["workspace.ts", "regulatory.ts"]
        : ["workspace.ts"];
  if (files.some((file) => !allowed.includes(file)))
    throw new Error(`Unexpected application source in ${sourcePath}`);
  if (app === "worker") {
    if (
      readFileSync(`${sourcePath}/workspace.ts`, "utf8").trim() !== "export {};"
    )
      throw new Error(`Application behavior detected in ${sourcePath}`);
  }
}
process.stdout.write("FOUNDATION-001 structure and baseline: pass\n");
