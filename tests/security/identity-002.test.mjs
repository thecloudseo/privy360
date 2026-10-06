import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AuthBoundaryError,
  createOpaqueSession,
  selectTenantMembership,
  assertSelectedMembershipCurrent,
} from "../../packages/auth/src/index.ts";

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const user = "33333333-3333-4333-8333-333333333333";
const membershipA = "44444444-4444-4444-8444-444444444444";
const membershipB = "55555555-5555-4555-8555-555555555555";
const actorA = "66666666-6666-4666-8666-666666666666";
const issuer = "https://idp.synthetic.example/realms/privy360";

function session() {
  return createOpaqueSession({ userId: user, issuer, subject: "staff-1" })
    .record;
}

function record(overrides = {}) {
  return {
    membershipId: membershipA,
    userId: user,
    tenantId: tenantA,
    issuer,
    subject: "staff-1",
    membershipState: "ACTIVE",
    tenantState: "ACTIVE",
    membershipSecurityEpoch: 1,
    tenantSecurityEpoch: 1,
    actorId: actorA,
    ...overrides,
  };
}

function store(records = [record()]) {
  return {
    async findForSession(_session, id) {
      return records.find((item) => item.membershipId === id);
    },
  };
}

test("selection derives trusted tenant context from verified membership state", async () => {
  const context = await selectTenantMembership(session(), membershipA, store());
  assert.equal(context.tenantId, tenantA);
  assert.equal(context.membershipId, membershipA);
  assert.equal(context.actorId, actorA);
  assert.equal(context.source, "SESSION");
});

test("selection denies absent, malformed, cross-tenant, suspended, revoked, and stale memberships", async () => {
  const cases = [
    ["missing", store([])],
    ["malformed", store()],
    [
      "cross tenant identity",
      store([
        record({
          tenantId: tenantB,
          userId: "77777777-7777-4777-8777-777777777777",
        }),
      ]),
    ],
    ["suspended membership", store([record({ membershipState: "SUSPENDED" })])],
    ["revoked membership", store([record({ membershipState: "REVOKED" })])],
    ["suspended tenant", store([record({ tenantState: "SUSPENDED" })])],
    ["stale membership epoch", store([record({ membershipSecurityEpoch: 2 })])],
  ];
  for (const [label, membershipStore] of cases) {
    await assert.rejects(
      () =>
        selectTenantMembership(
          session(),
          label === "malformed" ? "not-a-uuid" : membershipA,
          membershipStore,
        ),
      AuthBoundaryError,
      label,
    );
  }
});

test("caller tenant input and identity claims cannot influence selection", async () => {
  await assert.rejects(
    () =>
      selectTenantMembership(
        { ...session(), tenantId: tenantB, claims: { tenant_id: tenantB } },
        membershipA,
        store(),
      ),
    /tenant|membership|session/i,
  );
  const selected = await selectTenantMembership(
    { ...session(), claims: { tenant_id: tenantA } },
    membershipB,
    store([record({ membershipId: membershipB, tenantId: tenantB })]),
  );
  assert.equal(selected.tenantId, tenantB);
});

test("selection is deterministic and current-state checks deny a suspended membership", async () => {
  const events = [];
  const selected = await selectTenantMembership(
    session(),
    membershipA,
    store(),
    { append: (event) => events.push(event) },
  );
  assert.equal(
    (await selectTenantMembership(session(), membershipA, store())).tenantId,
    selected.tenantId,
  );
  assert.equal(events[0].type, "SessionSelected");
  await assert.rejects(
    () =>
      assertSelectedMembershipCurrent(
        session(),
        selected,
        store([record({ membershipState: "SUSPENDED" })]),
        { append: (event) => events.push(event) },
      ),
    AuthBoundaryError,
  );
  assert.equal(events.at(-1).type, "TenantAccessDenied");
  assert.doesNotMatch(JSON.stringify(events), /token|secret|claim|staff-1/i);
});

test("membership migration enforces composite ownership, RLS, lifecycle, and scoped rollback", async () => {
  const up = await readFile(
    resolve("packages/database/migrations/0010_identity_memberships.up.sql"),
    "utf8",
  );
  const down = await readFile(
    resolve("packages/database/migrations/0010_identity_memberships.down.sql"),
    "utf8",
  );
  assert.match(
    up,
    /foreign key \(tenant_id, user_id\) references tenant\.users/i,
  );
  assert.match(up, /force row level security/i);
  assert.match(up, /state text not null.*ACTIVE.*SUSPENDED.*REVOKED/is);
  assert.match(up, /security_epoch/i);
  assert.doesNotMatch(
    up,
    /password|access_token|refresh_token|tenant_id.*request/i,
  );
  assert.match(down, /drop table if exists tenant\.user_memberships/i);
  assert.doesNotMatch(down, /tenant\.users|platform\.tenants|sessions/i);
});
