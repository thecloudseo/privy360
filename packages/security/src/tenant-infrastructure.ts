import {
  assertTrustedTenantContext,
  TenantContextDeniedError,
  type TrustedTenantContext,
} from "./tenant-context.ts";

export type DeploymentMode =
  "SHARED_SAAS" | "DEDICATED_SAAS" | "CUSTOMER_CLOUD" | "GOVERNMENT_ON_PREM";

export type TenantRegistryRoute = Readonly<{
  scope: "TENANT";
  tenantId: string;
  deploymentId: string;
  mode: DeploymentMode;
}>;

export type PlatformRegistryRoute = Readonly<{
  scope: "PLATFORM";
  deploymentId: string;
  mode: DeploymentMode;
}>;

export interface DeploymentRoutingRegistry {
  resolveTenant(tenantId: string): Promise<TenantRegistryRoute | undefined>;
  resolvePlatform(): Promise<PlatformRegistryRoute | undefined>;
}

export type TenantDeploymentRoute = Readonly<{
  scope: "TENANT";
  tenantId: string;
  deploymentId: string;
  mode: DeploymentMode;
  routingKey: string;
}>;

export type PlatformDeploymentRoute = Readonly<{
  scope: "PLATFORM";
  deploymentId: string;
  mode: DeploymentMode;
  routingKey: string;
}>;

export type TenantWorkItemContext = Readonly<{
  workItemId: string;
  tenantId: string;
  actorId: string;
  membershipId: string;
  correlationId: string;
  policyVersion: string;
  scopeFingerprint: string;
}>;

export type CacheKeyInput = Readonly<{
  scopeFingerprint: string;
  policyEpoch: string;
  resourceType: string;
  resourceId: string;
  resourceVersion: string;
}>;

export type TenantCacheKey = Readonly<{
  scope: "TENANT";
  tenantId: string;
  deploymentId: string;
  value: string;
}>;

export type PlatformCacheKey = Readonly<{
  scope: "PLATFORM";
  deploymentId: string;
  value: string;
}>;

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MODES: readonly DeploymentMode[] = [
  "SHARED_SAAS",
  "DEDICATED_SAAS",
  "CUSTOMER_CLOUD",
  "GOVERNMENT_ON_PREM",
];
const RESERVED = new Set([
  "cache",
  "deployments",
  "objects",
  "platform",
  "tenants",
]);
const tenantRoutes = new WeakSet<object>();
const platformRoutes = new WeakSet<object>();
const tenantCacheKeys = new WeakMap<object, string>();

function invalid(message: string): never {
  throw new TenantContextDeniedError(message);
}

function segment(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !SEGMENT.test(value) ||
    value === "." ||
    value === ".." ||
    RESERVED.has(value.toLowerCase())
  ) {
    invalid(`${field} is invalid.`);
  }
  return value;
}

function deploymentSegment(value: unknown): string {
  if (typeof value !== "string" || !SEGMENT.test(value))
    invalid("deployment route is invalid.");
  return value;
}

function mode(value: unknown): DeploymentMode {
  if (!MODES.includes(value as DeploymentMode))
    invalid("deployment mode is invalid.");
  return value as DeploymentMode;
}

function tenantRoute(
  context: TrustedTenantContext,
  route: TenantDeploymentRoute,
): void {
  assertTrustedTenantContext(context);
  if (!tenantRoutes.has(route) || route.tenantId !== context.tenantId)
    invalid("deployment route tenant mismatch.");
}

function platformRoute(route: PlatformDeploymentRoute): void {
  if (!platformRoutes.has(route))
    invalid("platform deployment route is invalid.");
}

function canonicalObjectPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1024 ||
    value.startsWith("/") ||
    value.startsWith("\\") ||
    /^[A-Za-z]:/.test(value) ||
    value.includes("\\") ||
    value.includes("//") ||
    value.includes("%")
  ) {
    invalid("object path is invalid.");
  }
  const parts = value.split("/");
  if (
    parts.some((part) => !SEGMENT.test(part) || part === "." || part === "..")
  )
    invalid("object path is invalid.");
  if (parts.some((part) => RESERVED.has(part.toLowerCase())))
    invalid("object path uses a reserved namespace.");
  return parts.join("/");
}

