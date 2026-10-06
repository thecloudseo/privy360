import assert from "node:assert/strict";
import { test } from "node:test";

import {
  InMemoryAtomicAuditUnitOfWork,
  createAuditContext,
  validateDomainEvent,
} from "../../packages/audit/src/index.ts";

const tenant = "018f2f34-4f5e-7abc-8def-1234567890ab";
const actor = "018f2f34-4f5e-7abc-8def-1234567890ac";
const correlation = "018f2f34-4f5e-7abc-8def-1234567890ad";
const resource = "018f2f34-4f5e-7abc-8def-1234567890ae";

function context() {
  return createAuditContext({
    tenantId: tenant,
    actor: { id: actor, kind: "USER" },
    correlationId: correlation,
    sourceChannel: "api",
  });
}

test("requires trusted tenant and correlation attribution", () => {
  assert.throws(
    () =>
      createAuditContext({ correlationId: correlation, sourceChannel: "api" }),
    /tenant/i,
  );
  assert.throws(
    () => createAuditContext({ tenantId: tenant, sourceChannel: "api" }),
    /correlation/i,
  );
  assert.doesNotThrow(() =>
    createAuditContext({
      scope: "GLOBAL_CORPUS",
      correlationId: correlation,
      sourceChannel: "platform",
    }),
  );
});

test("rejects secrets and unnecessary sensitive payload values", () => {
  assert.throws(
    () =>
      validateDomainEvent({
        eventId: resource,
        type: "TenantProvisioned",
        schemaVersion: 1,
        tenantId: tenant,
        aggregateType: "tenant",
        aggregateId: resource,
        aggregateVersion: "1",
        sequence: "1",
        occurredAt: new Date().toISOString(),
        recordedAt: new Date().toISOString(),
        actor: { id: actor, kind: "USER" },
        correlationId: correlation,
        policyVersion: resource,
        payload: { password: "synthetic-secret" },
      }),
    /prohibited|secret/i,
  );
});

test("atomic audit and outbox effects roll back with the business mutation", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  await assert.rejects(
    uow.run(context(), async (tx) => {
      tx.recordAudit({
        action: "TENANT_CREATED",
        resourceType: "tenant",
        resourceId: tenant,
        result: "SUCCESS",
      });
      tx.enqueue({
        eventId: resource,
        type: "TenantProvisioned",
        schemaVersion: 1,
        aggregateType: "tenant",
        aggregateId: tenant,
        payload: { tenantRef: tenant },
      });
      tx.claimIdempotency({
        actorId: actor,
        route: "POST /tenants",
        key: "k1",
        requestHash: "h1",
      });
      await tx.mutate(() => {
        throw new Error("synthetic audit failure");
      });
    }),
    /synthetic audit failure/,
  );
  assert.equal(uow.auditCount, 0);
  assert.equal(uow.outboxCount, 0);
  assert.equal(uow.idempotencyCount, 0);
});

test("idempotency rejects a different request under the same actor route key", async () => {
  const uow = new InMemoryAtomicAuditUnitOfWork();
  await uow.run(context(), async (tx) => {
    tx.claimIdempotency({
      actorId: actor,
      route: "POST /tenants",
      key: "k1",
      requestHash: "h1",
    });
  });
  await assert.rejects(
    uow.run(context(), async (tx) => {
      tx.claimIdempotency({
        actorId: actor,
        route: "POST /tenants",
        key: "k1",
        requestHash: "h2",
      });
    }),
    /idempotency/i,
  );
});
