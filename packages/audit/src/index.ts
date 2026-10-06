export type ActorKind =
  "USER" | "PRINCIPAL" | "SERVICE" | "SUPPORT" | "BOOTSTRAP";
export type AuditScope = "TENANT" | "GLOBAL_CORPUS";

export type ActorRef = Readonly<{ id: string; kind: ActorKind }>;

export type AuditContext = Readonly<{
  scope: AuditScope;
  tenantId?: string;
  actor?: ActorRef;
  correlationId: string;
  causationId?: string;
  policyDecisionId?: string;
  sourceChannel: string;
}>;

export type AuditRecord = Readonly<{
  action: string;
  resourceType: string;
  resourceId: string;
  resourceVersion?: string;
  result: "SUCCESS" | "FAILURE" | "DENIED";
  changedFieldNames?: readonly string[];
  beforeDigest?: string;
  afterDigest?: string;
}>;

export type DomainEvent = Readonly<{
  eventId: string;
  type: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type IdempotencyClaim = Readonly<{
  actorId: string;
  route: string;
  key: string;
  requestHash: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;
const PROHIBITED =
  /password|secret|token|credential|private[_-]?key|otp|bearer|prompt|uploaded[_-]?content/i;

function requireUuid(value: string, label: string): void {
  if (!UUID.test(value)) throw new TypeError(`${label} must be a UUID`);
}

function assertSafePayload(value: unknown, path = "payload"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSafePayload(item, `${path}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (PROHIBITED.test(key))
      throw new TypeError(`prohibited audit field: ${path}.${key}`);
    assertSafePayload(nested, `${path}.${key}`);
  }
}

export function createAuditContext(input: {
  readonly tenantId?: string;
  readonly scope?: AuditScope;
  readonly actor?: ActorRef;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly policyDecisionId?: string;
  readonly sourceChannel: string;
}): AuditContext {
  const scope = input.scope ?? "TENANT";
  if (!input.correlationId) throw new TypeError("correlationId is required");
  requireUuid(input.correlationId, "correlationId");
  if (scope === "TENANT") {
    if (!input.tenantId)
      throw new TypeError("tenantId is required for tenant audit");
    requireUuid(input.tenantId, "tenantId");
  } else if (input.tenantId) {
    throw new TypeError("global audit cannot carry tenantId");
  }
  if (!SAFE_NAME.test(input.sourceChannel))
    throw new TypeError("sourceChannel is invalid");
  if (input.actor) {
    requireUuid(input.actor.id, "actor.id");
    if (!input.actor.kind) throw new TypeError("actor.kind is required");
  }
  if (input.causationId) requireUuid(input.causationId, "causationId");
  if (input.policyDecisionId)
    requireUuid(input.policyDecisionId, "policyDecisionId");
  return {
    scope,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    ...(input.actor ? { actor: input.actor } : {}),
    correlationId: input.correlationId,
    ...(input.causationId ? { causationId: input.causationId } : {}),
    ...(input.policyDecisionId
      ? { policyDecisionId: input.policyDecisionId }
      : {}),
    sourceChannel: input.sourceChannel,
  };
}

export function validateDomainEvent(input: {
  readonly eventId: string;
  readonly type: string;
  readonly schemaVersion: number;
  readonly tenantId?: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion?: string;
  readonly sequence?: string;
  readonly occurredAt?: string;
  readonly recordedAt?: string;
  readonly actor: ActorRef;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly policyVersion: string;
  readonly payload: Readonly<Record<string, unknown>>;
}): void {
  requireUuid(input.eventId, "eventId");
  requireUuid(input.aggregateId, "aggregateId");
  requireUuid(input.correlationId, "correlationId");
  requireUuid(input.actor.id, "actor.id");
  requireUuid(input.policyVersion, "policyVersion");
  if (input.tenantId) requireUuid(input.tenantId, "tenantId");
  if (!SAFE_NAME.test(input.type) || input.schemaVersion < 1)
    throw new TypeError("event type/schema is invalid");
  if (!SAFE_NAME.test(input.aggregateType))
    throw new TypeError("aggregateType is invalid");
  assertSafePayload(input.payload);
}

export interface AuditTransaction {
  recordAudit(record: AuditRecord): void;
  enqueue(event: DomainEvent): void;
  claimIdempotency(claim: IdempotencyClaim): void;
  mutate<T>(operation: () => T | Promise<T>): Promise<T>;
}

export interface AtomicAuditUnitOfWork {
  run<T>(
    context: AuditContext,
    operation: (transaction: AuditTransaction) => Promise<T>,
  ): Promise<T>;
}

export class InMemoryAtomicAuditUnitOfWork implements AtomicAuditUnitOfWork {
  #audits: Array<{ context: AuditContext; record: AuditRecord }> = [];
  #outbox: Array<{ context: AuditContext; event: DomainEvent }> = [];
  #idempotency = new Map<string, string>();

  get auditCount(): number {
    return this.#audits.length;
  }
  get outboxCount(): number {
    return this.#outbox.length;
  }
  get idempotencyCount(): number {
    return this.#idempotency.size;
  }

  async run<T>(
    context: AuditContext,
    operation: (transaction: AuditTransaction) => Promise<T>,
  ): Promise<T> {
    const auditLength = this.#audits.length;
    const outboxLength = this.#outbox.length;
    const idempotency = new Map(this.#idempotency);
    const transaction: AuditTransaction = {
      recordAudit: (record) => {
        if (!record.action || !SAFE_NAME.test(record.action))
          throw new TypeError("audit action is invalid");
        if (!record.resourceType || !record.resourceId)
          throw new TypeError("audit resource is required");
        assertSafePayload(record);
        this.#audits.push({ context, record });
      },
      enqueue: (event) => {
        validateDomainEvent({
          ...event,
          ...(context.tenantId ? { tenantId: context.tenantId } : {}),
          actor: context.actor ?? {
            id: context.correlationId,
            kind: "BOOTSTRAP",
          },
          correlationId: context.correlationId,
          policyVersion: context.policyDecisionId ?? context.correlationId,
          payload: event.payload,
        });
        this.#outbox.push({ context, event });
      },
      claimIdempotency: (claim) => {
        const composite = `${claim.actorId}\u0000${claim.route}\u0000${claim.key}`;
        const existing = this.#idempotency.get(composite);
        if (existing && existing !== claim.requestHash)
          throw new Error("idempotency key conflicts with request hash");
        this.#idempotency.set(composite, claim.requestHash);
      },
      mutate: async (operation) => operation(),
    };
    try {
      return await operation(transaction);
    } catch (error) {
      this.#audits.length = auditLength;
      this.#outbox.length = outboxLength;
      this.#idempotency = idempotency;
      throw error;
    }
  }
}
