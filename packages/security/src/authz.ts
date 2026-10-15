// Authorization middleware and enforcement
// Authority: SECURITY_ARCHITECTURE.md §3, RBAC_ABAC.md, AGENTS.md §7-8

import { TrustedTenantContext, assertTrustedTenantContext } from "./tenant-context.ts";
import {
  Permission,
  RoleType,
  RoleContext,
  createRoleContext,
  isValidPermission,
} from "./permissions.ts";

export class AuthorizationError extends Error {
  readonly code = "AUTHORIZATION_DENIED";

  constructor() {
    // AGENTS.md §17: Never disclose reason (no enumeration, no "role required", etc.)
    super("Forbidden");
    this.name = "AuthorizationError";
  }
}

export interface AuthenticatedActor {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: RoleType;
  readonly context: TrustedTenantContext;
  readonly roleContext: RoleContext;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason?: string; // Internal only, never exposed to client
  readonly policyDecisionId: string;
}

/**
 * Resolve authenticated actor from trusted tenant context and role.
 * Tenant context MUST be verified server-side before calling this.
 */
export function resolveAuthenticatedActor(
  context: TrustedTenantContext,
  role: RoleType,
): AuthenticatedActor {
  assertTrustedTenantContext(context);
  return {
    userId: context.actorId,
    tenantId: context.tenantId,
    role,
    context,
    roleContext: createRoleContext(role),
  };
}

/**
 * Authorize a permission check with detailed decision logging.
 * AGENTS.md §7: Default-deny. Access only if all conditions met:
 * - User authenticated ✓ (passed by resolveAuthenticatedActor)
 * - User has required permission
 * - Resource tenant = user tenant (enforced by caller)
 * - No explicit deny
 */
export function authorize(
  actor: AuthenticatedActor,
  permission: Permission,
  resourceTenantId?: string,
): AuthorizationDecision {
  // Validate permission string
  if (!isValidPermission(permission)) {
    return {
      allowed: false,
      reason: `Invalid permission: ${permission}`,
      policyDecisionId: actor.context.correlationId,
    };
  }

  // Check tenant isolation: if resource has a tenant, it must match
  if (resourceTenantId && resourceTenantId !== actor.tenantId) {
    return {
      allowed: false,
      reason: "Tenant isolation violation",
      policyDecisionId: actor.context.correlationId,
    };
  }

  // Check permission (default-deny)
  const hasPermission = actor.roleContext.permissions.has(permission);
  if (!hasPermission) {
    return {
      allowed: false,
      reason: `Role ${actor.role} does not have permission ${permission}`,
      policyDecisionId: actor.context.correlationId,
    };
  }

  return {
    allowed: true,
    policyDecisionId: actor.context.correlationId,
  };
}

/**
 * Assert authorization; throw if not allowed.
 * AGENTS.md §17: Error responses never include sensitive details.
 */
export function assertAuthorized(
  decision: AuthorizationDecision,
): void {
  if (!decision.allowed) {
    throw new AuthorizationError();
  }
}

/**
 * Batch authorization check for multiple resources.
 * Used in list/export operations to filter results.
 * AGENTS.md §6: Authorization before pagination.
 */
export function authorizeResourceAccess(
  actor: AuthenticatedActor,
  permission: Permission,
  resources: readonly { tenantId: string; id: string }[],
): readonly { id: string; allowed: boolean }[] {
  return resources.map((resource) => ({
    id: resource.id,
    allowed: authorize(actor, permission, resource.tenantId).allowed,
  }));
}

/**
 * Build field allowlist for response filtering.
 * RBAC_ABAC.md: "Field-level allowlists govern read projection"
 * Returns set of field names the actor can read.
 */
