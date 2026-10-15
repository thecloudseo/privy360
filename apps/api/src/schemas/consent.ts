import { z } from 'zod';

export const CreateConsentRequestSchema = z.object({
  dataPrincipalId: z.string().min(1, 'dataPrincipalId is required'),
  purpose: z.enum(['marketing', 'analytics', 'operations', 'research']),
  grantConsent: z.boolean(),
});

export type CreateConsentRequest = z.infer<typeof CreateConsentRequestSchema>;

export const ConsentResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  principalId: z.string(),
  purpose: z.string(),
  status: z.string(),
  grantedDate: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
});

export type ConsentResponse = z.infer<typeof ConsentResponseSchema>;
