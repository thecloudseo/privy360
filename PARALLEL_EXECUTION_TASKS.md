# Privy360 — Parallel Execution Task Breakdown

**Timeline**: 2 weeks (10 working days)  
**Teams**: API Backend, Web Frontend, Security & Infrastructure  
**Authority**: IMPLEMENTATION_ROADMAP.md, AGENTS.md §22 (Contract-First Parallel Development)

---

## 📋 Executive Task Summary

Three parallel tracks with synchronized checkpoints:

| Track | Owner | Week 1 | Week 2 | Deliverable |
|-------|-------|--------|--------|-------------|
| **API Backend** | 1–2 engineers | Dev server, DB schema, endpoint | Tests, security, docs | POST `/consent` endpoint |
| **Web Frontend** | 1–2 engineers | Dev server, design system, layout | Consent UI, E2E tests | Consent management interface |
| **Security & Infra** | 1 engineer | RLS policies, migration pipeline, secrets | Security scans, CI gates, compliance mapping | Secure foundation |

**Synchronization Points** (all teams must complete):
- ✅ **EOD Day 2**: Dev servers running (API, Web, Worker)
- ✅ **EOD Day 3**: DB schema + RLS policies + API endpoint contract frozen
- ✅ **EOD Day 4**: All tests green (unit, integration, auth, tenant, security)
- ✅ **EOD Day 5**: Documentation complete, security gates pass, ready for PR

---

## 🎯 Track 1: API Backend

### T1.1 — API Dev Server Scaffold
**Owner**: Backend Lead  
**Duration**: 1 day  
**Depends on**: Nothing  
**Blocks**: T1.3, T2.1 (web needs API running for E2E)  
**Effort**: 4 hours

**Objective**: Node.js HTTP server with hot reload, database connectivity, TypeScript strict mode.

**Files to create**:
- [ ] `apps/api/src/index.ts` — Server entrypoint
- [ ] `apps/api/src/middleware/logger.ts` — Request logging
- [ ] `apps/api/src/middleware/error.ts` — Error handler
- [ ] `apps/api/package.json` — Add `dev` + `build` + `start` scripts
- [ ] `apps/api/tsconfig.json` — Strict mode
- [ ] `apps/api/.env.local.example` — Environment template
- [ ] `apps/api/README.md` — Setup instructions

**Implementation**:
```bash
# Setup
cd apps/api
pnpm add express typescript tsx
pnpm install

# Dev server
pnpm dev  # Runs on port 3000 with hot reload
pnpm build  # Compiles TypeScript
```

**Success Criteria**:
- [ ] `pnpm -F @privy360/api dev` starts without errors
- [ ] Server logs "API server running on port 3000"
- [ ] `GET /health` returns `{ "status": "ok" }` (no DB required yet)
- [ ] Hot reload works (edit file, server restarts)
- [ ] TypeScript compiles in strict mode
- [ ] No console errors on startup

**Tests**:
- [ ] Unit test: Health endpoint responds 200

**PR Checklist**:
- [ ] README instructions work from scratch (`pnpm install` → `pnpm dev`)
- [ ] No hardcoded credentials
- [ ] Error handler returns non-sensitive errors to client

---

### T1.2 — Database Schema & Migrations Pipeline
**Owner**: Backend + DBA  
**Duration**: 1.5 days  
**Depends on**: T1.1 (need API running for `.env`)  
**Blocks**: T1.3, T3.1 (RLS tests)  
**Effort**: 6 hours

**Objective**: PostgreSQL schema with migrations, RLS policies, seed data for local dev.

**Files to create**:
- [ ] `apps/api/src/db/connection.ts` — Connection pool (pg library)
- [ ] `apps/api/src/db/migrations/` — Migration runner
- [ ] `migrations/001_init_tenants.sql`
- [ ] `migrations/002_init_users.sql`
- [ ] `migrations/003_init_consents.sql`
- [ ] `migrations/004_init_audit.sql`
- [ ] `migrations/005_enable_rls.sql`
- [ ] `apps/api/package.json` — Add `migrate` script
- [ ] `seeds/dev-tenants.sql` — Test data

