import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FakeSecurityProvider,
  SecretAccessDeniedError,
  SecurityConfigurationError,
  parseSecurityProviderConfig,
  secretReference,
} from "../../packages/security/src/index.ts";

test("provider configuration requires an approved provider and fails closed", () => {
  assert.deepEqual(
    parseSecurityProviderConfig({
      SECURITY_PROVIDER: "vault",
      SECURITY_PROVIDER_ENDPOINT: "https://vault.test",
    }),
    { provider: "vault", endpoint: "https://vault.test", allowFake: false },
  );
  assert.throws(
    () => parseSecurityProviderConfig({ SECURITY_PROVIDER: "vault" }),
    SecurityConfigurationError,
  );
  assert.throws(
    () => parseSecurityProviderConfig({ SECURITY_PROVIDER: "fake" }),
    SecurityConfigurationError,
  );
});

test("fake provider is explicitly test-only and returns seeded synthetic values", async () => {
  const provider = new FakeSecurityProvider({ allowFake: true });
  const reference = secretReference("test/secret");
  provider.seedSecret(reference, "synthetic-only");
  provider.seedKey(secretReference("test/key"));

  assert.deepEqual(await provider.get(reference), {
    value: "synthetic-only",
    version: "test-v1",
  });
  await assert.rejects(
    provider.get(secretReference("test/missing")),
    SecretAccessDeniedError,
  );
  assert.throws(
    () => new FakeSecurityProvider({ allowFake: false }),
    SecurityConfigurationError,
  );
});

test("denial errors do not disclose references or secret values", async () => {
  const provider = new FakeSecurityProvider({ allowFake: true });
  const error = await provider
    .get(secretReference("tenant-a/private-secret"))
    .catch((value) => value);
  assert(error instanceof Error);
  assert.equal(error.message, "Secret access denied.");
  assert.doesNotMatch(error.message, /tenant-a|private-secret/);
});
