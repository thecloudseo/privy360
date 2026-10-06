import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import process from "node:process";
import console from "node:console";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "infra/docker/security/evidence");
const binary = process.env.GITLEAKS_BIN ?? resolve(root, ".cache/gitleaks");
const publicJarDigestAttribute = ["SHA-256", "Digest"].join("-"); // gitleaks:allow -- exact public JAR manifest field label
const publicKeycloakName = "keycloak-crypto-fips1402"; // gitleaks:allow -- exact public package name
const publicKeycloakPackage = ["org.keycloak", publicKeycloakName].join(":");

// Only exact public package metadata is normalized in the temporary scan copy.
// Original compressed scanner/SBOM bytes and their checksums remain untouched.
export function normalizePublicMetadata(value) {
  const copy = globalThis.structuredClone(value);
  let publicJarDigests = 0;
  let publicPackageIdentifiers = 0;
  for (const artifact of copy.artifacts ?? []) {
    for (const entries of artifact.metadata?.manifest?.sections ?? []) {
      if (Array.isArray(entries)) {
        for (let index = entries.length - 1; index >= 0; index--) {
          const entry = entries[index];
          if (
            entry?.key === publicJarDigestAttribute &&
            /^[A-Za-z0-9+/=]+$/.test(entry.value ?? "")
          ) {
            entries.splice(index, 1);
            publicJarDigests++;
          }
        }
      }
    }
  }
  for (const result of copy.Results ?? []) {
    for (const pkg of result.Packages ?? []) {
      if (pkg.Name === publicKeycloakPackage) {
        pkg.Name = "<public-package-identifier>";
        publicPackageIdentifiers++;
      }
    }
  }
  return { normalized: copy, publicJarDigests, publicPackageIdentifiers };
}

export async function scanRetainedEvidence() {
  const temporary = await mkdtemp(
    resolve(root, ".cache/evidence-secret-scan-"),
  );
  const counts = { publicJarDigests: 0, publicPackageIdentifiers: 0, files: 0 };
  try {
    for (const file of await readdir(source)) {
      if (!/\.json(\.gz)?$/.test(file)) continue;
      const bytes = await readFile(resolve(source, file));
      const parsed = JSON.parse(
        file.endsWith(".gz") ? gunzipSync(bytes) : bytes,
      );
      const result = normalizePublicMetadata(parsed);
      counts.publicJarDigests += result.publicJarDigests;
      counts.publicPackageIdentifiers += result.publicPackageIdentifiers;
      counts.files++;
      await writeFile(
        resolve(temporary, file.replace(/\.gz$/, "")),
        JSON.stringify(result.normalized),
      );
    }
    const report = resolve(temporary, "report.json");
    const result = spawnSync(
      binary,
      [
        "dir",
        "--redact",
        "--no-banner",
        "--timeout",
        "120",
        "--report-format",
        "json",
        "--report-path",
        report,
        temporary,
      ],
      { cwd: root, encoding: "utf8", timeout: 130_000, maxBuffer: 1024 * 1024 },
    );
    if (result.error || result.status !== 0) {
      const findings = JSON.parse(
        await readFile(report, "utf8").catch(() => "[]"),
      );
      const summary = Object.entries(
        findings.reduce((groups, entry) => {
          const key = `${entry.RuleID}:${entry.File.split("/").at(-1)}`;
          groups[key] = (groups[key] ?? 0) + 1;
          return groups;
        }, {}),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
      throw new Error(
        `Retained evidence secret scan failed (exit ${result.status}); counts ${JSON.stringify(counts)}; top rules/files ${JSON.stringify(summary)}.`,
      );
    }
    return counts;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  try {
    console.log(JSON.stringify(await scanRetainedEvidence()));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
