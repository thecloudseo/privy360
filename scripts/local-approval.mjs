import { createHash, createPublicKey, verify } from "node:crypto";
import { Buffer } from "node:buffer";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import process from "node:process";
import { resolve } from "node:path";

const domain = Buffer.from(
  "Privy360 FOUNDATION-003 local disposition approval v1\n",
);
const hex = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const keys = (value, expected) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join() === expected.sort().join();
const time = (value) =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
export const approvalFingerprint = (pem) =>
  createHash("sha256")
    .update(createPublicKey(pem).export({ type: "spki", format: "der" }))
    .digest("hex");
export const approvalItemDigest = (item) => {
  const body = { ...item };
  delete body.approvalEnvelope;
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
};

// The trust record must be provisioned outside the repository by an independent reviewer.
// This loader deliberately cannot elevate a checked-in key or a synthetic fixture.
export async function loadOperationalTrust(path) {
  const workspace = resolve(import.meta.dirname, "..");
  if (
    !path ||
    !path.startsWith("/") ||
    path === workspace ||
    path.startsWith(`${workspace}/`)
  )
    throw new Error(
      "Protected approval trust record required outside workspace.",
    );
  // Open once with O_NOFOLLOW; every check and the read use this descriptor, so the
  // path cannot be swapped between validation and read.
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  let trust;
  try {
    const metadata = await handle.stat();
    const actualPath = await realpath(path);
    if (
      !metadata.isFile() ||
      actualPath === workspace ||
      actualPath.startsWith(`${workspace}/`) ||
      metadata.uid === process.getuid() ||
      metadata.mode & 0o022
    )
      throw new Error("Approval trust record is not independently protected.");
    trust = JSON.parse(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
  if (
    !keys(trust, [
      "schemaVersion",
      "publicKeyPem",
      "fingerprint",
      "minimumRevisions",
      "revokedManifestDigests",
      "authority",
    ]) ||
    trust.schemaVersion !== 1 ||
    trust.authority !== "independent-local-security-review" ||
    !trust.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----") ||
    createPublicKey(trust.publicKeyPem).asymmetricKeyType !== "ed25519" ||
    trust.fingerprint !== approvalFingerprint(trust.publicKeyPem) ||
    !keys(trust.minimumRevisions, Object.keys(trust.minimumRevisions)) ||
    Object.values(trust.minimumRevisions).some(
      (revision) => !Number.isSafeInteger(revision) || revision < 1,
    ) ||
    !Array.isArray(trust.revokedManifestDigests) ||
    trust.revokedManifestDigests.some((digest) => !hex(digest))
  )
    throw new Error("Protected approval trust record malformed.");
  return trust;
}

export function verifyLocalApproval(
  envelope,
  trust,
  item,
  scan,
  now = new Date(),
) {
  try {
    if (
      !keys(envelope, ["payloadBase64", "signatureBase64"]) ||
      !trust ||
      trust.authority !== "independent-local-security-review" ||
      !trust.publicKeyPem ||
      createPublicKey(trust.publicKeyPem).asymmetricKeyType !== "ed25519" ||
      trust.fingerprint !== approvalFingerprint(trust.publicKeyPem)
    )
      return false;
    const body = Buffer.from(envelope.payloadBase64, "base64");
    const signature = Buffer.from(envelope.signatureBase64, "base64");
    if (
      !body.length ||
      signature.length !== 64 ||
      body.toString("base64") !== envelope.payloadBase64 ||
      signature.toString("base64") !== envelope.signatureBase64 ||
      !verify(
        null,
        Buffer.concat([domain, body]),
        trust.publicKeyPem,
        signature,
      )
    )
      return false;
    const payload = JSON.parse(body);
    const required = [
      "schemaVersion",
      "policyVersion",
      "verifierVersion",
      "scope",
      "itemSha256",
      "occurrence",
      "image",
      "platform",
      "configurationHash",
      "evidenceChecksums",
      "classification",
      "owner",
      "remediationTicket",
      "approvedAt",
      "reviewBy",
      "expiresAt",
      "revision",
      "approvalReference",
    ];
    if (
      !keys(payload, required) ||
      payload.schemaVersion !== 1 ||
      payload.policyVersion !== 1 ||
      payload.verifierVersion !== 1 ||
      payload.scope !== "local-development" ||
      !hex(payload.itemSha256) ||
      payload.itemSha256 !== approvalItemDigest(item) ||
      payload.image !== item.image ||
      payload.platform !== item.platform ||
      payload.configurationHash !== item.configurationHash ||
      payload.classification !== item.classification ||
      payload.owner !== item.owner ||
      payload.remediationTicket !== item.remediationTicket ||
      payload.approvedAt !== item.approvedAt ||
      payload.reviewBy !== item.reviewBy ||
      payload.expiresAt !== item.expiresAt ||
      payload.approvalReference !== item.approval?.protectedReference
    )
      return false;
    const occurrence = [
      "cve",
      "package",
      "installedVersion",
      "packagePath",
      "severity",
      "fixedVersion",
      "fixedStatus",
    ];
    if (
      !keys(payload.occurrence, occurrence) ||
      occurrence.some((key) => payload.occurrence[key] !== item[key])
    )
      return false;
    const checks = [
      "rawTrivySha256",
      "rawSyftSha256",
      "sbomSha256",
      "identitySha256",
    ];
    if (
      !keys(payload.evidenceChecksums, checks) ||
      checks.some(
        (key) =>
          !hex(payload.evidenceChecksums[key]) ||
          payload.evidenceChecksums[key] !== scan?.[key],
      )
    )
      return false;
    const timestamp = now.getTime();
    if (
      !Number.isFinite(timestamp) ||
      ![payload.approvedAt, payload.reviewBy, payload.expiresAt].every(time) ||
      Date.parse(payload.approvedAt) > timestamp ||
      Date.parse(payload.reviewBy) <= timestamp ||
      Date.parse(payload.expiresAt) <= timestamp ||
      !(
        Date.parse(payload.approvedAt) < Date.parse(payload.reviewBy) &&
        Date.parse(payload.reviewBy) <= Date.parse(payload.expiresAt)
      )
    )
      return false;
    if (
      !Number.isSafeInteger(payload.revision) ||
      payload.revision < 1 ||
      typeof payload.approvalReference !== "string" ||
      !/^[A-Z0-9][A-Z0-9-]{2,80}$/.test(payload.approvalReference) ||
      !Object.hasOwn(trust.minimumRevisions ?? {}, payload.approvalReference) ||
      payload.revision <
        (trust.minimumRevisions?.[payload.approvalReference] ?? Infinity)
    )
      return false;
    const manifestDigest = createHash("sha256").update(body).digest("hex");
    if (trust.revokedManifestDigests?.includes(manifestDigest)) return false;
    return true;
  } catch {
    return false;
  }
}

export function approvalSigningBytes(payloadBytes) {
  return Buffer.concat([domain, payloadBytes]);
}
