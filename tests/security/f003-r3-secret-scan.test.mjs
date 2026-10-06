import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizePublicMetadata } from "../../scripts/scan-retained-evidence.mjs";

test("R3 normalizes only exact public package metadata and retains synthetic secrets", async () => {
  const syntheticSecret = ["AK", "IA1234567890ABCDEF"].join("");
  const publicDigestAttribute = ["SHA-256", "Digest"].join("-"); // gitleaks:allow -- synthetic copy of public manifest label
  const publicPackage = ["org.keycloak", "keycloak-crypto-fips1402"].join(":"); // gitleaks:allow -- synthetic copy of public package name
  const original = {
    synthetic_access_key: syntheticSecret,
    artifacts: [
      {
        metadata: {
          manifest: {
            sections: [
              [
                { key: publicDigestAttribute, value: "YWJjZA==" },
                { key: "actual-token", value: syntheticSecret },
              ],
            ],
          },
        },
      },
    ],
    Results: [
      {
        Packages: [{ Name: publicPackage }, { Name: syntheticSecret }],
      },
    ],
  };
  const { normalized, publicJarDigests, publicPackageIdentifiers } =
    normalizePublicMetadata(original);
  assert.equal(publicJarDigests, 1);
  assert.equal(publicPackageIdentifiers, 1);
  assert.equal(normalized.artifacts[0].metadata.manifest.sections[0].length, 1);
  assert.equal(
    normalized.artifacts[0].metadata.manifest.sections[0][0].value,
    syntheticSecret,
  );
  assert.equal(normalized.Results[0].Packages[1].Name, syntheticSecret);
  assert.equal(normalized.synthetic_access_key, syntheticSecret);
  const directory = await mkdtemp(
    resolve(import.meta.dirname, "../../.cache/r3-secret-test-"),
  );
  try {
    await writeFile(
      resolve(directory, "sample.json"),
      JSON.stringify(normalized),
    );
    const result = spawnSync(
      resolve(import.meta.dirname, "../../.cache/gitleaks"),
      ["dir", "--redact", "--no-banner", directory],
      { encoding: "utf8", timeout: 60_000 },
    );
    assert.equal(result.status, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