**Migration Schema**:
```sql
-- 001_init_tenants.sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 002_init_users.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keycloak_id VARCHAR NOT NULL UNIQUE,
  email VARCHAR NOT NULL,
  role VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- 003_init_consents.sql
CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data_principal_id VARCHAR NOT NULL,
  purpose VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id),
  UNIQUE(tenant_id, data_principal_id, purpose)
);

-- 004_init_audit.sql
CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  resource_type VARCHAR NOT NULL,
  resource_id VARCHAR NOT NULL,
  action VARCHAR NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_tenant_created ON audit_events(tenant_id, created_at DESC);

-- 005_enable_rls.sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_tenant ON users
  USING (tenant_id = (current_setting('app.tenant_id')::uuid));
CREATE POLICY consents_tenant ON consents
  USING (tenant_id = (current_setting('app.tenant_id')::uuid));
CREATE POLICY audit_tenant ON audit_events
  USING (tenant_id = (current_setting('app.tenant_id')::uuid));
```

**Success Criteria**:
- [ ] `pnpm -F @privy360/api migrate up` applies all migrations
- [ ] `pnpm -F @privy360/api migrate down` rolls back (test both directions)
- [ ] All tables exist with correct columns and types
- [ ] RLS enabled and policies applied
- [ ] Seed data loads: `psql ... -f seeds/dev-tenants.sql`
- [ ] `git diff` shows migrations only (no test scripts)

**Tests**:
- [ ] Unit: Migration runner can load and execute SQL
- [ ] Integration: Tables created, RLS policies active
- [ ] Rollback test: Down migration succeeds

**PR Checklist**:
- [ ] Migrations are idempotent (can run multiple times safely)
- [ ] No data loss in rollback scenarios
- [ ] Seed data uses realistic test values
- [ ] README updated with migration instructions

---

### T1.3 — Tenant Context & Database Connection
**Owner**: Backend  
**Duration**: 1 day  
**Depends on**: T1.1, T1.2  
**Blocks**: T1.4  
**Effort**: 4 hours

**Objective**: Middleware to resolve tenant from JWT, set RLS context, establish DB connection.

**Files to create**:
- [ ] `apps/api/src/middleware/tenant.ts` — Tenant context resolver
- [ ] `apps/api/src/db/client.ts` — DB client with RLS context
- [ ] `apps/api/src/types/express.d.ts` — Type-safe req.tenant

**Implementation** (pseudocode):
```typescript
// middleware/tenant.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function tenantContext(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY);
    req.tenant = { id: decoded.tenant_id, userId: decoded.sub };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// db/client.ts
export async function withTenantContext(tenantId: string, callback) {
  const client = await pool.connect();
  try {
    await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
    return await callback(client);
  } finally {
    client.release();
  }
}
```

**Success Criteria**:
- [ ] JWT decoded and validated on every request
- [ ] Tenant ID extracted from JWT claims (not request body)
- [ ] RLS context set before DB queries: `set_config('app.tenant_id', ...)`
- [ ] Request has `req.tenant` object (typed)
- [ ] TypeScript strict mode compiles

**Tests**:
- [ ] Unit: JWT validation (valid, expired, invalid signature)
- [ ] Unit: Tenant ID extracted correctly
- [ ] Integration: RLS context set and enforced

**PR Checklist**:
- [ ] No trust of `tenant_id` from request/query params
- [ ] JWT validation uses environment public key
- [ ] Error responses don't leak token details

---

### T1.4 — POST `/consent` Endpoint Implementation
**Owner**: Backend  
**Duration**: 1.5 days  
**Depends on**: T1.3, T3.2 (authorization rules must be frozen)  
**Blocks**: T4.1 (endpoint tests), T2.2 (web UI)  
**Effort**: 6 hours

**Objective**: Production-grade POST `/api/v1/consents` with validation, auth, audit, error handling.

**Files to create**:
- [ ] `apps/api/src/routes/consents.ts` — Route handler
- [ ] `apps/api/src/services/ConsentService.ts` — Business logic
- [ ] `apps/api/src/services/AuditService.ts` — Audit logging
- [ ] `apps/api/src/validators/consent.ts` — Input validation
- [ ] `apps/api/src/middleware/authz.ts` — Permission check

