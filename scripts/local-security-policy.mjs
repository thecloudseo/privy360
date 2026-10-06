import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL } from "node:url";

export const LOCAL_CONTEXT = "local-development";
export const EVIDENCE_SCHEMA = 3;
export const DISPOSITION_TYPES = new Set([
  "scanner-correction",
  "configuration-specific-nonexposure",
  "residual-risk-acceptance",
]);
const deploymentContexts = new Set([
  "staging",
  "saas-production",
  "customer-vpc",
  "government-on-premise",
  "offline-release",
]);

export function materialConfiguration(
  config,
  mounts = {},
  reviewedPolicy = JSON.parse(
    readFileSync(
      new URL("../infra/docker/security/images.json", import.meta.url),
      "utf8",
    ),
  ),
) {
  const portableServices = Object.fromEntries(
    Object.entries(config.services ?? {}).map(([name, service]) => [
      name,
      {
        ...service,
        volumes: service.volumes?.map((mount) =>
          mount.type === "bind" && typeof mount.source === "string"
            ? {
                ...mount,
                source: mount.source
                  .replaceAll("\\", "/")
                  .replace(/^.*\/infra\/docker\//, "infra/docker/"),
              }
            : mount,
        ),
      },
    ]),
  );
  const sort = (value) => {
    if (Array.isArray(value)) return value.map(sort);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, sort(item)]),
      );
    return value;
  };
  return sort({
    name: config.name,
    services: portableServices,
    networks: config.networks,
    volumes: config.volumes,
    configs: config.configs,
    secrets: config.secrets,
    mountedMaterial: mounts,
    reviewedImagePolicy: reviewedPolicy,
  });
}

export function configurationHash(config, mounts = {}, reviewedPolicy) {
  return createHash("sha256")
    .update(
      JSON.stringify(materialConfiguration(config, mounts, reviewedPolicy)),
    )
    .digest("hex");
}

export function validateLocalCompose(config, images) {
  const errors = [];
  if (!config || typeof config !== "object")
    return ["Compose configuration missing."];
  if (config.name !== "privy360-local")
    errors.push("Unexpected Compose project.");
  if (
    Object.keys(config.configs ?? {}).length ||
    Object.keys(config.secrets ?? {}).length
  )
    errors.push(
      "Top-level Compose configs and secrets are unsupported by this local stack.",
    );
  const services = config.services ?? {};
  if (Object.keys(services).sort().join() !== Object.keys(images).sort().join())
    errors.push("Service inventory differs from reviewed images.");
  for (const [name, expected] of Object.entries(images)) {
    const service = services[name];
    if (!service) continue;
    if ((service.configs ?? []).length || (service.secrets ?? []).length)
      errors.push(`${name}: Compose configs and secrets are unsupported.`);
    if (!imageIdentity(expected.image) || expected.platform !== "linux/amd64")
      errors.push(`${name}: reviewed immutable image and platform required.`);
    if (
      service.image !== expected.image ||
      service.platform !== expected.platform
    )
      errors.push(`${name}: image digest or platform changed.`);
    if (
      service.ports?.length ||
      (service.network_mode && service.network_mode !== "none")
    )
      errors.push(`${name}: host exposure is forbidden.`);
    if (
      service.extra_hosts?.length ||
      service.devices?.length ||
      service.links?.length
    )
      errors.push(`${name}: host routes and devices are forbidden.`);
    if (service.privileged || service.pid === "host" || service.ipc === "host")
      errors.push(`${name}: privileged host access is forbidden.`);
    if (!service.mem_limit || !service.cpus || !service.pids_limit)
      errors.push(`${name}: resource limits are required.`);
    if (!service.security_opt?.includes("no-new-privileges:true"))
      errors.push(`${name}: no-new-privileges is required.`);
    if (
      (service.security_opt ?? []).some((option) =>
        /(?:seccomp|apparmor):unconfined/i.test(option),
      )
    )
      errors.push(`${name}: unconfined security profile forbidden.`);
    if (
      (service.cap_add ?? []).some(
        (capability) => name !== "minio-volume-init" || capability !== "CHOWN",
      )
    )
      errors.push(`${name}: unreviewed added capability forbidden.`);
    for (const mount of service.volumes ?? []) {
      if (
        !mount ||
        typeof mount !== "object" ||
        !["bind", "volume"].includes(mount.type)
      ) {
        errors.push(`${name}: unsupported mount form.`);
        continue;
      }
      if (mount.type === "bind" && !mount.read_only)
        errors.push(`${name}: writable host mounts are forbidden.`);
      if (
        mount.type === "volume" &&
        (typeof mount.source !== "string" || !config.volumes?.[mount.source])
      )
        errors.push(`${name}: undeclared named volume.`);
    }
    for (const attached of Object.keys(service.networks ?? {}))
      if (!config.networks?.[attached]?.internal)
        errors.push(
          `${name}: attachment to unrestricted network is forbidden.`,
        );
    if (name === "keycloak") {
      if ((service.volumes ?? []).length)
        errors.push("Keycloak imports, providers and themes are forbidden.");
      if (
        Object.keys(service.environment ?? {}).some((key) =>
          /LDAP|SAML|FEDERAT|PROVIDER|IMPORT/.test(key),
        )
      )
        errors.push("Keycloak external identity integration is forbidden.");
    }
  }
  for (const [name, network] of Object.entries(config.networks ?? {})) {
    if (
      !network.internal ||
      network.external ||
      (network.driver && network.driver !== "bridge") ||
      Object.keys(network.driver_opts ?? {}).length
    )
      errors.push(`${name}: only internal networks are permitted.`);
  }
  for (const [name, volume] of Object.entries(config.volumes ?? {})) {
    if (
      volume?.external ||
      (volume?.driver && volume.driver !== "local") ||
      Object.keys(volume?.driver_opts ?? {}).length ||
      (volume?.name && !volume.name.startsWith("privy360-local_"))
    )
      errors.push(`${name}: external or host-backed named volume forbidden.`);
  }
  return errors;
}

const exactDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
const sha256 = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const imageIdentity = (value) =>
  typeof value === "string" && /@sha256:[a-f0-9]{64}$/.test(value);

export function validDisposition(item, now, approvalVerifier = () => false) {
  const t = now.getTime();
  if (
    !Number.isFinite(t) ||
    !DISPOSITION_TYPES.has(item.classification) ||
    item.status !== "approved" ||
    item.classificationStatus !== "reviewed" ||
    item.revokedAt ||
    item.renewedFrom
  )
    return false;
  if (
    !item.owner ||
    !item.approver ||
    item.owner === item.approver ||
    !item.approval?.reviewId ||
    !item.approval?.reviewer ||
    item.approval.reviewer !== item.approver ||
    !item.approval?.protectedReference ||
    !approvalVerifier(item)
  )
    return false;
  if (
    !item.rationale ||
    !Array.isArray(item.compensatingControls) ||
    !item.compensatingControls.length ||
    !/^[A-Z0-9]+-\d+$/.test(item.remediationTicket ?? "")
  )
    return false;
  if (
    item.classification === "scanner-correction" &&
    (!["version-normalization", "package-content"].includes(
      item.correctionEvidence?.assertion,
    ) ||
      !sha256(item.correctionEvidence?.sourceSha256) ||
      !item.correctionEvidence?.vendorReference)
  )
    return false;
  if (
    item.classification === "configuration-specific-nonexposure" &&
    (item.exposureEvidence?.configurationHash !== item.configurationHash ||
      !item.exposureEvidence?.condition ||
      !exactDate(item.exposureEvidence?.verifiedAt) ||
      Date.parse(item.exposureEvidence.verifiedAt) > t ||
      Date.parse(item.exposureEvidence.verifiedAt) >
        Date.parse(item.approvedAt) ||
      !exactDate(item.exposureEvidence?.collectedAt) ||
      Date.parse(item.exposureEvidence.collectedAt) >
        Date.parse(item.exposureEvidence.verifiedAt))
  )
    return false;
  if (
    item.classification === "residual-risk-acceptance" &&
    (!item.riskAssessment?.likelihood ||
      !item.riskAssessment?.impact ||
      !item.riskAssessment?.riskOwner)
  )
    return false;
  if (![item.approvedAt, item.reviewBy, item.expiresAt].every(exactDate))
    return false;
  const approved = Date.parse(item.approvedAt),
    review = Date.parse(item.reviewBy),
    expiry = Date.parse(item.expiresAt);
  if (
    approved > t ||
    review <= t ||
    expiry <= t ||
    !(approved < review && review <= expiry)
  )
    return false;
  if (expiry - approved > 30 * 86_400_000) return false;
  return true;
}

