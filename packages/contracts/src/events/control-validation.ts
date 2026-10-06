type DomainEvent = Readonly<{
  eventId: string;
  type: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type ControlValidationFailedPayload = Readonly<{
  controlId: string;
  controlRevision: number;
  failureCodes: readonly string[];
  traceabilityDigest: string;
}>;

export function createControlValidationFailedEvent(input: {
  eventId: string;
  controlId: string;
  controlRevision: number;
  failureCodes: readonly string[];
  traceabilityDigest: string;
}): DomainEvent {
  return {
    eventId: input.eventId,
    type: "ControlValidationFailed",
    schemaVersion: 1,
    aggregateType: "atomic_control",
    aggregateId: input.controlId,
    payload: {
      controlId: input.controlId,
      controlRevision: input.controlRevision,
      failureCodes: [...input.failureCodes],
      traceabilityDigest: input.traceabilityDigest,
    } satisfies ControlValidationFailedPayload,
  };
}