**Route Definition**:
```typescript
// routes/consents.ts
router.post('/api/v1/consents', tenantContext, authorize('consent:write'), async (req, res) => {
  const { dataPrincipalId, purpose, grantConsent } = req.body;

  // Validate
  const validation = validateConsent({ dataPrincipalId, purpose, grantConsent });
  if (!validation.valid) return res.status(400).json({ errors: validation.errors });

  try {
    // Check duplicate
    const existing = await ConsentService.findByPrincipalAndPurpose(
      req.tenant.id,
      dataPrincipalId,
      purpose
    );
    if (existing) return res.status(409).json({ error: 'Consent already exists for this purpose' });

    // Create consent
    const consent = await ConsentService.create(req.tenant.id, {
      dataPrincipalId,
      purpose,
      status: grantConsent ? 'granted' : 'pending',
      grantedAt: grantConsent ? new Date() : null,
      createdBy: req.tenant.userId,
    });

    // Audit
    await AuditService.log({
      tenantId: req.tenant.id,
      actorId: req.tenant.userId,
      resourceType: 'consent',
      resourceId: consent.id,
      action: 'create',
      changes: { status: null, statusNew: consent.status },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(consent);
  } catch (err) {
    console.error('Consent creation failed:', err.message); // Log server-side only
    res.status(500).json({ error: 'Internal server error' }); // No stack trace to client
  }
});
```

**Success Criteria**:
- [ ] POST request accepted with valid JSON
- [ ] Input validation: dataPrincipalId (required, string), purpose (enum), grantConsent (boolean)
- [ ] Returns 201 with created consent object
- [ ] Returns 400 for invalid input
- [ ] Returns 409 for duplicate consent
- [ ] Audit event logged to database
- [ ] Error responses don't leak stack traces
- [ ] Request authenticated (JWT validated)
- [ ] Request authorized (`consent:write` permission)

**Tests**:
- [ ] Happy path: Create consent, verify in DB
- [ ] Validation: Reject invalid purpose, missing fields
- [ ] Duplicate: Reject second consent for same principal+purpose
- [ ] Audit: Verify audit event created with correct details
- [ ] Error: 500 error logs server-side, returns generic message

**PR Checklist**:
- [ ] No SQL injection (parameterized queries only)
- [ ] No PII in logs (except audit trail)
- [ ] Audit event immutable (INSERT only, no UPDATE)
- [ ] Cross-tenant access fails (RLS enforced)

---

### T1.5 — GET `/consent` List Endpoint (Stretch)
**Owner**: Backend (optional, depends on bandwidth)  
**Duration**: 1 day  
**Depends on**: T1.4  
**Blocks**: Nothing (T2.2 can work with mocked data)  
**Effort**: 4 hours

**Objective**: Paginated list of consents for current tenant.

**Route**: `GET /api/v1/consents?limit=20&offset=0`

**Success Criteria**:
- [ ] Returns paginated list of consents (RLS enforced)
- [ ] Filters by tenant automatically
- [ ] Pagination: limit, offset, total_count

---

## 🎨 Track 2: Web Frontend

### T2.1 — Web Dev Server Scaffold
**Owner**: Frontend Lead  
**Duration**: 0.5 days  
**Depends on**: Nothing (can run without API initially)  
**Blocks**: T2.2  
**Effort**: 2 hours

**Objective**: React + Vite dev server, component library foundation.

**Files to create**:
- [ ] `apps/web/vite.config.ts` — Vite configuration
- [ ] `apps/web/src/main.tsx` — React entrypoint
- [ ] `apps/web/src/App.tsx` — Root component
- [ ] `apps/web/index.html` — HTML shell
- [ ] `apps/web/package.json` — Add `dev` script
- [ ] `apps/web/tsconfig.json` — Strict mode
- [ ] `apps/web/.env.local.example` — API URL template

**Development**:
```bash
cd apps/web
pnpm add react react-dom vite @vitejs/plugin-react
pnpm dev  # Runs on port 5173
```

**Success Criteria**:
- [ ] `pnpm -F @privy360/web dev` starts on port 5173
- [ ] React app renders (title, basic layout)
- [ ] Hot module reload (HMR) works
- [ ] TypeScript strict mode compiles
- [ ] No browser console errors

**Tests**:
- [ ] Smoke test: App renders without crashing

**PR Checklist**:
- [ ] README with setup instructions
- [ ] Environment template for API URL
- [ ] Dark mode CSS variables ready (not implemented yet)

---

### T2.2 — Design System & Component Library
**Owner**: Frontend + Design  
**Duration**: 1.5 days  
**Depends on**: T2.1  
**Blocks**: T2.3  
**Effort**: 6 hours

**Objective**: Reusable component library (Button, Form, Card, Modal) with design tokens.

**Files to create**:
- [ ] `apps/web/src/components/Button.tsx`
- [ ] `apps/web/src/components/Form.tsx`
- [ ] `apps/web/src/components/Card.tsx`
- [ ] `apps/web/src/components/Modal.tsx`
- [ ] `apps/web/src/styles/tokens.css` — Design tokens (colors, typography, spacing)
- [ ] `apps/web/src/components/index.ts` — Export all
- [ ] `apps/web/src/stories/` — Storybook setup (optional but recommended)