export function validateScanEvidence(scan, image, hash, now) {
  if (
    !scan ||
    scan.schemaVersion !== EVIDENCE_SCHEMA ||
    scan.image !== image.image ||
    scan.digest !== image.image.split("@sha256:")[1] ||
    scan.platform !== image.platform ||
    scan.configurationHash !== hash ||
    !imageIdentity(scan.image)
  )
    return false;
  if (
    scan.scanner !== "Trivy" ||
    !scan.scannerVersion ||
    !scan.databaseVersion ||
    !exactDate(scan.databaseUpdatedAt) ||
    !exactDate(scan.scannedAt)
  )
    return false;
  const t = now.getTime(),
    db = Date.parse(scan.databaseUpdatedAt),
    at = Date.parse(scan.scannedAt);
  if (
    !Number.isFinite(t) ||
    db > at ||
    db > t + 300_000 ||
    at > t + 300_000 ||
    t - db > 259_200_000 ||
    t - at > 86_400_000
  )
    return false;
  if (
    !Array.isArray(scan.findings) ||
    !sha256(scan.sbomSha256) ||
    !sha256(scan.rawTrivySha256) ||
    !sha256(scan.rawSyftSha256) ||
    !sha256(scan.identitySha256) ||
    !scan.coverage?.trivyResults ||
    !scan.coverage?.syftArtifacts ||
    scan.collectionStatus !== "complete"
  )
    return false;
  if (
    !sha256(scan.scannerBinarySha256) ||
    !sha256(scan.syftBinarySha256) ||
    !scan.syftVersion ||
    scan.scannerIsolation?.config !==
      "infra/docker/security/trivy-image.yaml" ||
    scan.scannerIsolation?.ignorefile !== "/dev/null" ||
    scan.scannerIsolation?.inheritedOverridesRemoved !== true ||
    scan.scannerIsolation?.anonymousRegistryConfig !== true
  )
    return false;
  if (
    !Array.isArray(scan.scanOptions) ||
    !scan.scanOptions.includes("vuln") ||
    !scan.scanOptions.includes("HIGH,CRITICAL") ||
    !scan.scanOptions.includes("list-all-pkgs")
  )
    return false;
  return scan.findings.every(
    (f) =>
      /^CVE-\d{4}-\d+$/.test(f.cve ?? "") &&
      f.package &&
      f.packagePath &&
      f.installedVersion &&
      ["HIGH", "CRITICAL"].includes(f.severity),
  );
}

export function productionScanPasses(rawScan, executionSucceeded) {
  if (
    !executionSucceeded ||
    !rawScan ||
    !Array.isArray(rawScan.Results) ||
    rawScan.Results.length === 0
  )
    return false;
  return rawScan.Results.every(
    (result) =>
      Array.isArray(result.Vulnerabilities) &&
      result.Vulnerabilities.every(
        (item) => !["HIGH", "CRITICAL"].includes(item.Severity),
      ),
  );
}

