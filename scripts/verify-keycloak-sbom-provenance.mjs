import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import console from "node:console";
import process from "node:process";
import {
  validateTrivyOutput,
  validateSyftOutput,
  findingsMatchOriginal,
} from "./scanner-evidence.mjs";

const root = resolve(import.meta.dirname, "..");
const security = resolve(root, "infra/docker/security");
const evidence = resolve(security, "evidence");
const images = JSON.parse(
  await readFile(resolve(security, "images.json"), "utf8"),
).images;
const image = images.keycloak.image;
const suffix = image.split("@sha256:")[1];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const vendorBase =
  "https://repo.maven.apache.org/maven2/com/microsoft/sqlserver/mssql-jdbc/13.2.1.jre11/mssql-jdbc-13.2.1.jre11.jar";
function published(ext) {
  const result = spawnSync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "30",
      `${vendorBase}.${ext}`,
    ],
    { encoding: "utf8", timeout: 35_000 },
  );
  if (
    result.error ||
    result.status !== 0 ||
    !/^[a-f0-9]+$/.test(result.stdout.trim())
  )
    throw new Error(
      `Maven Central ${ext} checksum unavailable; provenance not published.`,
    );
  return result.stdout.trim();
}
try {
  const scan = JSON.parse(
    await readFile(resolve(evidence, `scan-${suffix}.json`), "utf8"),
  );
  const trivyBytes = await readFile(resolve(evidence, scan.rawTrivyFile));
  const syftBytes = await readFile(resolve(evidence, scan.rawSyftFile));
  if (
    sha(trivyBytes) !== scan.rawTrivySha256 ||
    sha(syftBytes) !== scan.rawSyftSha256
  )
    throw new Error("Original scanner/SBOM integrity failed.");
  const trivy = JSON.parse(gunzipSync(trivyBytes));
  const syft = JSON.parse(gunzipSync(syftBytes));
  if (
    !findingsMatchOriginal(
      scan.findings,
      validateTrivyOutput(trivy, image),
      trivy.Metadata.OS?.Family,
    )
  )
    throw new Error("Trivy original findings differ from retained summary.");
  validateSyftOutput(syft, image);
  const path =
    "/opt/keycloak/lib/lib/main/com.microsoft.sqlserver.mssql-jdbc-13.2.1.jre11.jar";
  const files = syft.files.filter((file) => file.location?.path === path);
  const pkg = syft.artifacts.find(
    (item) =>
      item.name === "mssql-jdbc" &&
      item.locations?.some((location) => location.path === path),
  );
  if (
    files.length !== 1 ||
    !pkg ||
    files[0].metadata?.type !== "RegularFile" ||
    pkg.metadata?.pomProperties?.version !== "13.2.1"
  )
    throw new Error(
      "Exact packaged JDBC JAR or embedded Maven metadata missing.",
    );
  const digests = Object.fromEntries(
    files[0].digests.map((item) => [item.algorithm, item.value]),
  );
  const sha256 = published("sha256"),
    sha1 = published("sha1");
  if (digests.sha256 !== sha256 || digests.sha1 !== sha1)
    throw new Error(
      "Current image JDBC JAR differs from Maven Central fixed artifact.",
    );
  const pcre = Object.fromEntries(
    ["pcre2", "pcre2-syntax"].map((name) => {
      const item = syft.artifacts.find(
        (artifact) => artifact.name === name && artifact.type === "rpm",
      );
      if (!item || !Array.isArray(item.metadata?.files))
        throw new Error(`${name} RPM file provenance missing.`);
      return [
        name,
        {
          version: item.version,
          sourceRpm: item.metadata.sourceRpm,
          packagePath: item.locations[0]?.path,
          files: item.metadata.files.map((file) => ({
            path: file.path,
            mode: file.mode,
            size: file.size,
            sha256: file.digest?.value || null,
          })),
        },
      ];
    }),
  );
  if (
    !pcre.pcre2.files.some(
      (file) => file.path.startsWith("/usr/lib64/libpcre2-") && file.sha256,
    ) ||
    pcre["pcre2-syntax"].files.some(
      (file) => !file.path.startsWith("/usr/share/"),
    )
  )
    throw new Error(
      "PCRE2 library/documentation package distinction cannot be established.",
    );
  const record = {
    schemaVersion: 1,
    image,
    platform: images.keycloak.platform,
    verifiedAt: new Date().toISOString(),
    source: {
      trivyOriginalSha256: scan.rawTrivySha256,
      syftOriginalSha256: scan.rawSyftSha256,
      scannedAt: scan.scannedAt,
      syftManifestDigest: syft.source.metadata.manifestDigest,
      syftImageConfigDigest: syft.source.metadata.imageID,
    },
    jdbc: {
      path,
      packageVersion: pkg.version,
      embeddedPomVersion: pkg.metadata.pomProperties.version,
      imageSha256: digests.sha256,
      imageSha1: digests.sha1,
      publishedFixedVersion: "13.2.1.jre11",
      publishedSha256: sha256,
      publishedSha1: sha1,
      publishedSha256Url: `${vendorBase}.sha256`,
      publishedSha1Url: `${vendorBase}.sha1`,
      assessment:
        "Exact image file digest matches the published fixed JAR; Trivy finding remains visible pending scanner-correction review.",
    },
    pcre2: {
      ...pcre,
      assessment:
        "pcre2 contains shared libraries; pcre2-syntax inventory contains only /usr/share paths. Shared-library CVEs remain unresolved.",
    },
    dispositionStatus: "none-approved",
  };
  await writeFile(
    resolve(evidence, "keycloak-provenance.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
  console.log(
    "Current digest-linked JDBC and PCRE2 provenance retained; no scanner finding suppressed.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
