import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  mkdir,
  mkdtemp,
  readdir,
  copyFile,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import console from "node:console";
import prettier from "prettier";
import {
  EVIDENCE_SCHEMA,
  cp1PostgresVerificationConfiguration,
  configurationHash,
  evaluateLocalEligibility,
  scopeLocalServiceConfiguration,
  validateScanEvidence,
} from "./local-security-policy.mjs";
import { mountedMaterial } from "./local-material.mjs";
import {
  validateTrivyOutput,
  validateSyftOutput,
  scannerEnvironment,
  findingsMatchOriginal,
  findingPackagePath,
  validateImageIdentity,
} from "./scanner-evidence.mjs";
import { publishCompletedCollection } from "./collection-publication.mjs";
import {
  loadOperationalTrust,
  verifyLocalApproval,
} from "./local-approval.mjs";

const root = resolve(import.meta.dirname, "..");
const security = resolve(root, "infra/docker/security");
const reviewedImages = JSON.parse(
  await readFile(resolve(security, "images.json"), "utf8"),
).images;
const dispositions = JSON.parse(
  await readFile(resolve(security, "dispositions.json"), "utf8"),
).dispositions;
const approvalTrust = dispositions.length
  ? await loadOperationalTrust(process.env.PRIVY360_LOCAL_APPROVER_TRUST_FILE)
  : null;
const approvalVerifier = (item, scan) =>
  approvalTrust !== null &&
  verifyLocalApproval(item.approvalEnvelope, approvalTrust, item, scan);
const output = resolve(security, "evidence");
const trivy = resolve(root, ".cache/trivy");
const syft = resolve(root, ".cache/syft");
const cache = resolve(root, ".cache/trivy-db");
const scannerHome = resolve(root, ".cache/scanner-home");
const collectionDeadline = Date.now() + 600_000;

