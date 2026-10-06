import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import {
  approvalFingerprint,
  approvalItemDigest,
  approvalSigningBytes,
  loadOperationalTrust,
  verifyLocalApproval,
} from "../../scripts/local-approval.mjs";

const sha = (character) => character.repeat(64);
const pair = generateKeyPairSync("ed25519"); // Synthetic test fixture only.
const publicKeyPem = pair.publicKey.export({ type: "spki", format: "pem" });
const item = {
  cve: "CVE-2026-1",
  package: "fixture",
  installedVersion: "1",
  packagePath: "/fixture",
  severity: "HIGH",
  fixedVersion: "2",
  fixedStatus: "affected",
  image: `example.test/fixture@sha256:${sha("a")}`,
  platform: "linux/amd64",
  configurationHash: sha("b"),
  classification: "scanner-correction",
  owner: "fixture-owner",
  remediationTicket: "F003-1",
  approvedAt: "2026-10-05T00:00:00.000Z",
  reviewBy: "2026-10-07T00:00:00.000Z",
  expiresAt: "2026-10-08T00:00:00.000Z",
  approval: { protectedReference: "TEST-1" },
};
const scan = {
  rawTrivySha256: sha("c"),
  rawSyftSha256: sha("d"),
  sbomSha256: sha("e"),
  identitySha256: sha("f"),
};
const payload = {
  schemaVersion: 1,
  policyVersion: 1,
  verifierVersion: 1,
  scope: "local-development",
  itemSha256: approvalItemDigest(item),
  occurrence: Object.fromEntries(
    [
      "cve",
      "package",
      "installedVersion",
      "packagePath",
      "severity",
      "fixedVersion",
      "fixedStatus",
    ].map((key) => [key, item[key]]),
  ),
  image: item.image,
  platform: item.platform,
  configurationHash: item.configurationHash,
  evidenceChecksums: scan,
  classification: item.classification,
  owner: item.owner,
  remediationTicket: item.remediationTicket,
  approvedAt: item.approvedAt,
  reviewBy: item.reviewBy,
  expiresAt: item.expiresAt,
  revision: 2,
  approvalReference: "TEST-1",
};
const trust = {
  authority: "independent-local-security-review",
  publicKeyPem,
  fingerprint: approvalFingerprint(publicKeyPem),
  minimumRevisions: { "TEST-1": 2 },
  revokedManifestDigests: [],
};
const now = new Date("2026-10-06T00:00:00.000Z");
function envelope(body = payload, signer = pair.privateKey) {
  const bytes = Buffer.from(JSON.stringify(body));
  return {
    payloadBase64: bytes.toString("base64"),
    signatureBase64: sign(null, approvalSigningBytes(bytes), signer).toString(
      "base64",
    ),
  };
}
const verdict = (
  signed,
  key = trust,
  candidate = item,
  evidence = scan,
  at = now,
) => verifyLocalApproval(signed, key, candidate, evidence, at);

test("R3 exact signed approval contract rejects tampering, identity and chronology changes", () => {
  const signed = envelope();
  assert.equal(verdict(signed), true);
  assert.equal(verdict({ ...signed, signatureBase64: "" }), false);
  assert.equal(
    verdict({
      ...signed,
      payloadBase64: Buffer.from(
        JSON.stringify({ ...payload, scope: "saas-production" }),
      ).toString("base64"),
    }),
    false,
  );
  const other = generateKeyPairSync("ed25519");
  assert.equal(verdict(envelope(payload, other.privateKey)), false);
  const substitutePem = other.publicKey.export({ type: "spki", format: "pem" });
  assert.equal(
    verdict(signed, { ...trust, publicKeyPem: substitutePem }),
    false,
  );
  assert.equal(
    verdict(signed, {
      ...trust,
      revokedManifestDigests: [
        createHash("sha256")
          .update(Buffer.from(signed.payloadBase64, "base64"))
          .digest("hex"),
      ],
    }),
    false,
  );
  assert.equal(
    verdict(signed, { ...trust, minimumRevisions: { "TEST-1": 3 } }),
    false,
  );
  assert.equal(
    verdict(signed, trust, { ...item, configurationHash: sha("0") }),
    false,
  );
  assert.equal(
    verdict(signed, trust, item, { ...scan, sbomSha256: sha("0") }),
    false,
  );
  assert.equal(verdict(signed, trust, { ...item, cve: "CVE-2026-2" }), false);
  assert.equal(
    verdict(envelope({ ...payload, scope: "saas-production" })),
    false,
  );
  assert.equal(
    verdict(signed, trust, item, scan, new Date("2026-10-09T00:00:00.000Z")),
    false,
  );
  assert.equal(
    verdict(envelope({ ...payload, approvedAt: "2099-01-01T00:00:00.000Z" })),
    false,
  );
});

test("synthetic signer cannot be provisioned from agent-controlled repository content", async () => {
  await assert.rejects(
    loadOperationalTrust(
      new URL("../../infra/docker/security/dispositions.json", import.meta.url)
        .pathname,
    ),
    /outside workspace/,
  );
  await assert.rejects(loadOperationalTrust(), /outside workspace/);
});
