import { readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

function filesIn(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory()
      ? filesIn(child)
      : entry.name === "README.md"
        ? []
        : [child];
  });
}
const files = filesIn("infra");
process.stdout.write(
  files.length === 0
    ? "IaC: N/A, no configuration files yet\n"
    : `IaC: ${files.length} configuration file(s) require Checkov\n`,
);
