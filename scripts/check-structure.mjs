import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import process from "node:process";

const paths = [
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
const baselineDocuments = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", "architecture-baseline-v1"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter((path) => path.endsWith(".md"));
for (const path of baselineDocuments) {
  const baseline = execFileSync("git", [
    "show",
    `architecture-baseline-v1:${path}`,
  ]);
  if (!readFileSync(path).equals(baseline))
    throw new Error(`Architecture baseline changed: ${path}`);
}
for (const app of ["web", "api", "privacy-centre", "worker"]) {
  const sourcePath = `apps/${app}/src`;
  const files = readdirSync(sourcePath);
  if (files.length !== 1 || files[0] !== "workspace.ts")
    throw new Error(`Unexpected application source in ${sourcePath}`);
  if (
    readFileSync(`${sourcePath}/workspace.ts`, "utf8").trim() !== "export {};"
  )
    throw new Error(`Application behavior detected in ${sourcePath}`);
}
process.stdout.write("FOUNDATION-001 structure and baseline: pass\n");
