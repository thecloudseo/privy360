import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSameTenantContext,
  createTrustedTenantContext,
  TenantContextDeniedError,
} from "../../packages/security/src/tenant-context.ts";
import {
  createPlatformCacheKey,
  createPlatformObjectKey,
  createTenantCacheInvalidationPrefix,
  createTenantCacheKey,
  createTenantObjectKey,
  createTenantWorkItemContext,
  resolvePlatformDeploymentRoute,
  resolveTenantDeploymentRoute,
} from "../../packages/security/src/tenant-infrastructure.ts";

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const actor = "33333333-3333-4333-8333-333333333333";
const membership = "44444444-4444-4444-8444-444444444444";
const correlation = "55555555-5555-4555-8555-555555555555";

function context(tenantId) {
  return createTrustedTenantContext({
    tenantId,
    actorId: actor,
    membershipId: membership,
    correlationId: correlation,
    source: "SESSION",
    verified: true,
  });
}

function registry(overrides = {}) {
  return {
    async resolveTenant(tenantId) {
      return {
        scope: "TENANT",
        tenantId,
        deploymentId: "deployment-primary",
        mode: "SHARED_SAAS",
        ...overrides,
      };
    },
    async resolvePlatform() {
      return {
        scope: "PLATFORM",
        deploymentId: "deployment-control",
        mode: "GOVERNMENT_ON_PREM",
        ...overrides,
      };
    },
  };
}

const cacheInput = {
  scopeFingerprint: "scope-a",
  policyEpoch: "epoch-7",
  resourceType: "system",
  resourceId: "resource-9",
  resourceVersion: "v3",
};

test("work-item attribution requires a genuine trusted context", () => {
  const trusted = context(tenantA);
  const item = createTenantWorkItemContext(trusted, {
    workItemId: "work-1",
    policyVersion: "policy-2",
    scopeFingerprint: "scope-a",
  });
  assert.equal(item.tenantId, tenantA);
  assert.equal(item.actorId, actor);
  assert.equal(item.correlationId, correlation);
  assert.equal(Object.isFrozen(item), true);

  assert.throws(
    () => createTenantWorkItemContext(undefined, {}),
    TenantContextDeniedError,
  );
  assert.throws(
    () =>
      createTenantWorkItemContext(
        {
          tenantId: tenantA,
          actorId: actor,
          membershipId: membership,
          correlationId: correlation,
          source: "SESSION",
        },
        { workItemId: "work-1", policyVersion: "p", scopeFingerprint: "s" },
      ),
    TenantContextDeniedError,
  );
});

test("tenant routing uses trusted context and verifies registry ownership", async () => {
  const requested = [];
  const trustedRegistry = registry();
  const route = await resolveTenantDeploymentRoute(context(tenantA), {
    ...trustedRegistry,
    async resolveTenant(tenantId) {
      requested.push(tenantId);
      return trustedRegistry.resolveTenant(tenantId);
    },
  });
  assert.deepEqual(requested, [tenantA]);
  assert.equal(
    route.routingKey,
    `deployments/deployment-primary/tenants/${tenantA}`,
  );

  await assert.rejects(
    () =>
      resolveTenantDeploymentRoute(
        context(tenantA),
        registry({ tenantId: tenantB }),
      ),
    /registry tenant mismatch/i,
  );
  await assert.rejects(
    () => resolveTenantDeploymentRoute(undefined, registry()),
    TenantContextDeniedError,
  );
});

test("routing hides registry failures and preserves semantics across deployment modes", async () => {
  await assert.rejects(
    () =>
      resolveTenantDeploymentRoute(context(tenantA), {
        ...registry(),
        async resolveTenant() {
          throw new Error("postgres://user:secret@internal.example/tenant");
        },
      }),
    (error) =>
      error instanceof TenantContextDeniedError &&
      !error.message.includes("secret") &&
      !error.message.includes("internal.example"),
  );

  for (const deploymentMode of [
    "SHARED_SAAS",
    "DEDICATED_SAAS",
    "CUSTOMER_CLOUD",
    "GOVERNMENT_ON_PREM",
  ]) {
    const route = await resolveTenantDeploymentRoute(
      context(tenantA),
      registry({ mode: deploymentMode }),
    );
    assert.equal(route.mode, deploymentMode);
    assert.equal(
      route.routingKey,
      `deployments/deployment-primary/tenants/${tenantA}`,
    );
  }
});