function command(binary, args, { dockerRegistry = false } = {}) {
  const remaining = collectionDeadline - Date.now();
  if (remaining <= 0)
    throw new Error(
      "Image evidence collection exceeded its 600-second deadline.",
    );
  const env = scannerEnvironment(process.env);
  if (!dockerRegistry) {
    env.HOME = scannerHome;
    env.DOCKER_CONFIG = scannerHome;
    env.XDG_CONFIG_HOME = scannerHome;
    env.XDG_CACHE_HOME = resolve(scannerHome, "cache");
  }
  const result = spawnSync(binary, args, {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
    timeout: Math.min(180_000, remaining),
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${binary} execution failed with exit ${result.status}: ${result.stderr?.slice(-1000) ?? result.error?.message}`,
    );
  return result.stdout;
}

function composeConfig() {
  const helper = resolve(root, "scripts/local-services.mjs");
  // The helper owns credentials; use its validated Compose configuration rather than copying secrets.
  const result = spawnSync(process.execPath, [helper, "security-config"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30_000,
  });
  if (result.error || result.status !== 0)
    throw new Error("Local Compose configuration could not be validated.");
  return JSON.parse(result.stdout);
}

function registryIdentity(image) {
  const indexRaw = command(
    "docker",
    ["buildx", "imagetools", "inspect", "--raw", image],
    { dockerRegistry: true },
  );
  const index = JSON.parse(indexRaw);
  let manifestRaw = indexRaw;
  if (Array.isArray(index.manifests)) {
    const selected = index.manifests.filter(
      (item) =>
        item.platform?.os === "linux" &&
        item.platform?.architecture === "amd64",
    );
    if (selected.length !== 1)
      throw new Error(`${image}: expected one linux/amd64 manifest.`);
    manifestRaw = command(
      "docker",
      [
        "buildx",
        "imagetools",
        "inspect",
        "--raw",
        `${image.split("@sha256:")[0]}@${selected[0].digest}`,
      ],
      { dockerRegistry: true },
    );
  }
  return {
    image,
    platform: "linux/amd64",
    indexBase64: Buffer.from(indexRaw).toString("base64"),
    manifestBase64: Buffer.from(manifestRaw).toString("base64"),
  };
}

function sanitizeSyftOutput(sbom) {
  const config = sbom.descriptor?.configuration?.packages;
  if (config?.golang)
    config.golang["local-mod-cache-dir"] = "<sanitized-local-cache>";
  if (config?.["java-archive"])
    config["java-archive"]["maven-localrepository-dir"] =
      "<sanitized-local-cache>";
  return sbom;
}

const action = process.argv[2];
const serviceOption = process.argv.slice(3);
const cp1Postgres =
  serviceOption.length === 3 && serviceOption[2] === "--cp1-postgres";
const serviceScope =
  [2, 3].includes(serviceOption.length) && serviceOption[0] === "--service"
    ? serviceOption[1]
    : null;
if (
  ![
    "collect",
    "collect-evaluate",
    "preflight",
    "evaluate",
    "validate",
  ].includes(action) ||
  (serviceOption.length > 0 && serviceScope === null) ||
  (serviceOption.length === 3 && !cp1Postgres) ||
  (cp1Postgres && serviceScope !== "app-db") ||
  (serviceScope !== null && !["preflight", "collect-evaluate"].includes(action))
) {
  console.error(
    "Usage: node scripts/local-image-evidence.mjs collect|collect-evaluate|preflight|validate|evaluate [--service <reviewed-service> [--cp1-postgres]]",
  );
  process.exitCode = 2;
} else {
  try {
    let config = composeConfig();
    let images = reviewedImages;
    if (serviceScope !== null) {
      const scoped = scopeLocalServiceConfiguration(config, images, [
        serviceScope,
      ]);
      config = scoped.config;
      images = scoped.images;
      if (cp1Postgres) config = cp1PostgresVerificationConfiguration(config);
    }
    const mountHashes = await mountedMaterial(
      config,
      resolve(root, "infra/docker"),
    );
    const hash = configurationHash(config, mountHashes);
    if (action === "preflight") {
      if (dispositions.length === 0) {
        for (const item of new Map(
          Object.values(images).map((value) => [value.image, value]),
        ).values()) {
          const suffix = item.image.split("@sha256:")[1];
          const record = JSON.parse(
            await readFile(resolve(output, `scan-${suffix}.json`), "utf8"),
          );
          if (!Array.isArray(record.findings))
            throw new Error(
              "Cached assessment is incomplete; local admission denied.",
            );
          if (
            record.findings.some((finding) =>
              ["HIGH", "CRITICAL"].includes(finding.severity),
            )
          )
            throw new Error(
              "Cached assessment contains High/Critical findings with no active dispositions; local admission denied before service launch.",
            );
        }
      }
      console.log(
        `Preflight permits a current collection attempt for ${cp1Postgres ? "CP1 PostgreSQL" : (serviceScope ?? "the complete local stack")}; it does not establish eligibility.`,
      );
    } else if (action === "collect" || action === "collect-evaluate") {
      const collected = new Map();
      await mkdir(scannerHome, { recursive: true });
      await writeFile(resolve(scannerHome, "config.json"), "{}\n", {
        mode: 0o600,
      });
      const stage = await mkdtemp(resolve(security, ".evidence-stage-"));
      try {
        const scannerVersion = command(trivy, [
          "--version",
          "--cache-dir",
          cache,
        ]).match(/Version:\s*([\d.]+)/)?.[1];
        const syftVersion = command(syft, ["version"]).match(
          /Version:\s*([\d.]+)/,
        )?.[1];
        const scannerBinarySha256 = createHash("sha256")
          .update(await readFile(trivy))
          .digest("hex");
        const syftBinarySha256 = createHash("sha256")
          .update(await readFile(syft))
          .digest("hex");
        command(trivy, [
          "image",
          "--config",
          resolve(security, "trivy-image.yaml"),
          "--cache-dir",
          cache,
          "--download-db-only",
        ]);
        const db = JSON.parse(
          await readFile(resolve(cache, "db/metadata.json"), "utf8"),
        );
        if (!scannerVersion || !syftVersion || !db.UpdatedAt)
          throw new Error(
            "Scanner or vulnerability database metadata unavailable.",
          );
        const unique = new Map(
          Object.values(images).map((item) => [item.image, item]),
        );
        for (const [image, item] of unique) {
          const suffix = image.split("@sha256:")[1];
          const scanArgs = [
            "image",
            "--config",
            resolve(security, "trivy-image.yaml"),
            "--ignorefile",
            "/dev/null",
            "--cache-dir",
            cache,
            "--scanners",
            "vuln",
            "--severity",
            "HIGH,CRITICAL",
            "--list-all-pkgs",
            "--format",
            "json",
            image,
          ];
          const rawScan = command(trivy, scanArgs);
          const scan = JSON.parse(rawScan);
          const vulnerabilities = validateTrivyOutput(scan, image, item);
          const sbom = sanitizeSyftOutput(
            JSON.parse(command(syft, [image, "-o", "json"])),
          );
          const rawSyft = JSON.stringify(sbom);
          validateSyftOutput(sbom, image, item);
          const identity = registryIdentity(image);
          validateImageIdentity(identity, image, sbom);
          const postVersion = command(trivy, [
            "--version",
            "--cache-dir",
            cache,
          ]);
          const usedDb = postVersion.match(
            /Vulnerability DB:\s*Version:\s*(\d+)\s*UpdatedAt:\s*([^\n]+)/,
          );
          if (
            !usedDb ||
            String(db.Version) !== usedDb[1] ||
            Date.parse(db.UpdatedAt) !== Date.parse(usedDb[2])
          )
            throw new Error(
              `${image}: vulnerability database changed during scan.`,
            );
          const inventory = {
            image,
            platform: item.platform,
            generator: "Syft",
            generatorVersion: syftVersion,
            generatedAt: new Date().toISOString(),
            packages: (sbom.artifacts ?? []).map((pkg) => ({
              name: pkg.name,
              version: pkg.version,
              type: pkg.type,
              locations: (pkg.locations ?? []).map((loc) => loc.path),
            })),
          };
          const sbomText = await prettier.format(JSON.stringify(inventory), {
            parser: "json",
          });
          const sbomSha256 = createHash("sha256")
            .update(sbomText)
            .digest("hex");
          const rawTrivyBytes = gzipSync(rawScan);
          const rawSyftBytes = gzipSync(rawSyft);
          const identityText = JSON.stringify(identity, null, 2) + "\n";
          const identitySha256 = createHash("sha256")
            .update(identityText)
            .digest("hex");
          await writeFile(
            resolve(stage, `identity-${suffix}.json`),
            identityText,
          );
          await writeFile(
            resolve(stage, `trivy-${suffix}.json.gz`),
            rawTrivyBytes,
          );
          await writeFile(
            resolve(stage, `syft-${suffix}.json.gz`),
            rawSyftBytes,
          );
          await writeFile(resolve(stage, `sbom-${suffix}.json`), sbomText);
          const findings = vulnerabilities.map((v) => ({
            cve: v.VulnerabilityID,
            package: v.PkgName,
            installedVersion: v.InstalledVersion,
            fixedVersion: v.FixedVersion ?? null,
            fixedStatus: v.Status ?? "unknown",
            packagePath: findingPackagePath(v, scan.Metadata.OS?.Family),
            packagePathSource: v.PkgPath
              ? "Trivy package path"
              : "OS package database provenance",
            severity: v.Severity,
            advisory: v.PrimaryURL ?? null,
            dispositionStatus: "unreviewed",
            dispositionScope: "local-development",
          }));
          const evidence = {
            schemaVersion: EVIDENCE_SCHEMA,
            image,
            tag: item.tag,
            digest: suffix,
            platform: item.platform,
            configurationHash: hash,
            mountHashes,
            scanner: "Trivy",
            scannerVersion,
            scannerBinarySha256,
            syftVersion,
            syftBinarySha256,
            scannerIsolation: {
              config: "infra/docker/security/trivy-image.yaml",
              ignorefile: "/dev/null",
              inheritedOverridesRemoved: true,
              anonymousRegistryConfig: true,
            },
            databaseUpdatedAt: new Date(usedDb[2]).toISOString(),
            databaseVersion: Number(usedDb[1]),
            scanCommand: `trivy image --config infra/docker/security/trivy-image.yaml --ignorefile /dev/null --cache-dir <local-cache> --scanners vuln --severity HIGH,CRITICAL --list-all-pkgs --format json ${image}`,
            syftCommand: `syft ${image} -o json`,
            scanOptions: ["vuln", "HIGH,CRITICAL", "list-all-pkgs"],
            scannedAt: Number.isFinite(Date.parse(scan.CreatedAt))
              ? new Date(scan.CreatedAt).toISOString()
              : null,
            collectionStatus: "complete",
            coverage: { trivyResults: true, syftArtifacts: true },
            sbomFile: `sbom-${suffix}.json`,
            sbomSha256,
            rawTrivyFile: `trivy-${suffix}.json.gz`,
            rawTrivySha256: createHash("sha256")
              .update(rawTrivyBytes)
              .digest("hex"),
            rawSyftFile: `syft-${suffix}.json.gz`,
            rawSyftSha256: createHash("sha256")
              .update(rawSyftBytes)
              .digest("hex"),
            identityFile: `identity-${suffix}.json`,
            identitySha256,
            findings,
          };
          if (!validateScanEvidence(evidence, item, hash, new Date()))
            throw new Error(
              `${image}: completed scanner evidence failed policy validation; accepted evidence retained.`,
            );
          collected.set(image, evidence);
          await writeFile(
            resolve(stage, `scan-${suffix}.json`),
            JSON.stringify(evidence, null, 2) + "\n",
          );
          console.log(
            `${image}: ${findings.length} High/Critical findings; evidence retained.`,
          );
        }
        if (serviceScope === null) {
          for (const name of await readdir(output).catch((error) => {
            if (error.code === "ENOENT") return [];
            throw error;
          })) {
            if (
              /^historical-[a-z0-9-]+\.json\.gz$/.test(name) ||
              name === "keycloak-provenance.json" ||
              name === "keycloak-docker-provenance.json"
            )
              await copyFile(resolve(output, name), resolve(stage, name));
          }
          await publishCompletedCollection(stage, output, true);
        }
        if (action === "collect-evaluate") {
          const records = Object.entries(images).map(([service, item]) => ({
            ...collected.get(item.image),
            service,
          }));
          const result = evaluateLocalEligibility({
            context: "local-development",
            config,
            mountHashes,
            images,
            evidence: records,
            dispositions,
            scanSucceeded: true,
            approvalVerifier,
          });
          if (!result.eligible) throw new Error(result.errors.join("\n"));
          console.log(`LOCAL_ELIGIBILITY_BINDING=${hash}`);
          if (serviceScope !== null)
            console.log(`LOCAL_ELIGIBILITY_SERVICES=${serviceScope}`);
          if (cp1Postgres)
            console.log("LOCAL_ELIGIBILITY_PROFILE=cp1-postgres");
        }
        if (serviceScope !== null)
          await rm(stage, { recursive: true, force: true });
      } catch (error) {
        await rm(stage, { recursive: true, force: true });
        throw error;
      }
    } else {
      const records = [];
      for (const [service, item] of Object.entries(images)) {
        const suffix = item.image.split("@sha256:")[1];
        const record = JSON.parse(
          await readFile(resolve(output, `scan-${suffix}.json`), "utf8"),
        );
        if (
          record.schemaVersion !== EVIDENCE_SCHEMA ||
          record.rawTrivyFile !== `trivy-${suffix}.json.gz` ||
          record.rawSyftFile !== `syft-${suffix}.json.gz` ||
          record.sbomFile !== `sbom-${suffix}.json`
        )
          throw new Error(
            `${service}: unsupported or incomplete scanner evidence; current collection required.`,
          );
        const sbom = await readFile(resolve(output, record.sbomFile));
        const rawTrivy = await readFile(resolve(output, record.rawTrivyFile));
        const rawSyft = await readFile(resolve(output, record.rawSyftFile));
        if (
          record.identityFile !== `identity-${suffix}.json` ||
          !/^[a-f0-9]{64}$/.test(record.identitySha256 ?? "")
        )
          throw new Error(`${service}: image index provenance missing.`);
        const identityText = await readFile(
          resolve(output, record.identityFile),
        );
        if (
          createHash("sha256").update(identityText).digest("hex") !==
          record.identitySha256
        )
          throw new Error(
            `${service}: image index provenance checksum mismatch.`,
          );
        if (
          createHash("sha256").update(rawTrivy).digest("hex") !==
            record.rawTrivySha256 ||
          createHash("sha256").update(rawSyft).digest("hex") !==
            record.rawSyftSha256
        )
          throw new Error(
            `${service}: raw scanner or inventory checksum mismatch.`,
          );
        const trivyRecord = JSON.parse(gunzipSync(rawTrivy));
        const syftRecord = JSON.parse(gunzipSync(rawSyft));
        const rawFindings = validateTrivyOutput(trivyRecord, item.image, item);
        validateSyftOutput(syftRecord, item.image, item);
        validateImageIdentity(JSON.parse(identityText), item.image, syftRecord);
        if (
          !findingsMatchOriginal(
            record.findings,
            rawFindings,
            trivyRecord.Metadata.OS?.Family,
          )
        )
          throw new Error(
            `${service}: derived finding summary differs from original scanner output.`,
          );
        const sbomRecord = JSON.parse(sbom);
        if (
          sbomRecord.image !== record.image ||
          sbomRecord.platform !== record.platform ||
          !Array.isArray(sbomRecord.packages)
        )
          throw new Error(
            `${service}: SBOM image identity or package inventory mismatch.`,
          );
        if (
          createHash("sha256").update(sbom).digest("hex") !== record.sbomSha256
        )
          throw new Error(`${service}: SBOM evidence checksum mismatch.`);
        records.push({
          ...record,
          service,
          configurationHash: record.configurationHash,
        });
      }
      if (action === "validate") {
        const invalid = records.filter(
          (record) =>
            !validateScanEvidence(
              record,
              images[record.service],
              hash,
              new Date(),
            ) ||
            JSON.stringify(record.mountHashes ?? {}) !==
              JSON.stringify(mountHashes),
        );
        if (invalid.length)
          throw new Error(
            `Incomplete current evidence for ${invalid.map((record) => record.service).join(", ")}.`,
          );
        console.log(
          `${new Set(records.map((record) => record.image)).size} unique image evidence records valid across ${records.length} services; local eligibility is a separate denied decision.`,
        );
      } else {
        const result = evaluateLocalEligibility({
          context: "local-development",
          config,
          mountHashes,
          images,
          evidence: records,
          dispositions,
          scanSucceeded: false,
          approvalVerifier,
        });
        console.error(
          "Cached assessment is not proof of a successful current collection.",
        );
        if (!result.eligible) throw new Error(result.errors.join("\n"));
        console.log(
          "Local-development eligibility approved for exact reviewed evidence.",
        );
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