export function validatePromotion({ context, images, artifact }) {
  if (!deploymentContexts.has(context)) return ["Unknown deployment context."];
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact))
    return ["Unsupported deployment artifact."];
  const allowed = new Set([
    "schemaVersion",
    "kind",
    "context",
    "rendered",
    "images",
    "productionScan",
  ]);
  const localImages = new Set(
    Object.values(images).map((entry) => entry.image),
  );
  const localDigests = new Set(
    [...localImages].map((image) => image.split("@sha256:")[1]),
  );
  const hasLocalScope = (value) => {
    if (Array.isArray(value)) return value.some(hasLocalScope);
    if (value && typeof value === "object")
      return (
        value.scope === LOCAL_CONTEXT ||
        value.dispositionScope === LOCAL_CONTEXT ||
        value.localEligibility === true ||
        Object.keys(value).some((key) =>
          [
            "localDispositions",
            "proposedDispositions",
            "dispositions",
          ].includes(key),
        ) ||
        Object.values(value).some(hasLocalScope)
      );
    return false;
  };
  const hasTemplate = (value) => {
    if (typeof value === "string")
      return /\$\{[^}]+\}|\{\{[^}]+\}\}|<%|#\{[^}]+\}/.test(value);
    if (Array.isArray(value)) return value.some(hasTemplate);
    if (value && typeof value === "object")
      return Object.values(value).some(hasTemplate);
    return false;
  };
  const errors = [];
  if (hasTemplate(artifact))
    errors.push("Deployment artifact contains unresolved template material.");
  if (Object.keys(artifact).some((key) => !allowed.has(key)))
    errors.push("Unsupported deployment artifact field.");
  if (artifact.metadata !== undefined)
    errors.push("Arbitrary deployment metadata is unsupported.");
  if (artifact.compose !== undefined)
    errors.push(
      "Deployment Compose references are unsupported by this foundation contract.",
    );
  if (
    !artifact.productionScan ||
    typeof artifact.productionScan !== "object" ||
    Array.isArray(artifact.productionScan) ||
    Object.keys(artifact.productionScan).sort().join() !== "required"
  )
    errors.push("Unsupported production scan declaration.");
  const canonical = (value) =>
    typeof value === "string"
      ? value
          .replaceAll("\\", "/")
          .split("/")
          .reduce((parts, part) => {
            if (part === "..") parts.pop();
            else if (part && part !== ".") parts.push(part);
            return parts;
          }, [])
          .join("/")
      : "";
  if (
    canonical(artifact.compose).endsWith("infra/docker/compose.yaml") ||
    hasLocalScope(artifact)
  )
    errors.push("Local Compose or eligibility cannot be promoted.");
  if (
    artifact.schemaVersion !== 1 ||
    artifact.kind !== "rendered-deployment" ||
    artifact.context !== context ||
    artifact.rendered !== true ||
    artifact.productionScan?.required !== true
  )
    errors.push(
      "Rendered deployment contract and independent production scan are required.",
    );
  if (!Array.isArray(artifact.images) || artifact.images.length === 0)
    errors.push("Deployment images must be declared.");
  if (
    (artifact.images ?? []).some(
      (image) =>
        !imageIdentity(image) ||
        localImages.has(image) ||
        [...localDigests].some((digest) => image.includes(`sha256:${digest}`)),
    )
  )
    errors.push("Local-only image identity cannot be promoted.");
  return errors;
}

export function evaluateLocalEligibility({
  context,
  config,
  images,
  evidence,
  dispositions,
  scanSucceeded,
  mountHashes = {},
  approvalVerifier = () => false,
  now = new Date(),
}) {
  const errors = [];
  if (context !== LOCAL_CONTEXT)
    return {
      eligible: false,
      errors: ["Local eligibility is not a deployment approval."],
    };
  errors.push(...validateLocalCompose(config, images));
  const binds = new Set(
    Object.values(config.services ?? {}).flatMap((service) =>
      (service.volumes ?? [])
        .filter((mount) => mount.type === "bind")
        .map((mount) => mount.source),
    ),
  );
  if (Object.keys(mountHashes).length !== binds.size)
    errors.push("Mounted executable/configuration contents were not bound.");
  if (!scanSucceeded) errors.push("Image scan execution failed.");
  const hash = configurationHash(config, mountHashes);
  for (const [name, image] of Object.entries(images)) {
    const scan = evidence.find((item) => item.service === name);
    if (
      !validateScanEvidence(scan, image, hash, now) ||
      JSON.stringify(scan.mountHashes ?? {}) !== JSON.stringify(mountHashes)
    ) {
      errors.push(
        `${name}: complete current scanner and SBOM evidence is required.`,
      );
      continue;
    }
    for (const finding of scan.findings) {
      if (!["HIGH", "CRITICAL"].includes(finding.severity)) continue;
      const matches = dispositions.filter(
        (item) =>
          item.cve === finding.cve &&
          item.package === finding.package &&
          item.packagePath === finding.packagePath &&
          item.installedVersion === finding.installedVersion &&
          item.severity === finding.severity &&
          item.fixedVersion === finding.fixedVersion &&
          item.fixedStatus === finding.fixedStatus &&
          item.image === image.image &&
          item.platform === image.platform &&
          item.configurationHash === hash &&
          item.scope === LOCAL_CONTEXT,
      );
      const approved = matches.find((item) =>
        validDisposition(
          item,
          now,
          (candidate) =>
            (candidate.classification !==
              "configuration-specific-nonexposure" ||
              candidate.exposureEvidence?.collectedAt === scan.scannedAt) &&
            approvalVerifier(candidate, scan),
        ),
      );
      if (!approved)
        errors.push(
          `${name}: no active reviewed local disposition for ${finding.cve} ${finding.package} ${finding.packagePath}.`,
        );
    }
  }
  return { eligible: errors.length === 0, errors };
}