**Design Tokens** (CSS variables):
```css
/* tokens.css */
:root {
  /* Colors */
  --color-primary: #0066cc;
  --color-secondary: #666666;
  --color-success: #00aa44;
  --color-danger: #dd0000;
  --color-warning: #ff8800;
  
  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #3399ff;
    --color-secondary: #cccccc;
  }
}
```

**Component Examples**:
```typescript
// Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  onClick,
  children,
}: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} btn--${size}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

**Success Criteria**:
- [ ] 5+ core components created (Button, Form, Card, Modal, Select)
- [ ] Design tokens defined (colors, typography, spacing)
- [ ] All components render without errors
- [ ] TypeScript strict mode compiles
- [ ] Dark mode CSS variables ready (no theme toggle yet)
- [ ] Stories/examples for each component

**Tests**:
- [ ] Snapshot tests for all components
- [ ] Accessibility tests (color contrast, ARIA labels)

**PR Checklist**:
- [ ] Component props are typed
- [ ] CSS follows BEM naming (e.g., `btn btn--primary btn--lg`)
- [ ] No hardcoded colors (use CSS variables)
- [ ] Storybook stories for documentation

---

### T2.3 — Consent Management UI
**Owner**: Frontend  
**Duration**: 1.5 days  
**Depends on**: T2.2, T1.4 (endpoint exists)  
**Blocks**: T4.2 (E2E tests)  
**Effort**: 6 hours

**Objective**: Form to create/list consents, consume POST `/consent` API.

**Files to create**:
- [ ] `apps/web/src/pages/ConsentPage.tsx`
- [ ] `apps/web/src/forms/CreateConsentForm.tsx`
- [ ] `apps/web/src/hooks/useConsents.ts` — API client
- [ ] `apps/web/src/api/client.ts` — Fetch wrapper
- [ ] `apps/web/src/App.tsx` — Route to consent page

**Implementation** (pseudocode):
```typescript
// pages/ConsentPage.tsx
export function ConsentPage() {
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConsents();
  }, []);

  async function fetchConsents() {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/consents', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      setConsents(data);
    } catch (err) {
      setError('Failed to load consents');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateConsent(form) {
    try {
      const response = await fetch('/api/v1/consents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      if (response.status === 201) {
        await fetchConsents(); // Refresh list
      } else {
        setError(await response.text());
      }
    } catch (err) {
      setError('Failed to create consent');
    }
  }

  return (
    <div>
      <h1>Consent Management</h1>
      <CreateConsentForm onSubmit={handleCreateConsent} />
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {consents.map(c => (
          <li key={c.id}>{c.dataPrincipalId} — {c.purpose}: {c.status}</li>
        ))}
      </ul>
    </div>
  );
}
```

**Success Criteria**:
- [ ] Form renders with inputs: data principal ID, purpose (dropdown), grant/deny
- [ ] Form validation: required fields, purpose enum
- [ ] Submit creates consent via API
- [ ] List displays consents from API
- [ ] Error messages displayed to user
- [ ] Loading state during API calls
- [ ] TypeScript strict mode compiles

**Tests**:
- [ ] Form submission sends correct payload
- [ ] API errors handled gracefully
- [ ] List refreshes after creation

**PR Checklist**:
- [ ] API calls use JWT from localStorage/sessionStorage
- [ ] Sensitive data (tokens) not logged
- [ ] Form validation matches backend (purpose enum)

---

## 🔒 Track 3: Security & Infrastructure

### T3.1 — Authorization Rules & Middleware
**Owner**: Security Lead + Backend  
**Duration**: 1 day  
**Depends on**: T1.1, T1.3  
**Blocks**: T1.4, T4.1 (auth tests)  
**Effort**: 4 hours

**Objective**: RBAC middleware, permission enforcement, tenant isolation guarantees.

**Files to create**:
- [ ] `apps/api/src/middleware/authz.ts` — Authorization enforcement
- [ ] `apps/api/src/types/permissions.ts` — Permission definitions
- [ ] `apps/api/src/db/queries/permissions.sql` — User role → permissions mapping

**Authorization Rules** (frozen contract):
```typescript
// types/permissions.ts
type Permission = 
  | 'consent:read'
  | 'consent:write'
  | 'user:read'
  | 'user:write'
  | 'audit:read'
  | 'admin:*';

type Role = 'admin' | 'operator' | 'viewer';

