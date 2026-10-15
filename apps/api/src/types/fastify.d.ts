/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-namespace, no-undef */
import { FastifyRequest, FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    tenant_id?: string;
    user_id?: string;
    keycloak_id?: string;
    email?: string;
    roles?: string[];
    tenant_id_for_rls?: string;
  }

  interface FastifyInstance {
    db?: {
      query: (text: string, values?: unknown[]) => Promise<any>;
      end: () => Promise<void>;
    };
    authorize?: (...permissions: string[]) => any;
  }
}
