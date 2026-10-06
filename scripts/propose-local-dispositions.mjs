import { readFile, writeFile } from "node:fs/promises";
import { URL } from "node:url";
import { spawnSync } from "node:child_process";
import console from "node:console";
import process from "node:process";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  configurationHash,
  validateScanEvidence,
} from "./local-security-policy.mjs";
import { mountedMaterial } from "./local-material.mjs";
import {
  validateTrivyOutput,
  findingsMatchOriginal,
} from "./scanner-evidence.mjs";

const base = new URL("../infra/docker/security/", import.meta.url);
const images = JSON.parse(
  await readFile(new URL("images.json", base), "utf8"),
).images;
const image = images.keycloak;
const suffix = image.image.split("@sha256:")[1];
const scan = JSON.parse(
  await readFile(new URL(`evidence/scan-${suffix}.json`, base), "utf8"),
);
const configResult = spawnSync(
  process.execPath,
  [new URL("local-services.mjs", import.meta.url).pathname, "security-config"],
  { encoding: "utf8", timeout: 30_000 },
);
if (configResult.error || configResult.status !== 0)
  throw new Error("Cannot resolve current local Compose material.");
const config = JSON.parse(configResult.stdout);
const mounts = await mountedMaterial(
  config,
  new URL("../infra/docker/", import.meta.url).pathname,
);
const currentHash = configurationHash(config, mounts);
if (!validateScanEvidence(scan, image, currentHash, new Date()))
  throw new Error(
    "Current Keycloak scan is incomplete, stale or mismatched; proposals not published.",
  );
const rawBytes = await readFile(new URL(`evidence/${scan.rawTrivyFile}`, base));
if (
  createHash("sha256").update(rawBytes).digest("hex") !== scan.rawTrivySha256 ||
  !findingsMatchOriginal(
    scan.findings,
    validateTrivyOutput(JSON.parse(gunzipSync(rawBytes)), image.image),
    "redhat",
  )
)
  throw new Error(
    "Current Keycloak original findings do not match the proposal source.",
  );
const historical = JSON.parse(
  gunzipSync(
    await readFile(
      new URL("evidence/historical-keycloak-trivy-2026-09-30.json.gz", base),
    ),
  ),
);
const oldOccurrences = validateTrivyOutput(historical, image.image).map((v) =>
  [
    v.VulnerabilityID,
    v.PkgName,
    v.InstalledVersion,
    v.PkgPath ?? "/var/lib/rpm/rpmdb.sqlite",
  ].join("|"),
);
const occurrence = (f) =>
  [f.cve, f.package, f.installedVersion, f.packagePath].join("|");
const oldSet = new Set(oldOccurrences);
const retained = scan.findings.filter((f) => oldSet.has(occurrence(f)));
if (oldOccurrences.length !== 13 || retained.length !== 13)
  throw new Error(
    "The thirteen reviewed R2 occurrence identities were not all retained in the current scan.",
  );
const provenanceBytes = await readFile(
  new URL("evidence/keycloak-provenance.json", base),
);
const provenance = JSON.parse(provenanceBytes);
if (
  provenance.image !== image.image ||
  provenance.source?.syftOriginalSha256 !== scan.rawSyftSha256 ||
  provenance.source?.trivyOriginalSha256 !== scan.rawTrivySha256
)
  throw new Error(
    "Current Keycloak component provenance is missing or does not match the scan.",
  );
const provenanceSha256 = createHash("sha256")
  .update(provenanceBytes)
  .digest("hex");