const rolePermissions: Record<Role, Permission[]> = {
  admin: ['consent:read', 'consent:write', 'user:read', 'user:write', 'audit:read', 'admin:*'],
  operator: ['consent:read', 'consent:write', 'audit:read'],
  viewer: ['consent:read', 'audit:read'],
};

// middleware/authz.ts
export function authorize(...requiredPermissions: Permission[]) {
  return async (req, res, next) => {
    const userPermissions = rolePermissions[req.user.role] || [];
    const hasPermission = requiredPermissions.every(p => userPermissions.includes(p));
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' }); // No 404 to avoid enumeration
    }
    next();
  };
}
```

**Success Criteria**:
- [ ] Permission definitions frozen and documented
- [ ] Middleware enforces permissions on every protected route
- [ ] Cross-tenant access returns 403 (or 404 to avoid enumeration)
- [ ] Admin role has all permissions
- [ ] Operator role can read/write consents
- [ ] Viewer role can read only
- [ ] Permissions verified in tests

**Tests**:
- [ ] Unit: Role → permissions mapping
- [ ] Integration: POST `/consent` with admin → 201, with viewer → 403
- [ ] Cross-tenant: Tenant A user cannot access Tenant B data

**PR Checklist**:
- [ ] Permissions centralized (not scattered across routes)
- [ ] No hardcoded role checks in business logic
- [ ] Error responses don't reveal enumeration info

---

### T3.2 — Audit Logging Framework
**Owner**: Security  
**Duration**: 1 day  
**Depends on**: T1.2 (audit table exists), T1.3  
**Blocks**: T1.4 (audit logging required)  
**Effort**: 4 hours

**Objective**: Immutable audit trail with complete context, no PII in logs.

**Files to create**:
- [ ] `apps/api/src/services/AuditService.ts` — Audit logging
- [ ] `apps/api/src/types/audit.ts` — Audit event types
- [ ] `apps/api/src/middleware/auditContext.ts` — Capture request context (IP, user agent)

**Audit Event Schema**:
```typescript
interface AuditEvent {
  tenantId: string;
  actorId: string;
  resourceType: string; // 'consent', 'user', 'audit', etc.
  resourceId: string;
  action: string; // 'create', 'update', 'delete', 'approve'
  changes: Record<string, any>; // What changed
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}
```

**Implementation**:
```typescript
// AuditService.ts
export async function log(event: AuditEvent) {
  const sql = `
    INSERT INTO audit_events
    (tenant_id, actor_id, resource_type, resource_id, action, changes, ip_address, user_agent, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
  `;
  
  await db.query(sql, [
    event.tenantId,
    event.actorId,
    event.resourceType,
    event.resourceId,
    event.action,
    JSON.stringify(event.changes),
    event.ipAddress,
    event.userAgent,
  ]);
  
  // Also log to stdout for observability (don't log sensitive fields)
  console.log(`[AUDIT] ${event.tenantId} ${event.actorId} ${event.action} ${event.resourceType}/${event.resourceId}`);
}
```

**Success Criteria**:
- [ ] Audit event logged for every mutation (create, update, delete, approve)
- [ ] Audit events immutable (INSERT only, no UPDATE/DELETE)
- [ ] Audit includes: tenant, actor, resource, action, changes, IP, user agent
- [ ] No PII in stdout logs (except audit_events table for compliance)
- [ ] Audit table has indexes for efficient queries

**Tests**:
- [ ] Unit: Audit event serialization
- [ ] Integration: Audit event created after consent creation
- [ ] Immutability: Audit record cannot be updated/deleted

**PR Checklist**:
- [ ] Audit events always logged (no silent failures)
- [ ] Changes field is a JSON diff (before/after)
- [ ] IP address and user agent captured
- [ ] Console logs don't leak sensitive data

---

### T3.3 — RLS Validation & Tenant Isolation Tests
**Owner**: Security + QA  
**Duration**: 1.5 days  
**Depends on**: T1.2 (RLS policies), T1.3, T1.4  
**Blocks**: T4.1 (can't ship without passing)  
**Effort**: 6 hours

**Objective**: Verify Row-Level Security blocks cross-tenant access at every level.

**Files to create**:
- [ ] `tests/integration/tenants.isolation.test.mjs` — RLS validation
- [ ] `tests/integration/consents.auth.test.mjs` — Authorization tests
- [ ] `tests/fixtures/tenants.seed.sql` — Test data (2 tenants, 3 users)

**Test Cases**:
```javascript
// tests/integration/tenants.isolation.test.mjs
describe('Tenant Isolation via RLS', () => {
  let tenant1, tenant2, user1, user2;

  beforeAll(async () => {
    // Create tenants and users
    tenant1 = await createTenant('tenant-1');
    tenant2 = await createTenant('tenant-2');
    user1 = await createUser(tenant1.id, 'user1@t1.com', 'operator');
    user2 = await createUser(tenant2.id, 'user2@t2.com', 'operator');
  });

  test('User in Tenant 1 cannot read Tenant 2 consents (RLS)', async () => {
    // Create consent in Tenant 2
    const consent = await createConsent(tenant2.id, 'citizen-1', 'marketing');

    // Try to query from Tenant 1 context
    const query = `
      SELECT set_config('app.tenant_id', $1, false);
      SELECT * FROM consents WHERE id = $2;
    `;
    const result = await db.query(query, [tenant1.id, consent.id]);

    expect(result.rows).toHaveLength(0); // RLS blocks it
  });

  test('User cannot bypass RLS via SQL injection', async () => {
    const maliciousId = tenant2.id + "'; --";
    const result = await db.query(
      `SELECT set_config('app.tenant_id', $1, false); SELECT * FROM consents;`,
      [maliciousId]
    );
    expect(result.rows).toHaveLength(0); // Parameterized query prevents bypass
  });

  test('API endpoint respects RLS (E2E)', async () => {
    // Create consent in Tenant 2
    const consent = await createConsent(tenant2.id, 'citizen-1', 'marketing');

    // Call API with Tenant 1 JWT
    const response = await fetch(`/api/v1/consents/${consent.id}`, {
      headers: { Authorization: `Bearer ${jwtForUser1}` },
    });

    expect(response.status).toBe(404); // Not found (not 500 or 200)
  });
});

