export type DeliveryScope = "TENANT" | "GLOBAL_CORPUS";
export type DeliveryState = "PENDING" | "LEASED" | "DELIVERED" | "DEAD_LETTER";

export type DeliveryEnvelope = Readonly<{
  eventId: string;
  scope: DeliveryScope;
  tenantId?: string;
  consumer: string;
  correlationId: string;
  causationId?: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type DeadLetter = Readonly<{
  eventId: string;
  reason: string;
  attempts: number;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;
const PROHIBITED =
  /password|secret|token|credential|private[_-]?key|otp|bearer|prompt|uploaded[_-]?content/i;

function assertSafe(value: unknown, path = "payload"): void {
  if (Array.isArray(value))
    return value.forEach((item, i) => assertSafe(item, `${path}[${i}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (PROHIBITED.test(key))
      throw new TypeError(`prohibited audit field: ${path}.${key}`);
    assertSafe(nested, `${path}.${key}`);
  }
}

function validateEnvelope(envelope: DeliveryEnvelope): void {
  for (const [name, value] of [
    ["eventId", envelope.eventId],
    ["correlationId", envelope.correlationId],
  ] as const)
    if (!UUID.test(value)) throw new TypeError(`${name} must be a UUID`);
  if (envelope.causationId && !UUID.test(envelope.causationId))
    throw new TypeError("causationId must be a UUID");
  if (!NAME.test(envelope.consumer)) throw new TypeError("consumer is invalid");
  if (envelope.scope === "TENANT") {
    if (!envelope.tenantId || !UUID.test(envelope.tenantId))
      throw new TypeError("tenantId is required for tenant delivery");
  } else if (envelope.tenantId)
    throw new TypeError("global delivery cannot carry tenantId");
  assertSafe(envelope.payload);
}

type Item = {
  envelope: DeliveryEnvelope;
  state: DeliveryState;
  attempts: number;
  reason?: string;
};

export class InMemoryAuditDelivery {
  readonly #items = new Map<string, Item>();
  readonly #receipts = new Set<string>();
  readonly #dead = new Map<string, DeadLetter>();
  readonly #maxAttempts: number;

  constructor(options: { maxAttempts?: number } = {}) {
    this.#maxAttempts = options.maxAttempts ?? 5;
    if (!Number.isInteger(this.#maxAttempts) || this.#maxAttempts < 1)
      throw new TypeError("maxAttempts must be positive");
  }

  enqueue(envelope: DeliveryEnvelope): void {
    validateEnvelope(envelope);
    if (this.#items.has(envelope.eventId))
      throw new Error("event already enqueued");
    this.#items.set(envelope.eventId, {
      envelope,
      state: "PENDING",
      attempts: 0,
    });
  }

  async dispatch(
    eventId: string,
    publish: (envelope: DeliveryEnvelope) => Promise<void> | void,
  ): Promise<void> {
    const item = this.#items.get(eventId);
    if (!item) throw new Error("outbox event not found");
    if (item.state === "DELIVERED") return;
    if (item.state === "DEAD_LETTER") throw new Error("event is dead-lettered");
    item.state = "LEASED";
    item.attempts++;
    try {
      await publish(item.envelope);
      item.state = "DELIVERED";
    } catch (error) {
      const reason = error instanceof Error ? error.message : "delivery failed";
      if (item.attempts >= this.#maxAttempts) {
        item.state = "DEAD_LETTER";
        item.reason = reason;
        this.#dead.set(eventId, { eventId, reason, attempts: item.attempts });
      } else item.state = "PENDING";
      throw error;
    }
  }

  async consume(
    envelope: DeliveryEnvelope,
    effect: () => Promise<void> | void,
  ): Promise<boolean> {
    const key = `${envelope.scope}\u0000${envelope.tenantId ?? "GLOBAL"}\u0000${envelope.consumer}\u0000${envelope.eventId}`;
    if (this.#receipts.has(key)) return false;
    this.#receipts.add(key);
    try {
      await effect();
      return true;
    } catch (error) {
      this.#receipts.delete(key);
      throw error;
    }
  }

  replay(eventId: string, operator: { scope: string }): boolean {
    if (operator.scope !== "AUDIT_OPERATOR")
      throw new Error("replay requires scoped audit operator");
    const item = this.#items.get(eventId);
    if (!item || item.state !== "DEAD_LETTER") return false;
    item.state = "PENDING";
    delete item.reason;
    this.#dead.delete(eventId);
    return true;
  }

  outboxState(eventId: string): DeliveryState | undefined {
    return this.#items.get(eventId)?.state;
  }
  deadLetters(): DeadLetter[] {
    return [...this.#dead.values()];
  }
  envelope(
    eventId: string,
  ): [DeliveryScope, string | undefined, string, string, string | undefined] {
    const item = this.#items.get(eventId);
    if (!item) throw new Error("outbox event not found");
    return [
      item.envelope.scope,
      item.envelope.tenantId,
      item.envelope.consumer,
      item.envelope.correlationId,
      item.envelope.causationId,
    ];
  }
}
