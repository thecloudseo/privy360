import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  validateTrivyOutput,
  validateSyftOutput,
  findingsMatchOriginal,
} from "../../scripts/scanner-evidence.mjs";

const root = new URL("../../infra/docker/security/", import.meta.url);
const readJson = async (name) =>
  JSON.parse(await readFile(new URL(name, root), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("all pinned image evidence retains intact originals and full inventory", async () => {
  const images = (await readJson("images.json")).images;
  for (const image of new Set(
    Object.values(images).map((entry) => entry.image),
  )) {
    const suffix = image.split("@sha256:")[1];
    const scan = await readJson(`evidence/scan-${suffix}.json`);
    assert.equal(scan.image, image);
    assert.equal(scan.schemaVersion, 3);
    assert.equal(scan.collectionStatus, "complete");
    for (const [file, checksum] of [
      [scan.rawTrivyFile, scan.rawTrivySha256],
      [scan.rawSyftFile, scan.rawSyftSha256],
      [scan.sbomFile, scan.sbomSha256],
      [scan.identityFile, scan.identitySha256],
    ])
      assert.equal(
        hash(await readFile(new URL(`evidence/${file}`, root))),
        checksum,
      );
    const trivy = JSON.parse(
      gunzipSync(
        await readFile(new URL(`evidence/${scan.rawTrivyFile}`, root)),
      ),
    );
    const syft = JSON.parse(
      gunzipSync(await readFile(new URL(`evidence/${scan.rawSyftFile}`, root))),
    );
    assert.equal(
      findingsMatchOriginal(
        scan.findings,
        validateTrivyOutput(trivy, image),
        trivy.Metadata.OS?.Family,
      ),
      true,
    );
    assert.ok(validateSyftOutput(syft, image).length);
  }
});

test("production Keycloak rejection is independently retained; local dispositions remain empty", async () => {
  const gate = await readJson("production-gate-keycloak.json");
  const raw = await readFile(new URL(gate.originalFile, root));
  assert.equal(hash(raw), gate.originalSha256);
  const findings = validateTrivyOutput(JSON.parse(gunzipSync(raw)), gate.image);
  assert.equal(gate.exitStatus, 1);
  assert.equal(gate.result, "rejected");
  assert.equal(gate.localDispositionsApplied, false);
  assert.ok(Number.isInteger(gate.databaseVersion) && gate.databaseVersion > 0);
  assert.ok(Number.isFinite(Date.parse(gate.databaseUpdatedAt)));
  assert.match(gate.scannerBinarySha256, /^[a-f0-9]{64}$/);
  assert.equal(gate.highCriticalOccurrences, findings.length);
  assert.ok(findings.length >= 13);
  const proposals = (await readJson("proposed-dispositions.json")).proposals;
  assert.equal(proposals.length, 13);
  assert.ok(
    proposals.every(
      (item) =>
        item.status === "proposed-unapproved" &&
        item.approval === null &&
        item.approvedAt === null,
    ),
  );
  assert.deepEqual((await readJson("dispositions.json")).dispositions, []);
});

test("current Keycloak JDBC and PCRE2 provenance remains linked to original SBOM", async () => {
  const record = await readJson("evidence/keycloak-provenance.json");
  const suffix = record.image.split("@sha256:")[1];
  const scan = await readJson(`evidence/scan-${suffix}.json`);
  assert.equal(record.source.syftOriginalSha256, scan.rawSyftSha256);
  assert.equal(record.source.trivyOriginalSha256, scan.rawTrivySha256);
  assert.equal(record.jdbc.imageSha256, record.jdbc.publishedSha256);
  assert.equal(record.jdbc.imageSha1, record.jdbc.publishedSha1);
  assert.equal(record.jdbc.embeddedPomVersion, "13.2.1");
  assert.equal(record.jdbc.publishedFixedVersion, "13.2.1.jre11");
  assert.ok(
    record.pcre2.pcre2.files.some(
      (file) => file.path.includes("libpcre2-8.so") && file.sha256,
    ),
  );
  assert.ok(
    record.pcre2["pcre2-syntax"].files.every((file) =>
      file.path.startsWith("/usr/share/"),
    ),
  );
  assert.equal(record.dispositionStatus, "none-approved");
  const extracted = await readJson("evidence/keycloak-docker-provenance.json");
  assert.equal(extracted.image, record.image);
  assert.equal(extracted.platform, record.platform);
  assert.equal(extracted.jdbc.sha256, record.jdbc.imageSha256);
  assert.equal(extracted.jdbc.publishedSha256, record.jdbc.publishedSha256);
  assert.ok(
    extracted.pcre2.packageBasenames.some((name) =>
      name.includes("pcre2|libpcre2-8.so"),
    ),
  );
  assert.ok(
    extracted.pcre2.packageDirectories.some((name) =>
      name.includes("pcre2-syntax|/usr/share/"),
    ),
  );
});
