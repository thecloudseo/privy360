export type SecretReference = string & {
  readonly __secretReference: unique symbol;
};

export type ProviderName = "vault" | "customer-managed" | "fake";

export interface SecretStore {
  get(reference: SecretReference): Promise<SecretValue>;
}

export interface KeyProvider {
  getKey(keyReference: SecretReference): Promise<KeyHandle>;
}

export interface SecretValue {
  readonly value: string;
  readonly version: string;
}

export interface KeyHandle {
  readonly reference: SecretReference;
  readonly version: string;
}

export interface SecurityProviderConfig {
  readonly provider: ProviderName;
  readonly endpoint?: string;
  readonly allowFake: boolean;
}

export class SecurityConfigurationError extends Error {
  readonly code = "SECURITY_PROVIDER_CONFIGURATION_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "SecurityConfigurationError";
  }
}

export class SecretAccessDeniedError extends Error {
  readonly code = "SECRET_ACCESS_DENIED";

  constructor() {
    super("Secret access denied.");
    this.name = "SecretAccessDeniedError";
  }
}

export function parseSecurityProviderConfig(
  input: Record<string, string | undefined>,
): SecurityProviderConfig {
  const provider = input.SECURITY_PROVIDER;
  if (
    provider !== "vault" &&
    provider !== "customer-managed" &&
    provider !== "fake"
  ) {
    throw new SecurityConfigurationError(
      "A supported security provider is required.",
    );
  }

  const allowFake = input.SECURITY_ALLOW_FAKE === "true";
  if (provider === "fake" && !allowFake) {
    throw new SecurityConfigurationError(
      "The fake security provider is test-only.",
    );
  }

  const endpoint = input.SECURITY_PROVIDER_ENDPOINT;
  if (provider !== "fake" && !endpoint) {
    throw new SecurityConfigurationError(
      "A security provider endpoint is required.",
    );
  }

  return {
    provider,
    ...(endpoint ? { endpoint } : {}),
    allowFake,
  };
}

export class FakeSecurityProvider implements SecretStore, KeyProvider {
  readonly #secrets = new Map<SecretReference, SecretValue>();
  readonly #keys = new Set<SecretReference>();

  constructor(options: { readonly allowFake: boolean }) {
    if (!options.allowFake) {
      throw new SecurityConfigurationError(
        "The fake security provider is test-only.",
      );
    }
  }

  seedSecret(
    reference: SecretReference,
    value: string,
    version = "test-v1",
  ): void {
    this.#secrets.set(reference, { value, version });
  }

  seedKey(reference: SecretReference): void {
    this.#keys.add(reference);
  }

  async get(reference: SecretReference): Promise<SecretValue> {
    const secret = this.#secrets.get(reference);
    if (!secret) throw new SecretAccessDeniedError();
    return { ...secret };
  }

  async getKey(reference: SecretReference): Promise<KeyHandle> {
    if (!this.#keys.has(reference)) throw new SecretAccessDeniedError();
    return { reference, version: "test-v1" };
  }
}

export function secretReference(value: string): SecretReference {
  if (!/^[-a-zA-Z0-9_./:]+$/.test(value) || value.length > 256) {
    throw new SecurityConfigurationError("Invalid secret reference.");
  }
  return value as SecretReference;
}

export * from "./tenant-context.ts";
export * from "./tenant-infrastructure.ts";
export * from "./tenant-transaction.ts";
export * from "./permissions.ts";
export * from "./authz.ts";
