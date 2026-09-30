import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.argv[2];
if (!root) throw new Error("SARIF directory is required");
function filesIn(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory()
      ? filesIn(child)
      : child.endsWith(".sarif")
        ? [child]
        : [];
  });
}
const files = filesIn(root);
if (files.length === 0) throw new Error("CodeQL produced no SARIF");
for (const file of files) {
  const report = JSON.parse(readFileSync(file, "utf8"));
  const findings = report.runs?.flatMap((run) => run.results ?? []) ?? [];
  if (findings.length > 0)
    throw new Error(`CodeQL reported ${findings.length} findings in ${file}`);
}
process.stdout.write(`CodeQL: ${files.length} SARIF report(s), no findings\n`);