test("platform routing is explicit and structurally separate", async () => {
  const platform = await resolvePlatformDeploymentRoute(registry());
  assert.equal(platform.routingKey, "deployments/deployment-control/platform");
  await assert.rejects(
    () =>
      resolvePlatformDeploymentRoute(
        registry({ scope: "TENANT", tenantId: tenantA }),
      ),
    /platform registry route/i,
  );
});

test("tenant cache keys are deterministic, scoped, and collision resistant", async () => {
  const routeA = await resolveTenantDeploymentRoute(
    context(tenantA),
    registry(),
  );
  const routeB = await resolveTenantDeploymentRoute(
    context(tenantB),
    registry(),
  );
  const keyA1 = createTenantCacheKey(context(tenantA), routeA, cacheInput);
  const keyA2 = createTenantCacheKey(context(tenantA), routeA, cacheInput);
  const keyB = createTenantCacheKey(context(tenantB), routeB, cacheInput);
  assert.equal(keyA1.value, keyA2.value);
  assert.notEqual(keyA1.value, keyB.value);
  assert.match(keyA1.value, new RegExp(tenantA));
  assert.throws(
    () => createTenantCacheInvalidationPrefix(context(tenantA), keyB),
    /tenant mismatch/i,
  );
  assert.equal(
    createTenantCacheInvalidationPrefix(context(tenantA), keyA1),
    `deployments/deployment-primary/tenants/${tenantA}/cache/`,
  );
});

test("raw cache namespace escape and tenant/platform confusion fail closed", async () => {
  const route = await resolveTenantDeploymentRoute(
    context(tenantA),
    registry(),
  );
  for (const bad of ["../scope", "scope/a", "scope\\a", "%2e%2e", "platform"])
    assert.throws(
      () =>
        createTenantCacheKey(context(tenantA), route, {
          ...cacheInput,
          scopeFingerprint: bad,
        }),
      /invalid|reserved/i,
    );
  const platform = await resolvePlatformDeploymentRoute(registry());
  const platformKey = createPlatformCacheKey(platform, cacheInput);
  assert.match(platformKey.value, /\/platform\/cache\//);
  assert.doesNotMatch(platformKey.value, /\/tenants\//);
});

test("object keys reject traversal, absolute, encoded, mixed and reserved paths", async () => {
  const route = await resolveTenantDeploymentRoute(
    context(tenantA),
    registry(),
  );
  for (const bad of [
    "../report.pdf",
    "/report.pdf",
    "folder//report.pdf",
    "folder\\report.pdf",
    "folder/%2e%2e/report.pdf",
    `tenants/${tenantB}/report.pdf`,
    "platform/report.pdf",
    "C:/report.pdf",
  ])
    assert.throws(
      () => createTenantObjectKey(context(tenantA), route, bad),
      /object path|reserved/i,
    );
});

test("object keys are deterministic and keep platform objects separate", async () => {
  const route = await resolveTenantDeploymentRoute(
    context(tenantA),
    registry(),
  );
  const first = createTenantObjectKey(
    context(tenantA),
    route,
    "reports/report-1/v1.pdf",
  );
  const second = createTenantObjectKey(
    context(tenantA),
    route,
    "reports/report-1/v1.pdf",
  );
  assert.equal(first, second);
  assert.equal(
    first,
    `deployments/deployment-primary/tenants/${tenantA}/objects/reports/report-1/v1.pdf`,
  );
  const platform = await resolvePlatformDeploymentRoute(registry());
  assert.equal(
    createPlatformObjectKey(platform, "regulatory/bundle-1.json"),
    "deployments/deployment-control/platform/objects/regulatory/bundle-1.json",
  );
});

test("TENANT-002 nested-context mismatch remains denied", () => {
  assert.throws(
    () => assertSameTenantContext(context(tenantA), context(tenantB)),
    /nested tenant context mismatch/i,
  );
});
