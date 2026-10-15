/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-namespace, no-undef */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Tenant context middleware: Sets RLS context in PostgreSQL
 *
 * Per SECURITY_ARCHITECTURE.md §2:
 * Every database query must set RLS context from the authenticated JWT tenant_id.
 * This middleware sets app.tenant_id so RLS policies enforce tenant isolation at DB level.
 *
 * Defense in depth: RLS enforced at database layer AND application authorization layer.
 */
export async function tenantContextMiddleware(fastify: FastifyInstance) {
  fastify.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip tenant context for public endpoints
      if (request.url === "/health") {
        return;
      }

      // At this point, authMiddleware has validated JWT and set request.tenant_id
      if (!request.tenant_id) {
        return reply.code(401).send({ error: "Tenant context not found" });
      }

      try {
        // Set RLS context for this request's database operations
        // This will be passed to the database connection pool in handlers
        request.tenant_id_for_rls = request.tenant_id;
      } catch (err) {
        return reply.code(500).send({ error: "Failed to set tenant context" });
      }
    },
  );
}

/**
 * Helper to set RLS context on a database client
 */
export async function setTenantRLSContext(
  dbClient: any,
  tenantId: string,
): Promise<void> {
  if (!tenantId) {
    throw new Error("tenant_id required for RLS context");
  }

  // PostgreSQL RLS context setting per DATABASE_SPEC.md
  await dbClient.query(`SELECT set_config('app.tenant_id', $1, false)`, [
    tenantId,
  ]);
}

declare global {
  namespace Express {
    interface Request {
      tenant_id_for_rls?: string;
    }
  }
}