describe('Authorization Enforcement', () => {
  test('Viewer role cannot create consent', async () => {
    const response = await fetch('/api/v1/consents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwtForViewer}` },
      body: JSON.stringify({ dataPrincipalId: 'citizen-1', purpose: 'marketing', grantConsent: true }),
    });

    expect(response.status).toBe(403);
  });

  test('Operator role can create consent', async () => {
    const response = await fetch('/api/v1/consents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwtForOperator}` },
      body: JSON.stringify({ dataPrincipalId: 'citizen-1', purpose: 'marketing', grantConsent: true }),
    });

    expect(response.status).toBe(201);
  });
});
```

**Success Criteria**:
- [ ] All cross-tenant access tests PASS (user from Tenant A cannot read Tenant B data)
- [ ] Authorization tests PASS (viewer cannot create, operator can)
- [ ] 10+ test cases covering isolation at DB and API layers
- [ ] No data leakage in error messages
- [ ] Audit trail reflects attempted access

**Tests**:
- [ ] RLS blocks direct SQL queries
- [ ] API enforces authorization
- [ ] Audit logs record access attempts

**PR Checklist**:
- [ ] Cannot be shipped without these tests passing
- [ ] Test data cleaned up after each test
- [ ] Tests are deterministic (no flaky timing issues)

---

### T3.4 — Security Scanning & CI Gates
**Owner**: Security + DevOps  
**Duration**: 1 day  
**Depends on**: T1.4, T2.3 (code to scan)  
**Blocks**: Nothing (doesn't prevent shipping, but should be clean)  
**Effort**: 4 hours

**Objective**: SAST, SCA, secret scanning, dependency audit.

**Files to create/modify**:
- [ ] `.github/workflows/ci.yml` — CI pipeline (if not exists)
- [ ] Add scanning steps:
  - Dependency audit: `pnpm audit --audit-level high`
  - ESLint: `pnpm lint`
  - TypeScript: `pnpm typecheck`
  - Secret scan: gitleaks
  - SAST: Semgrep (optional)

**Acceptance Criteria**:
- [ ] `pnpm audit:deps` finds no high-severity issues
- [ ] `pnpm lint` passes (no linting errors)
- [ ] `pnpm typecheck` passes (TypeScript strict)
- [ ] gitleaks finds no secrets
- [ ] All tests pass (`pnpm test`)

**Tests**:
- [ ] CI pipeline runs on every commit
- [ ] Security gates block merge if failed

**PR Checklist**:
- [ ] No new dependencies without review
- [ ] No hardcoded credentials
- [ ] All security gates green

---

## 📅 Timeline & Synchronization

### Week 1

| Day | Mon | Tue | Wed | Thu | Fri |
|-----|-----|-----|-----|-----|-----|
| **API** | T1.1 Dev Server | T1.2 DB Schema | T1.3 Tenant Context | T1.4 Endpoint | T1.5 List (stretch) |
| **Web** | T2.1 Dev Server | T2.2 Design System | T2.2 (continued) | T2.3 Consent UI | T2.3 (continued) |
| **Security** | T3.1 AuthZ Prep | T3.1 AuthZ Rules | T3.2 Audit | T3.2 (continued) | T3.3 RLS Tests |

**Week 1 Checkpoint** (EOD Friday):
- ✅ API dev server running
- ✅ Web dev server running
- ✅ Database schema + RLS policies
- ✅ Authorization rules frozen
- ✅ Audit logging framework
- ✅ RLS validation tests written (ready to run Week 2)

### Week 2

| Day | Mon | Tue | Wed | Thu | Fri |
|-----|-----|-----|-----|-----|-----|
| **API** | T1.5 Stretch | Endpoint tests | E2E tests | Docs | Prep PR |
| **Web** | UI refinement | Consent form | E2E tests | Docs | Prep PR |
| **Security** | T3.3 RLS Tests | T3.4 Security Scanning | CI/CD setup | Final gate | Sign-off |

**Week 2 Checkpoint** (EOD Friday):
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ All authorization tests pass
- ✅ All tenant isolation tests pass (RLS verified)
- ✅ Security gates pass (no high-risk findings)
- ✅ Documentation complete
- ✅ Ready for PR review

---

## 🔄 Dependency Graph

```
T1.1 (API Dev Server)
├── T1.2 (DB Schema)
│   ├── T1.3 (Tenant Context)
│   │   ├── T1.4 (Endpoint)
│   │   │   └── T4.1 (Endpoint Tests)
│   │   ├── T3.1 (AuthZ Rules)
│   │   │   └── T1.4 (Endpoint)
│   │   └── T3.2 (Audit)
│   │       └── T1.4 (Endpoint)
│   └── T3.3 (RLS Tests)
│       ├── T4.1 (Endpoint Tests)
│       └── T4.3 (Tenant Isolation Tests)
├── T3.4 (Security Scanning) [no blocking deps]
│
T2.1 (Web Dev Server)
├── T2.2 (Design System)
│   └── T2.3 (Consent UI)
│       ├── T1.4 (Endpoint must exist)
│       └── T4.2 (E2E Tests)
│
T4.1 (Endpoint Tests)
├── T1.4 (Endpoint)
├── T3.1 (AuthZ Rules)
├── T3.2 (Audit)
└── T3.3 (RLS Tests)
    └── [Ready for PR Week 2]
