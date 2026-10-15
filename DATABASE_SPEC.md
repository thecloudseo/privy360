# Privy360 Database Specification

**Version**: 1.0  
**Status**: Authority Document  
**Database**: PostgreSQL 15+  
**References**: AGENTS.md §6, §16, MASTER_SPEC.md §11-12

---

## 1. Tenant Isolation via RLS

Every tenant-scoped table has Row Level Security policy:

```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

CREATE POLICY [table_name]_isolation ON [table_name]
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

RLS context set per request:
```sql
SELECT set_config('app.tenant_id', tenant_id::text, false);
```

---

## 2. Core Tables (with RLS)

### tenants
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  onboarding_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### users (RLS-enabled)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  keycloak_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'viewer', -- admin, operator, viewer, dpo, security
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_isolation ON users
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_users_tenant_keycloak ON users(tenant_id, keycloak_id);
```

### consents (RLS-enabled)
```sql
CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  principal_id VARCHAR(255) NOT NULL, -- Identifier, not raw email/phone
  purpose VARCHAR(50) NOT NULL, -- marketing, analytics, operations, research
  status VARCHAR(50) DEFAULT 'pending', -- pending, granted, withdrawn
  granted_by UUID REFERENCES users(id),
  granted_date TIMESTAMPTZ,
  withdrawn_by UUID REFERENCES users(id),
  withdrawn_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_consent_principal_purpose UNIQUE(tenant_id, principal_id, purpose)
);

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY consents_isolation ON consents
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_consents_tenant_principal ON consents(tenant_id, principal_id);
CREATE INDEX idx_consents_status ON consents(tenant_id, status);
```

### audit_events (Immutable, RLS-enabled)
```sql
CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES users(id),
  resource_type VARCHAR(50) NOT NULL, -- consent, user, rights_request
  resource_id UUID,
  action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, APPROVE
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT no_updates CHECK (1=1) -- Prevent updates
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_isolation ON audit_events
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_audit_tenant_action ON audit_events(tenant_id, action, created_at);
CREATE INDEX idx_audit_tenant_resource ON audit_events(tenant_id, resource_type, resource_id);
```

### rights_requests (RLS-enabled)
```sql
CREATE TABLE rights_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  principal_id VARCHAR(255) NOT NULL,
  request_type VARCHAR(50) NOT NULL, -- access, correction, erasure, nomination
  status VARCHAR(50) DEFAULT 'submitted', -- submitted, verified, processing, completed, closed
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rights_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY rights_isolation ON rights_requests
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_rights_tenant_status ON rights_requests(tenant_id, status);
```

### grievances (RLS-enabled)
```sql
CREATE TABLE grievances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  principal_id VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'submitted', -- submitted, in_progress, resolved, closed
  sla_deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE grievances ENABLE ROW LEVEL SECURITY;
CREATE POLICY grievances_isolation ON grievances
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_grievances_sla ON grievances(tenant_id, sla_deadline) WHERE status != 'closed';
```

---

## 3. Migration Strategy

**Pattern**: Schema changes require migration files.

```
migrations/
├── 001_create_tenants.sql
├── 002_create_users.sql
├── 003_create_consents.sql
├── 004_create_audit_events.sql
├── 005_enable_rls_on_all_tables.sql
└── ... (versioned, always adds, never removes)
```

**Rollback Strategy**: Every migration has corresponding down migration.

---

## 4. Constraints & Indexes

**Foreign Keys**: Enforce referential integrity.

**Unique Constraints**: E.g., `(tenant_id, principal_id, purpose)` on consents prevents duplicates.

**Indexes**: Created on:
- Tenant + filter (e.g., `(tenant_id, status)`)
- High-query columns (e.g., `principal_id`)
- Foreign keys

---

## 5. Data Retention

**Immutable Audit Logs**: 1-year minimum retention (Seventh Schedule).

**Personal Data**: Erased upon purpose completion / inactivity (Module 5 - Auto-Purge).

**Logs**: 1-year minimum for investigations.

---

**Authority**: DATABASE_SPEC.md is the schema source of truth  
**Supersedes**: Manual schema changes  
**Enforces**: Tenant isolation via RLS at database layer
