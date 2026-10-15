import Fastify from 'fastify';
import { setupAuth, authMiddleware } from './middleware/auth.js';
import { tenantContextMiddleware } from './middleware/tenant.js';
import { setupAuthorization } from './middleware/authorize.js';
import { healthRoutes } from './routes/health.js';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const host = process.env.HOST || '127.0.0.1';

const fastify = Fastify({
  logger: process.env.NODE_ENV === 'test' ? false : true,
});

async function start() {
  try {
    // Setup security middleware
    await setupAuth(fastify);
    await setupAuthorization(fastify);
    await authMiddleware(fastify);
    await tenantContextMiddleware(fastify);

    // Register routes
    await fastify.register(healthRoutes);

    await fastify.listen({ host, port });
    console.log(`Server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
