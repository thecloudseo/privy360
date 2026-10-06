import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemorySigningKeyProvider,
  createAnchor,
  verifyAnchor,
} from "../../packages/audit/src/integrity.ts";

const uuid = "11111111-1111-4111-8111-111111111111";
const stream = "22222222-2222-4222-8222-222222222222";
const keyRef = "audit-signing-key-v1";
const provider = new InMemorySigningKeyProvider({ [keyRef]: "synthetic-key" });

const input = {
  scope: "TENANT",
  tenantId: uuid,
  streamId: stream,
  startSequence: 1,
  endSequence: 2,
  startPreviousHash: null,
  endHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  canonicalizationVersion: 1,
  keyRef,
  providerMetadata: { algorithm: "synthetic-test-only" },
};

test("exports and verifies a tenant anchor through the key provider", async () => {
  const anchor = await createAnchor(input, provider);
  assert.equal(anchor.scope, "TENANT");
  assert.equal((await verifyAnchor(anchor, provider)).verified, true);
});

test("rejects cross-scope anchor confusion and altered signed metadata", async () => {
  const anchor = await createAnchor(input, provider);
  await assert.rejects(() =>
    createAnchor({ ...input, scope: "GLOBAL_CORPUS" }, provider),
  );
  assert.equal(
    (await verifyAnchor({ ...anchor, endSequence: 3 }, provider)).verified,
    false,
  );
  assert.equal(
    (
      await verifyAnchor(
        { ...anchor, signature: `${anchor.signature}00` },
        provider,
      )
    ).verified,
    false,
  );
});

test("missing signing provider fails closed without an anchor", async () => {
  await assert.rejects(() =>
    createAnchor(input, new InMemorySigningKeyProvider()),
  );
});

test("anchor diagnostics do not accept prohibited sensitive fields", async () => {
  await assert.rejects(() =>
    createAnchor({ ...input, providerMetadata: { secret: "never" } }, provider),
  );
});