export function getReadableFields(
  actor: AuthenticatedActor,
  resourceType: string,
): ReadonlySet<string> {
  // Define field allowlists per role × resource
  // These prevent mass-assignment and unauthorized field access
  const fieldLists: Record<RoleType, Record<string, ReadonlySet<string>>> = {
    "platform-super-admin": {
      tenants: new Set([
        "id",
        "name",
        "email",
        "status",
        "createdAt",
        "updatedAt",
      ]),
    },
    "tenant-admin": {
      users: new Set(["id", "email", "role", "createdAt", "status"]),
      tenants: new Set(["id", "name", "email", "status", "updatedAt"]),
      consents: new Set([
        "id",
        "principalId",
        "purpose",
        "status",
        "grantedDate",
      ]),
    },
    dpo: {
      consents: new Set([
        "id",
        "principalId",
        "purpose",
        "status",
        "grantedDate",
        "withdrawnDate",
      ]),
      rights_requests: new Set([
        "id",
        "principalId",
        "requestType",
        "status",
        "createdAt",
      ]),
      grievances: new Set(["id", "principalId", "subject", "status", "sla"]),
    },
    "privacy-officer": {
      consents: new Set([
        "id",
        "principalId",
        "purpose",
        "status",
        "grantedDate",
      ]),
      rights_requests: new Set([
        "id",
        "principalId",
        "requestType",
        "status",
      ]),
      grievances: new Set(["id", "principalId", "subject", "status"]),
    },
    ciso: {
      controls: new Set([
        "id",
        "name",
        "status",
        "lastTestedDate",
        "evidence",
      ]),
      incidents: new Set(["id", "status", "severity", "createdAt"]),
    },
    "compliance-manager": {
      controls: new Set([
        "id",
        "name",
        "status",
        "evidence",
        "remediation",
      ]),
      evidence: new Set(["id", "resourceType", "createdAt", "metadata"]),
    },
    "legal-reviewer": {
      notices: new Set(["id", "title", "content", "status", "approvedDate"]),
      dpias: new Set(["id", "status", "approvedDate"]),
    },
    "security-analyst": {
      controls: new Set(["id", "name", "status", "lastTestedDate"]),
      incidents: new Set(["id", "status", "severity"]),
    },
    "data-steward": {
      inventory: new Set(["id", "name", "category", "dataElements"]),
    },
    "business-owner": {
      inventory: new Set(["id", "name", "systems"]),
      controls: new Set(["id", "name", "status"]),
    },
    "processor-vendor-manager": {
      processors: new Set(["id", "name", "type", "status"]),
      connectors: new Set(["id", "type", "status"]),
    },
    "incident-manager": {
      incidents: new Set([
        "id",
        "status",
        "severity",
        "description",
        "affectedCount",
      ]),
    },
    auditor: {
      audit_events: new Set([
        "id",
        "action",
        "resourceType",
        "actor",
        "createdAt",
        "result",
      ]),
    },
    "executive-read-only": {
      controls: new Set(["id", "status", "count"]),
      incidents: new Set(["id", "severity", "status", "count"]),
    },
    "data-principal": {
      consents: new Set(["purpose", "status", "grantedDate"]),
      rights_requests: new Set(["requestType", "status", "createdAt"]),
      grievances: new Set(["subject", "status", "createdAt"]),
    },
    "service-account": {},
  };

  const allowlist = fieldLists[actor.role]?.[resourceType];
  return allowlist ?? new Set(); // Default-deny: empty set = no fields readable
}

/**
 * Filter resource fields to only those the actor can read.
 * AGENTS.md §7: "Field-level allowlists govern read projection"
 */
export function filterReadableFields<T extends Record<string, unknown>>(
  actor: AuthenticatedActor,
  resource: T,
  resourceType: string,
): Partial<T> {
  const allowlist = getReadableFields(actor, resourceType);
  if (allowlist.size === 0) return {}; // No readable fields

  const filtered: Partial<T> = {};
  for (const [key, value] of Object.entries(resource)) {
    if (allowlist.has(key)) {
      filtered[key as keyof T] = value as T[keyof T];
    }
  }
  return filtered;
}

/**
 * Secure error response that never discloses authorization reason.
 * AGENTS.md §17: "Return non-sensitive errors"
 */
export function secureAuthzErrorResponse(): {
  error: string;
  code: string;
  timestamp: string;
} {
  return {
    error: "Forbidden",
    code: "FORBIDDEN",
    timestamp: new Date().toISOString(),
  };
}
