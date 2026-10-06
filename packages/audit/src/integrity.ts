import { createHash } from "node:crypto";

export type IntegrityScope = "TENANT" | "GLOBAL_CORPUS";

export interface SigningKeyProvider {
  sign(keyRef: string, canonicalBytes: Uint8Array): Promise<string>;
  verify(
    keyRef: string,
    canonicalBytes: Uint8Array,
    signature: string,
  ): Promise<boolean>;
}

export type AuditAnchorInput = Readonly<{
  scope: IntegrityScope;
  tenantId?: string;
  streamId: string;
  startSequence: number;
  endSequence: number;
  startPreviousHash: string | null;
  endHash: string;
  canonicalizationVersion: 1;
  keyRef: string;
  providerMetadata: Readonly<Record<string, unknown>>;
}>;

export type AuditAnchor = AuditAnchorInput &
  Readonly<{
    anchorDigest: string;
    signature: string;
  }>;

export type VerificationResult = Readonly<{
  verified: boolean;
  reason:
    | "VERIFIED"
    | "INVALID_METADATA"
    | "SCOPE_MISMATCH"
    | "DIGEST_MISMATCH"
    | "SIGNATURE_INVALID"
    | "PROVIDER_UNAVAILABLE";
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^[0-9a-f]+$/i;
const NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;
const PROHIBITED =
  /password|secret|token|credential|private[_-]?key|otp|bearer|prompt|uploaded[_-]?content/i;

function assertSafe(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafe(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (PROHIBITED.test(key))
      throw new TypeError(`prohibited audit field: ${path}.${key}`);
    assertSafe(nested, `${path}.${key}`);
  }
}

function assertInput(input: AuditAnchorInput): void {
  if (!UUID.test(input.streamId))
    throw new TypeError("streamId must be a UUID");
  if (input.scope === "TENANT") {
    if (!input.tenantId || !UUID.test(input.tenantId))
      throw new TypeError("tenantId is required for tenant anchor");
  } else if (input.tenantId) {
    throw new TypeError("global anchor cannot carry tenantId");
  }
  if (
    !Number.isSafeInteger(input.startSequence) ||
    input.startSequence < 1 ||
    !Number.isSafeInteger(input.endSequence) ||
    input.endSequence < input.startSequence
  ) {
    throw new TypeError("anchor sequence interval is invalid");
  }
  if (input.startSequence === 1 && input.startPreviousHash !== null)
    throw new TypeError("first anchor must start at null hash");
  if (input.startPreviousHash !== null && !HEX.test(input.startPreviousHash))
    throw new TypeError("startPreviousHash is invalid");
  if (!HEX.test(input.endHash)) throw new TypeError("endHash is invalid");
  if (input.canonicalizationVersion !== 1)
    throw new TypeError("unsupported canonicalization version");
  if (!NAME.test(input.keyRef)) throw new TypeError("keyRef is invalid");
  assertSafe(input.providerMetadata, "providerMetadata");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

function unsigned(anchor: AuditAnchorInput): AuditAnchorInput {
  return {
    scope: anchor.scope,
    ...(anchor.tenantId ? { tenantId: anchor.tenantId } : {}),
    streamId: anchor.streamId,
    startSequence: anchor.startSequence,
    endSequence: anchor.endSequence,
    startPreviousHash: anchor.startPreviousHash,
    endHash: anchor.endHash,
    canonicalizationVersion: anchor.canonicalizationVersion,
    keyRef: anchor.keyRef,
    providerMetadata: anchor.providerMetadata,
  };
}

function bytes(value: AuditAnchorInput): Uint8Array {
  return new TextEncoder().encode(canonical(unsigned(value)));
}

function digest(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createAnchor(
  input: AuditAnchorInput,
  provider: SigningKeyProvider,
): Promise<AuditAnchor> {
  assertInput(input);
  const canonicalBytes = bytes(input);
  let signature: string;
  try {
    signature = await provider.sign(input.keyRef, canonicalBytes);
  } catch {
    throw new Error("signing provider unavailable; anchor rejected");
  }
  if (!signature || !NAME.test(input.keyRef))
    throw new Error("signing provider returned invalid signature");
  return { ...input, anchorDigest: digest(canonicalBytes), signature };
}

export async function verifyAnchor(
  anchor: AuditAnchor,
  provider: SigningKeyProvider,
): Promise<VerificationResult> {
  try {
    assertInput(anchor);
    if (anchor.scope === "TENANT" && !anchor.tenantId)
      return { verified: false, reason: "SCOPE_MISMATCH" };
    const canonicalBytes = bytes(anchor);
    if (digest(canonicalBytes) !== anchor.anchorDigest)
      return { verified: false, reason: "DIGEST_MISMATCH" };
    if (
      !(await provider.verify(anchor.keyRef, canonicalBytes, anchor.signature))
    )
      return { verified: false, reason: "SIGNATURE_INVALID" };
    return { verified: true, reason: "VERIFIED" };
  } catch (error) {
    if (error instanceof Error && /provider unavailable/i.test(error.message))
      return { verified: false, reason: "PROVIDER_UNAVAILABLE" };
    return { verified: false, reason: "INVALID_METADATA" };
  }
}

export class InMemorySigningKeyProvider implements SigningKeyProvider {
  readonly #keys: Readonly<Record<string, string>>;

  constructor(keys: Readonly<Record<string, string>> = {}) {
    this.#keys = keys;
  }

  async sign(keyRef: string, canonicalBytes: Uint8Array): Promise<string> {
    const key = this.#keys[keyRef];
    if (!key) throw new Error("provider unavailable");
    return digest(
      new TextEncoder().encode(
        `${key}:` + new TextDecoder().decode(canonicalBytes),
      ),
    );
  }

  async verify(
    keyRef: string,
    canonicalBytes: Uint8Array,
    signature: string,
  ): Promise<boolean> {
    return (await this.sign(keyRef, canonicalBytes)) === signature;
  }
}
