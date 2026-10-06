import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAuditDelivery } from "../../packages/audit/src/delivery.ts";

const uuid = "11111111-1111-4111-8111-111111111111";
const event = {
  eventId: uuid,
  scope: "TENANT",
  tenantId: uuid,
  consumer: "inventory",
  correlationId: uuid,
  causationId: uuid,
  payload: { resourceId: uuid },
};

test("inbox dedupe makes a publish/ack crash one consumer effect", async () => {
  const delivery = new InMemoryAuditDelivery({ maxAttempts: 3 });
  delivery.enqueue(event);
  let publishes = 0;
  let effects = 0;
  await assert.rejects(() =>
    delivery.dispatch(uuid, async (item) => {
      publishes++;
      await delivery.consume(item, () => {
        effects++;
      });
      throw new Error("ack crash");
    }),
  );
  await delivery.dispatch(uuid, async (item) => {
    publishes++;
    await delivery.consume(item, () => {
      effects++;
    });
  });
  assert.equal(publishes, 2);
  assert.equal(effects, 1);
  assert.equal(delivery.outboxState(uuid), "DELIVERED");
});

test("transient failures retry and poison events become visible dead letters", async () => {
  const delivery = new InMemoryAuditDelivery({ maxAttempts: 2 });
  delivery.enqueue(event);
  await assert.rejects(() =>
    delivery.dispatch(uuid, async () => {
      throw new Error("temporary");
    }),
  );
  await assert.rejects(() =>
    delivery.dispatch(uuid, async () => {
      throw new Error("poison");
    }),
  );
  assert.equal(delivery.outboxState(uuid), "DEAD_LETTER");
  assert.equal(delivery.deadLetters()[0].reason, "poison");
  assert.equal(delivery.replay(uuid, { scope: "AUDIT_OPERATOR" }), true);
  assert.equal(delivery.outboxState(uuid), "PENDING");
});

test("preserves correlation and causation and rejects tenant/global confusion", () => {
  const delivery = new InMemoryAuditDelivery();
  assert.throws(
    () =>
      delivery.enqueue({ ...event, scope: "GLOBAL_CORPUS", tenantId: uuid }),
    /tenant/i,
  );
  assert.throws(
    () => delivery.enqueue({ ...event, payload: { secret: "never" } }),
    /prohibited/i,
  );
  delivery.enqueue(event);
  assert.deepEqual(delivery.envelope(uuid).slice(0, 4), [
    "TENANT",
    uuid,
    "inventory",
    uuid,
  ]);
});

test("consumer failure rolls back its inbox receipt and effect", async () => {
  const delivery = new InMemoryAuditDelivery();
  delivery.enqueue(event);
  let attempts = 0;
  await assert.rejects(() =>
    delivery.dispatch(uuid, (item) =>
      delivery.consume(item, () => {
        attempts++;
        throw new Error("business rollback");
      }),
    ),
  );
  await delivery.dispatch(uuid, (item) =>
    delivery.consume(item, () => {
      attempts++;
    }),
  );
  assert.equal(attempts, 2);
});
