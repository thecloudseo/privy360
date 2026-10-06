# packages/database

TENANT-001 owns the first reviewed SQL migration under `migrations/`.

The migration establishes the platform tenant registry and tenant-owned
organisation hierarchy with composite tenant keys and RLS-ready policies.
TENANT-002 owns transaction-local trusted tenant context and runtime RLS
fixtures; AUDIT-001 owns durable audit/outbox tables and atomic mutation ports.
No application role may own the tenant tables or bypass RLS, and this package
does not expose a business endpoint.