```

**Critical Path** (longest dependency chain):
T1.1 → T1.2 → T1.3 → T1.4 → T4.1 → [Week 2 tests & docs]

---

## 🎯 Parallel Execution Strategy

### Week 1 Optimization

**Monday–Wednesday**: Three teams work independently
- **API team**: T1.1 (dev server), start T1.2 (DB schema)
- **Web team**: T2.1 (dev server), start T2.2 (design system)
- **Security team**: Prep T3.1 (authz rules), T3.2 (audit service)

**Thursday–Friday**: Integrate & test
- API team: T1.3 (tenant context), T1.4 (endpoint)
- Web team: T2.2 → T2.3 (consent UI)
- Security team: T3.1 → T3.3 (RLS tests)

### Week 2 Optimization

**Monday–Wednesday**: Parallel testing & hardening
- API: Unit tests, integration tests
- Web: UI tests, E2E tests
- Security: Security scanning, CI gates

**Thursday–Friday**: Documentation & PR prep
- All teams: README, OpenAPI, DPDP mapping
- All teams: PR review checklist

---

## 📊 Effort & Capacity

### By Track (estimated hours)

| Track | Owner | Week 1 | Week 2 | Total | FTE |
|-------|-------|--------|--------|-------|-----|
| **API** | Backend | 20 hrs | 16 hrs | 36 hrs | 1 FTE |
| **Web** | Frontend | 14 hrs | 12 hrs | 26 hrs | 0.75 FTE |
| **Security** | Security | 14 hrs | 10 hrs | 24 hrs | 0.75 FTE |
| **Total** | | 48 hrs | 38 hrs | **86 hrs** | **2.5 FTE** |

**Team Size Recommendation**:
- 2 Backend engineers (one API, one DB/security)
- 2 Frontend engineers (or 1.5)
- 1 Security/DevOps engineer (or shared)

---

## ✅ Definition of Done (Per Task)

All tasks must satisfy:
1. **Code**
   - [ ] Feature implemented
   - [ ] TypeScript compiles (strict mode)
   - [ ] All tests pass
   - [ ] Code reviewed (at least 1 peer)

2. **Security**
   - [ ] No hardcoded secrets
   - [ ] No PII in logs
   - [ ] Authorization tested
   - [ ] Audit trail (if applicable)

3. **Documentation**
   - [ ] README/inline comments
   - [ ] Types documented
   - [ ] API documented (OpenAPI/comments)

4. **Testing**
   - [ ] Unit tests ≥ 80% coverage
   - [ ] Integration tests (if applicable)
   - [ ] No flaky tests

---

## 🚨 Risk Mitigation

### High-Risk Tasks (Extra Attention)

1. **T1.3 & T3.1** (Tenant context + Authorization)
   - **Risk**: Cross-tenant data leakage if misconfigured
   - **Mitigation**: Pair review, dedicated RLS tests before shipping
   - **Gatekeeper**: Security lead reviews before merge

2. **T3.3** (RLS validation)
   - **Risk**: Tests might be inadequate; RLS could fail in production
   - **Mitigation**: 10+ test cases, cross-tenant scenario testing
   - **Gatekeeper**: Security lead sign-off required

3. **T1.4 & T4.1** (Endpoint + tests)
   - **Risk**: Authorization bypass via endpoint logic
   - **Mitigation**: Test every permission level, audit logging verified
   - **Gatekeeper**: Code review + security review

### Mitigation Checkpoints

- **EOD Wednesday**: T1.1, T1.2, T2.1 complete and working
- **EOD Friday (Week 1)**: T1.3, T1.4, T3.1, T3.2 merged (peer review required)
- **EOD Wednesday (Week 2)**: All tests green (RLS, authz, audit)
- **EOD Friday (Week 2)**: Security gates pass, documentation complete, PR ready

---

## 📝 Assignment Template

```markdown
# Task: T1.1 — API Dev Server Scaffold