function cacheSuffix(input: CacheKeyInput): string {
  return [
    segment(input.scopeFingerprint, "scope fingerprint"),
    segment(input.policyEpoch, "policy epoch"),
    segment(input.resourceType, "resource type"),
    segment(input.resourceId, "resource id"),
    segment(input.resourceVersion, "resource version"),
  ].join("/");
}

export function createTenantWorkItemContext(
  context: TrustedTenantContext | undefined,
  input: {
    readonly workItemId: string;
    readonly policyVersion: string;
    readonly scopeFingerprint: string;
  },
): TenantWorkItemContext {
  assertTrustedTenantContext(context);
  return Object.freeze({
    workItemId: segment(input.workItemId, "work item ID"),
    tenantId: context.tenantId,
    actorId: context.actorId,
    membershipId: context.membershipId,
    correlationId: context.correlationId,
    policyVersion: segment(input.policyVersion, "policy version"),
    scopeFingerprint: segment(input.scopeFingerprint, "scope fingerprint"),
  });
}

export async function resolveTenantDeploymentRoute(
  context: TrustedTenantContext | undefined,
  registry: DeploymentRoutingRegistry,
): Promise<TenantDeploymentRoute> {
  assertTrustedTenantContext(context);
  let resolved: TenantRegistryRoute | undefined;
  try {
    resolved = await registry.resolveTenant(context.tenantId);
  } catch {
    invalid("tenant registry route is unavailable.");
  }
  if (!resolved || resolved.scope !== "TENANT")
    invalid("tenant registry route is unavailable.");
  if (resolved.tenantId !== context.tenantId)
    invalid("registry tenant mismatch.");
  const deploymentId = deploymentSegment(resolved.deploymentId);
  const route: TenantDeploymentRoute = {
    scope: "TENANT",
    tenantId: context.tenantId,
    deploymentId,
    mode: mode(resolved.mode),
    routingKey: `deployments/${deploymentId}/tenants/${context.tenantId}`,
  };
  tenantRoutes.add(route);
  return Object.freeze(route);
}

export async function resolvePlatformDeploymentRoute(
  registry: DeploymentRoutingRegistry,
): Promise<PlatformDeploymentRoute> {
  let resolved: PlatformRegistryRoute | undefined;
  try {
    resolved = await registry.resolvePlatform();
  } catch {
    invalid("platform registry route is unavailable.");
  }
  if (!resolved || resolved.scope !== "PLATFORM")
    invalid("platform registry route is unavailable.");
  const deploymentId = deploymentSegment(resolved.deploymentId);
  const route: PlatformDeploymentRoute = {
    scope: "PLATFORM",
    deploymentId,
    mode: mode(resolved.mode),
    routingKey: `deployments/${deploymentId}/platform`,
  };
  platformRoutes.add(route);
  return Object.freeze(route);
}

export function createTenantCacheKey(
  context: TrustedTenantContext,
  route: TenantDeploymentRoute,
  input: CacheKeyInput,
): TenantCacheKey {
  tenantRoute(context, route);
  const namespace = `${route.routingKey}/cache/`;
  const key: TenantCacheKey = Object.freeze({
    scope: "TENANT",
    tenantId: context.tenantId,
    deploymentId: route.deploymentId,
    value: `${namespace}${cacheSuffix(input)}`,
  });
  tenantCacheKeys.set(key, namespace);
  return key;
}

export function createTenantCacheInvalidationPrefix(
  context: TrustedTenantContext,
  key: TenantCacheKey,
): string {
  assertTrustedTenantContext(context);
  const namespace = tenantCacheKeys.get(key);
  if (!namespace || key.tenantId !== context.tenantId)
    invalid("cache key tenant mismatch.");
  return namespace;
}

export function createPlatformCacheKey(
  route: PlatformDeploymentRoute,
  input: CacheKeyInput,
): PlatformCacheKey {
  platformRoute(route);
  return Object.freeze({
    scope: "PLATFORM",
    deploymentId: route.deploymentId,
    value: `${route.routingKey}/cache/${cacheSuffix(input)}`,
  });
}

export function createTenantObjectKey(
  context: TrustedTenantContext,
  route: TenantDeploymentRoute,
  logicalPath: string,
): string {
  tenantRoute(context, route);
  return `${route.routingKey}/objects/${canonicalObjectPath(logicalPath)}`;
}

export function createPlatformObjectKey(
  route: PlatformDeploymentRoute,
  logicalPath: string,
): string {
  platformRoute(route);
  return `${route.routingKey}/objects/${canonicalObjectPath(logicalPath)}`;
}
