import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Role-based permission mapping per SECURITY_ARCHITECTURE.md §3.2
 */
const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  admin: new Set(['consent:read', 'consent:write', 'rights:read', 'rights:write', 'audit:read']),
  operator: new Set(['consent:read', 'consent:write', 'rights:read', 'rights:write']),
  dpo: new Set(['consent:read', 'rights:read', 'audit:read']),
  viewer: new Set(['consent:read', 'rights:read']),
  security: new Set(['audit:read', 'consent:read']),
};

/**
 * Authorize: Middleware factory for permission-based access control
 *
 * Per AGENTS.md §7: Authorization defaults to DENY.
 * Access must be explicitly granted based on authenticated role.
 */
export function authorize(...requiredPermissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Must have passed auth middleware
    if (!request.tenant_id || !request.roles) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Check if user has any of the required permissions
    const userPermissions = new Set<string>();
    for (const role of request.roles) {
      const perms = ROLE_PERMISSIONS[role] || new Set();
      perms.forEach((p) => userPermissions.add(p));
    }

    const hasPermission = requiredPermissions.some((perm) => userPermissions.has(perm));

    if (!hasPermission) {
      // Per API_ARCHITECTURE.md: Return 403 without revealing specifics
      return reply.code(403).send({ error: 'Forbidden' });
    }
  };
}

/**
 * Decorate Fastify with authorize method
 */
export async function setupAuthorization(fastify: FastifyInstance) {
  fastify.decorate('authorize', authorize);
}

declare global {
  namespace Fastify {
    interface FastifyInstance {
      authorize: (...permissions: string[]) => any;
    }
  }
}
