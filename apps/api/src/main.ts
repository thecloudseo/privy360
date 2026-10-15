import Fastify from 'fastify';
import { healthRoutes } from './routes/health.js';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const host = process.env.HOST || '127.0.0.1';

const fastify = Fastify({
  logger: process.env.NODE_ENV === 'test' ? false : true,
});

fastify.register(healthRoutes);

const start = async () => {
  try {
    await fastify.listen({ host, port });
    console.log(`Server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