const rationales = {
  "CVE-2026-86145":
    "PCRE2 library use with attacker-controlled regex is unproven; pcre2-syntax is documentation only. Residual local risk requires review.",
  "CVE-2026-89161":
    "PCRE2 JIT call path is unproven; pcre2-syntax is documentation only. Residual local risk requires review.",
  "CVE-2026-68497":
    "Affected Jackson deserializer is packaged; Keycloak endpoint reachability is unproven. Residual local denial-of-service risk requires review.",
  "CVE-2025-59250":
    "Packaged JAR SHA-256 matches Maven Central fixed 13.2.1.jre11 artifact; scanner normalized the embedded version to 13.2.1. Security must confirm scanner discrepancy.",
  "CVE-2026-75595":
    "Local Keycloak has HTTP enabled and no TLS/SNI mTLS configuration. Future deployment reachability is unproven and this record is local-only.",
  "CVE-2026-8763":
    "Bouncy Castle certificate validation code is packaged; Keycloak call-path reachability is unproven. Residual local risk requires review.",
  "CVE-2026-13506":
    "Bouncy Castle ASN.1 code is packaged; Keycloak call-path reachability is unproven. Residual local risk requires review.",
  "CVE-2026-84939":
    "FreeMarker template loader is packaged; attacker control of malformed locale and loader behavior are unproven. Residual local risk requires review.",
};
const proposals = retained.map((finding) => ({
  cve: finding.cve,
  package: finding.package,
  packagePath: finding.packagePath,
  installedVersion: finding.installedVersion,
  severity: finding.severity,
  fixedVersion: finding.fixedVersion,
  fixedStatus: finding.fixedStatus,
  image: image.image,
  platform: image.platform,
  configurationHash: currentHash,
  sourceScanDigest: scan.digest,
  sourceEvidenceStatus: "current-complete-collection",
  sourceScannedAt: scan.scannedAt,
  sourceRawTrivySha256: scan.rawTrivySha256,
  scope: "local-development",
  status: "proposed-unapproved",
  classificationStatus: "proposed-unverified",
  classification:
    finding.package === "com.microsoft.sqlserver:mssql-jdbc" ||
    finding.package === "pcre2-syntax"
      ? "scanner-correction"
      : finding.package === "io.netty:netty-handler"
        ? "configuration-specific-nonexposure"
        : "residual-risk-acceptance",
  owner: null,
  proposedOwnerRole: "Platform Security",
  approver: null,
  approval: null,
  approvedAt: null,
  reviewBy: null,
  rationale: rationales[finding.cve],
  compensatingControls: [
    "Synthetic local data and identities only",
    "No published service ports; internal Compose networks",
    "No federation, imports, custom providers or themes",
    "Digest and material configuration bound; resource limits",
  ],
  remediationTicket: null,
  correctionEvidence: null,
  exposureEvidence: null,
  riskAssessment: null,
  proposalEvidence: [
    "com.microsoft.sqlserver:mssql-jdbc",
    "pcre2",
    "pcre2-syntax",
  ].includes(finding.package)
    ? { file: "evidence/keycloak-provenance.json", sha256: provenanceSha256 }
    : {
        file: `evidence/scan-${suffix}.json`,
        rawTrivySha256: scan.rawTrivySha256,
      },
  advisory: finding.advisory,
  expiresAt: null,
}));
if (proposals.some((item) => !item.rationale || !item.advisory))
  throw new Error("Every finding needs a rationale and advisory.");
await writeFile(
  new URL("proposed-dispositions.json", base),
  JSON.stringify({ scope: "local-development", proposals }, null, 2) + "\n",
);
const unique = new Map(Object.values(images).map((item) => [item.image, item]));
const unreviewed = [];
for (const [identity, item] of unique) {
  const digest = identity.split("@sha256:")[1];
  const record = JSON.parse(
    await readFile(new URL(`evidence/scan-${digest}.json`, base)),
  );
  for (const finding of record.findings) {
    if (identity === image.image && oldSet.has(occurrence(finding))) continue;
    unreviewed.push({
      image: identity,
      platform: item.platform,
      cve: finding.cve,
      package: finding.package,
      packagePath: finding.packagePath,
      installedVersion: finding.installedVersion,
      fixedVersion: finding.fixedVersion,
      fixedStatus: finding.fixedStatus,
      severity: finding.severity,
      advisory: finding.advisory,
      sourceRawTrivySha256: record.rawTrivySha256,
      status: "unreviewed-no-disposition",
    });
  }
}
await writeFile(
  new URL("new-findings-unreviewed.json", base),
  JSON.stringify(
    {
      scope: "local-development",
      scannedAt: new Date().toISOString(),
      findings: unreviewed,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${proposals.length} exact unapproved R2 proposals prepared; ${unreviewed.length} new findings left unreviewed and denied.`,
);
