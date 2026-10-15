# Privy360 Security Architecture

**Version**: 1.0  
**Status**: Authority Document  
**References**: AGENTS.md §5-8, §15, MASTER_SPEC.md §6, §13-14  
**Last Updated**: 2026-10-15

---

## 1. Authentication Architecture

### 1.1 OpenID Connect (Keycloak)

Privy360 uses Keycloak as the primary authentication provider.

**Provider**: Keycloak  
**Protocol**: OpenID Connect (OIDC)  
**Client Library**: `openid-client` (no deprecated keycloak-connect)

### 1.2 JWT Claims (Server-Side Source of Truth)

**CRITICAL**: Tenant ID is extracted from JWT claims. NEVER from request body.

```json
{
  "iss": "https://keycloak.privy360.in/realms/privy360",
  "sub": "user-uuid",
  "tenant_id": "tenant-uuid",
  "email": "user@example.com",
  "realm_access": { "roles": ["admin"] }
}
```

---

## 2. Tenant Context Resolution

**Rule**: Tenant context determined from authenticated JWT claims only.

Every database query sets RLS context:
```sql
SELECT set_config('app.tenant_id', tenant_id, false);
```

Cross-tenant access → 0 rows (RLS enforced at database layer).

---

## 3. Authorization Architecture

### 3.1 Default-Deny Model

Access DENIED by default. Granted only if:
- User authenticated
- User has required permission  
- Resource belongs to user's tenant

### 3.2 Role-Based Access Control (RBAC)

Roles: `admin`, `operator`, `viewer`, `dpo`, `security`

All endpoints enforce permissions via middleware:
```
authorize('consent:write') → user must have this permission
```

---

## 4. Audit Logging

**Table**: `audit_events` (immutable, BIGSERIAL, INSERT-only)

Every mutation emits audit event with:
- tenant_id (from JWT)
- actor_id
- resource_type, action
- changes (JSONB)
- ip_address, user_agent
- timestamp

RLS policy isolates audit events by tenant.

---

## 5. Mandatory Security Rules

- ✅ JWT validated on every request
- ✅ Tenant from JWT, never from request
- ✅ RLS enforced on all tenant tables
- ✅ Authorization checked before business logic
- ✅ Parameterized queries (no SQL injection)
- ✅ No secrets in source code
- ✅ No PII in logs (except audit trail)
- ✅ Immutable audit trail
- ✅ Safe error messages (no enumeration)

---

**Status**: Authority for authentication, authorization, tenant isolation  
**Next**: DATABASE_SPEC.md, API_ARCHITECTURE.md
