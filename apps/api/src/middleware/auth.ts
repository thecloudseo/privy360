import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://keycloak.privy360.in/realms/privy360';

export async function setupAuth(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: JWT_SECRET,
  });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
}

export async function authMiddleware(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for public endpoints
    if (request.url === '/health') {
      return;
    }

    try {
      await request.jwtVerify();

      // Extract tenant_id from JWT claims (server-side source of truth per SECURITY_ARCHITECTURE.md)
      const decoded = request.user as Record<string, unknown>;
      const tenant_id = decoded.tenant_id as string | undefined;

      if (!tenant_id) {
        return reply.code(401).send({ error: 'Missing tenant_id in JWT claims' });
      }

      // Set tenant context on request for use in handlers
      request.tenant_id = tenant_id;
      request.user_id = decoded.sub as string;
      request.keycloak_id = decoded.preferred_username as string;
      request.email = decoded.email as string;

      // Extract roles from realm_access.roles
      const realmAccess = decoded.realm_access as Record<string, unknown> | undefined;
      request.roles = (realmAccess?.roles as string[]) || [];
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}