**Assigned to**: @backend-engineer-1  
**Duration**: 1 day  
**Depends on**: Nothing  
**Blocks**: T1.3, T2.1 (web E2E)  

## Deliverables
- [ ] Express/Fastify server running on port 3000
- [ ] Hot reload working
- [ ] `/health` endpoint returns 200
- [ ] TypeScript strict mode compiles
- [ ] README with setup instructions
- [ ] PR created and ready for review

## Success Criteria
- [ ] `pnpm -F @privy360/api dev` starts without errors
- [ ] Server logs "API server running on port 3000"
- [ ] `GET /health` returns `{ "status": "ok" }`
- [ ] Hot reload works (edit file, server restarts)
- [ ] No hardcoded credentials
- [ ] No console errors on startup

## Notes
- Use Express or Fastify (both are acceptable)
- No database connection yet; `/health` doesn't need DB
- Don't worry about authentication/authorization yet (that's T1.3)

## PR Checklist
- [ ] README instructions work from scratch (`pnpm install` → `pnpm dev`)
- [ ] No hardcoded credentials in code or .env
- [ ] Error handler returns non-sensitive errors
```

---

## 🎓 Getting Started

**For each track lead**:

1. **Clone the task list** (this document) into your project management tool (Jira, Linear, GitHub Projects)
2. **Assign each task** to a team member with clear ownership
3. **Set deadlines** based on the timeline above
4. **Enable daily standups** (15 min) to sync across tracks
5. **Review blockers daily** (async in Slack #engineering)

**Daily Sync Template** (5 min per person):
- ✅ What I completed yesterday
- 🔄 What I'm working on today
- 🚨 Blockers or questions

**Checkpoint Meetings**:
- **Wednesday (Week 1)**: Are we on track? Any pivots needed?
- **Friday (Week 1)**: Integration checkpoint. Do merged changes work together?
- **Friday (Week 2)**: Final review. Security gates pass? Ready for merge?

---

## Questions & Escalation

**Blocked on authorization rules?** → Escalate to Security lead (T3.1 is on critical path)  
**Blocked on API contract?** → Freeze the schema in T3.1, don't change mid-implementation  
**Blocked on design tokens?** → Use defaults in T2.2, iterate in Phase 2 (non-blocking)  
**Test coverage questions?** → See AGENTS.md §28 (testing is non-negotiable)

---

This is your implementation roadmap. Good luck! 🚀
