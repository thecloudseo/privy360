export function scannerEnvironment(inherited) {
  const clean = Object.fromEntries(
    Object.entries(inherited).filter(
      ([key]) => !/^(TRIVY_|SYFT_|GRYPE_)/.test(key),
    ),
  );
  clean.SYFT_CHECK_FOR_APP_UPDATE = "false";
  return clean;
}

export function validateImageIdentity(record, expectedImage, syft) {
  if (
    record?.image !== expectedImage ||
    record.platform !== "linux/amd64" ||
    !record.indexBase64 ||
    !record.manifestBase64
  )
    throw new Error("Image identity provenance missing or mismatched.");
  const indexBytes = Buffer.from(record.indexBase64, "base64");
  const manifestBytes = Buffer.from(record.manifestBase64, "base64");
  const indexDigest = `sha256:${expectedImage.split("@sha256:")[1]}`;
  if (digest(indexBytes) !== indexDigest)
    throw new Error("Requested image index digest mismatch.");
  const index = JSON.parse(indexBytes);
  const manifest = JSON.parse(manifestBytes);
  if (index.schemaVersion !== 2 || manifest.schemaVersion !== 2)
    throw new Error("Unsupported OCI identity schema.");
  if (Array.isArray(index.manifests)) {
    const selected = index.manifests.filter(
      (item) =>
        item.platform?.os === "linux" &&
        item.platform?.architecture === "amd64",
    );
    if (selected.length !== 1 || selected[0].digest !== digest(manifestBytes))
      throw new Error(
        "Selected platform manifest is not linked to the requested index.",
      );
  } else if (digest(manifestBytes) !== indexDigest)
    throw new Error(
      "Single-platform manifest differs from requested identity.",
    );
  const configBytes = Buffer.from(
    syft?.source?.metadata?.config ?? "",
    "base64",
  );
  if (
    digest(configBytes) !== manifest.config?.digest ||
    syft.source.metadata.imageID !== manifest.config.digest ||
    !syft.source.metadata.repoDigests?.includes(expectedImage)
  )
    throw new Error(
      "Syft inventory config does not match selected platform manifest.",
    );
  const config = JSON.parse(configBytes);
  if (config.os !== "linux" || config.architecture !== "amd64")
    throw new Error("Selected image configuration platform mismatch.");
  return true;
}

export function validateTrivyOutput(raw, expectedImage, coverage = {}) {
  if (
    !raw ||
    typeof raw !== "object" ||
    raw.ArtifactType !== "container_image" ||
    raw.SchemaVersion !== 2 ||
    !raw.Trivy?.Version ||
    !Array.isArray(raw.Results) ||
    raw.Results.length === 0
  )
    throw new Error("Trivy output is malformed or lacks Results.");
  if (
    !raw.Metadata?.RepoDigests?.includes(expectedImage) ||
    raw.Metadata?.ImageConfig?.os !== "linux" ||
    raw.Metadata?.ImageConfig?.architecture !== "amd64"
  )
    throw new Error("Trivy image digest or platform mismatch.");
  for (const result of raw.Results) {
    if (
      !result ||
      !result.Target ||
      !result.Class ||
      !result.Type ||
      !Array.isArray(result.Packages) ||
      result.Packages.length === 0 ||
      (result.Vulnerabilities !== undefined &&
        !Array.isArray(result.Vulnerabilities))
    )
      throw new Error("Trivy result target is incomplete.");
  }
  if (
    (coverage.requiredTargets ?? []).some(
      (target) =>
        !raw.Results.some(
          (result) => `${result.Class}:${result.Type}` === target,
        ),
    )
  )
    throw new Error("Trivy required package target missing.");
  if (
    raw.Results.reduce((count, result) => count + result.Packages.length, 0) <
    (coverage.minimumTrivyPackages ?? 1)
  )
    throw new Error("Trivy package coverage is incomplete.");
  const findings = raw.Results.flatMap(
    (result) => result.Vulnerabilities ?? [],
  );
  if (findings.length < (coverage.minimumKnownFindings ?? 0))
    throw new Error("Trivy known occurrence coverage is incomplete.");
  return findings;
}

export function validateSyftOutput(raw, expectedImage, coverage = {}) {
  const expectedDigest = expectedImage.split("@sha256:")[1];
  if (
    !raw ||
    typeof raw !== "object" ||
    raw.schema?.version !== "16.1.10" ||
    !Array.isArray(raw.artifacts) ||
    raw.artifacts.length < (coverage.minimumSyftArtifacts ?? 2) ||
    !raw.source ||
    raw.source.type !== "image" ||
    raw.source.metadata?.userInput !== expectedImage ||
    raw.source.version !== `sha256:${expectedDigest}` ||
    !raw.source.metadata?.repoDigests?.includes(expectedImage) ||
    !raw.source.metadata?.manifest ||
    !raw.source.metadata?.config
  )
    throw new Error(
      "Syft output is malformed, partial or lacks verified image identity.",
    );
  const manifestBytes = Buffer.from(raw.source.metadata.manifest, "base64");
  const configBytes = Buffer.from(raw.source.metadata.config, "base64");
  const manifest = JSON.parse(manifestBytes);
  const config = JSON.parse(configBytes);
  if (
    digest(manifestBytes) !== raw.source.metadata.manifestDigest ||
    raw.source.id !== raw.source.metadata.manifestDigest.slice(7) ||
    digest(configBytes) !== manifest.config?.digest ||
    raw.source.metadata.imageID !== manifest.config?.digest ||
    config.os !== "linux" ||
    config.architecture !== "amd64"
  )
    throw new Error(
      "Syft resolved manifest/config identity or platform mismatch.",
    );
  for (const artifact of raw.artifacts)
    if (
      !artifact.name ||
      !artifact.version ||
      !Array.isArray(artifact.locations)
    )
      throw new Error("Syft package inventory is incomplete.");
  return raw.artifacts;
}

export function findingPackagePath(vulnerability, osFamily) {
  if (vulnerability.PkgPath) return vulnerability.PkgPath;
  if (osFamily === "alpine") return "/lib/apk/db/installed";
  if (osFamily === "redhat") return "/var/lib/rpm/rpmdb.sqlite";
  return "/var/lib/apk/db/installed";
}

export function findingsMatchOriginal(summary, vulnerabilities, osFamily) {
  if (!Array.isArray(summary) || !Array.isArray(vulnerabilities)) return false;
  const key = (f) =>
    JSON.stringify([
      f.cve,
      f.package,
      f.installedVersion,
      f.packagePath,
      f.severity,
      f.fixedVersion ?? null,
      f.fixedStatus ?? "unknown",
    ]);
  const originals = vulnerabilities.map((v) => ({
    cve: v.VulnerabilityID,
    package: v.PkgName,
    installedVersion: v.InstalledVersion,
    packagePath: findingPackagePath(v, osFamily),
    severity: v.Severity,
    fixedVersion: v.FixedVersion ?? null,
    fixedStatus: v.Status ?? "unknown",
  }));
  return (
    JSON.stringify(summary.map(key).sort()) ===
    JSON.stringify(originals.map(key).sort())
  );
}
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

const digest = (bytes) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
