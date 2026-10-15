import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateConsentRequestSchema } from '../schemas/consent.js';
import { createConsent } from '../services/consent.js';

export async function consentRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/consents - Create consent
   * Authority: API_ARCHITECTURE.md §1.1
   */
  fastify.post(
    '/api/v1/consents',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify JWT (auth middleware sets request.tenant_id, etc.)
      if (!request.tenant_id || !request.user_id) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Authorization check per SECURITY_ARCHITECTURE.md §3.2
      if (!request.roles?.includes('admin') && !request.roles?.includes('operator')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Validate request body per API_ARCHITECTURE.md §1.1
      let validatedRequest;
      try {
        validatedRequest = CreateConsentRequestSchema.parse(request.body);
      } catch (err: any) {
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: err.errors,
        });
      }

      try {
        // Create consent record
        const consent = await createConsent({
          tenantId: request.tenant_id,
          actorId: request.user_id,
          request: validatedRequest,
          ipAddress: request.ip || '',
          userAgent: request.headers['user-agent'] || '',
        });

        // Per API_ARCHITECTURE.md: Return 201 Created
        reply.code(201).send(consent);
      } catch (err: any) {
        // Handle duplicate consent error (unique constraint)
        if (err.code === 'DUPLICATE_CONSENT') {
          return reply.code(409).send({
            error: 'Consent already exists',
            code: 'DUPLICATE_CONSENT',
          });
        }

        // Other errors
        console.error('Error creating consent:', err);
        return reply.code(500).send({
          error: 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /api/v1/consents - List consents
   * Authority: API_ARCHITECTURE.md §1.2
   */
  fastify.get(
    '/api/v1/consents',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify JWT
      if (!request.tenant_id) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Authorization check
      if (!request.roles?.includes('admin') && !request.roles?.includes('operator') && !request.roles?.includes('viewer')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      try {
        // Note: Actual implementation would query the database with RLS
        // For now, return empty list (T1.5 tests will verify full implementation)
        reply.code(200).send({
          items: [],
          total: 0,
          limit: 50,
          offset: 0,
        });
      } catch (err) {
        console.error('Error listing consents:', err);
        return reply.code(500).send({
          error: 'Internal server error',
        });
      }
    }
  );
}
