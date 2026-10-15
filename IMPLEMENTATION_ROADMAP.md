# Privy360 — 2-Week Implementation Roadmap

**Status**: FOUNDATION-003 → T1 (API foundation + dev servers)  
**Prepared**: 2026-10-15  
**Authority**: AGENTS.md §35 (Required Implementation Plan), ARCHITECTURE.md, API_ARCHITECTURE.md, SECURITY_ARCHITECTURE.md

---

## Executive Summary

**Objective**: Scaffold dev servers and implement the first production-grade API endpoint (POST `/consent`) with full compliance stack. This unblocks parallel T2+ development and proves the authentication, authorization, tenant isolation, audit, and validation architecture.

**Outcome**: By end of Week 2:
- ✅ API dev server running (Express/Fastify with TypeScript)
- ✅ Web dev server running (React + Vite, component library started)
- ✅ POST `/consent` endpoint production-ready (auth, validation, audit, tests, docs)
- ✅ Database migrations pipeline working
- ✅ Tenant isolation verified via tests
- ✅ DPDP control mapping validated

**Authority Hierarchy**: AGENTS.md > ADRs (ADR-004 through ADR-008, ADR-017) > SECURITY_ARCHITECTURE.md > API_ARCHITECTURE.md > DATABASE_SPEC.md

---

## Phase 1: Dev Server Scaffolding (Days 1–2)

### 1.1 API Dev Server (Express/Fastify + TypeScript)

**Objective**: Node.js HTTP server running at `localhost:3000` with hot reload.

**Files to create/modify**:
- `apps/api/src/index.ts` — Server entrypoint
- `apps/api/src/types/index.ts` — Shared TypeScript types
- `apps/api/package.json` — Add `dev` script
- `apps/api/.env.local.example` — Local dev config template
- `apps/api/tsconfig.json` — Ensure strict mode

**Database connection**:
- Connection string: `postgres://app_user:$APP_DB_PASSWORD@localhost:5432/privy360`
- Credentials: From `pnpm services:config` (auto-generated, stored in `infra/docker/.local/credentials.json`)
- Use: `@privy360/api-common` package (shared connection pool, type-safe queries)

**Dev Script** (package.json):
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "typescript": "5.9.3"
  },
  "devDependencies": {
    "tsx": "^4.0.0"
  }
}
```

**Acceptance Criteria**:
- [ ] `pnpm -F @privy360/api dev` starts server on port 3000
- [ ] Health check: `GET /health` returns `{ status: "ok" }`
- [ ] Server restarts on file changes (hot reload)
- [ ] TypeScript strict mode compiles without errors
- [ ] Logs database connection status on startup

**Security Constraints** (from AGENTS.md §5, §17):
- ❌ No hardcoded credentials in code
- ❌ No secrets in logs
- ✅ Validate all input (even from "trusted" sources)
- ✅ Server-side authentication/authorization required
- ✅ Audit every mutation

---

### 1.2 Web Dev Server (React + Vite)

**Objective**: React dev server at `localhost:5173` with component library foundation.

**Files to create/modify**:
- `apps/web/src/main.tsx` — React entrypoint
- `apps/web/vite.config.ts` — Vite configuration
- `apps/web/src/components/` — Component library (Button, Form, Card, etc.)
- `apps/web/package.json` — Add `dev` script

**Dev Script** (package.json):
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

**Acceptance Criteria**:
- [ ] `pnpm -F @privy360/web dev` starts dev server on port 5173
- [ ] React app renders (empty page with title)
- [ ] Hot module reload (HMR) works
- [ ] Component library foundation: Button, Form, Card (Tailwind or CSS-in-JS)
- [ ] TypeScript strict mode compiles

**Design System Scope** (Phase 1 — Foundation):
- [ ] Color palette (semantic: primary, secondary, danger, success)
- [ ] Typography system (heading sizes, body, mono)
- [ ] Spacing scale (4px/8px/16px based)
- [ ] Component library started (5 core components)
- [ ] Dark mode CSS variables ready (no implementation yet)

---

### 1.3 Worker Dev Script (Background Jobs)

**Objective**: TypeScript worker runner for async tasks (email, webhooks, deletions).

**Files to create/modify**:
- `apps/worker/src/index.ts` — Worker entrypoint
- `apps/worker/package.json` — Add `dev` script
- `apps/worker/src/jobs/` — Job definitions

**Implementation approach**: Poll Temporal workflow queue or use a simpler job queue (Bull/Bee-Queue for local dev).

**Dev Script** (package.json):
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts"
  }
}
```

**Acceptance Criteria**:
- [ ] `pnpm -F @privy360/worker dev` starts worker
- [ ] Worker logs connection to job queue
- [ ] Can enqueue and process a test job locally

---

## Phase 2: Database Schema & Migrations (Days 2–3)

### 2.1 Core Tables (Tenant-Aware)

**Authority**: DATABASE_SPEC.md, ADR-004 (Postgres + RLS)

**Tables to create**:
1. `tenants` — Multi-tenancy anchor
   ```sql
   CREATE TABLE tenants (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name VARCHAR NOT NULL UNIQUE,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );
   ```

2. `users` — Identity foundation (Keycloak-managed, linked here)
   ```sql
   CREATE TABLE users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     keycloak_id VARCHAR NOT NULL UNIQUE,
     email VARCHAR NOT NULL,
     role VARCHAR NOT NULL, -- 'admin', 'operator', 'viewer'
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now(),
     UNIQUE(tenant_id, email)
   );
   ```

3. `consents` — DPDP consent records (tenant-isolated)
   ```sql
   CREATE TABLE consents (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     data_principal_id VARCHAR NOT NULL, -- Reference to citizen/customer
     purpose VARCHAR NOT NULL, -- 'marketing', 'analytics', 'operations', etc.
     status VARCHAR NOT NULL DEFAULT 'pending', -- 'pending', 'granted', 'withdrawn'
     granted_at TIMESTAMPTZ,
     withdrawn_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now(),
     created_by UUID REFERENCES users(id),
     UNIQUE(tenant_id, data_principal_id, purpose)
   );
   ```

4. `audit_events` — Immutable audit trail (tenant-scoped)
   ```sql
   CREATE TABLE audit_events (
     id BIGSERIAL PRIMARY KEY,
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     actor_id UUID REFERENCES users(id),
     resource_type VARCHAR NOT NULL, -- 'consent', 'user', 'control', etc.
     resource_id VARCHAR NOT NULL,
     action VARCHAR NOT NULL, -- 'create', 'update', 'delete', 'approve'
     changes JSONB, -- delta of what changed
     ip_address INET,
     user_agent TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     indexed_at TIMESTAMPTZ
   );
   CREATE INDEX audit_events_tenant_created ON audit_events(tenant_id, created_at DESC);
   CREATE INDEX audit_events_resource ON audit_events(tenant_id, resource_type, resource_id);
   ```

### 2.2 Row-Level Security (RLS)

**Authority**: ADR-004 (PostgreSQL RLS for tenant isolation)

**RLS Policies** (applied to all tenant-aware tables):

```sql
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Tenant context: set via app before queries
-- Example: SELECT set_config('app.tenant_id', tenant_id::text, false);

-- users table: users can only see users in their tenant
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = (current_setting('app.tenant_id')::uuid));

-- consents table: isolation
CREATE POLICY consents_tenant_isolation ON consents
  USING (tenant_id = (current_setting('app.tenant_id')::uuid));

-- audit_events table: isolation
CREATE POLICY audit_events_tenant_isolation ON audit_events
  USING (tenant_id = (current_setting('app.tenant_id')::uuid));
```

**Migration files**:
- `migrations/001_init_tenants.sql` — Create tenants table
- `migrations/002_init_users.sql` — Create users table
- `migrations/003_init_consents.sql` — Create consents table
- `migrations/004_init_audit.sql` — Create audit_events table
- `migrations/005_enable_rls.sql` — Apply RLS policies

**Acceptance Criteria**:
- [ ] All migrations run without error: `pnpm -F @privy360/api migrate up`
- [ ] Tables exist with correct columns and types
- [ ] RLS enabled on all tenant-aware tables
- [ ] Rollback works: `pnpm -F @privy360/api migrate down`
- [ ] Test: RLS blocks cross-tenant reads (see Phase 3 tests)

---

## Phase 3: First API Endpoint — POST `/consent` (Days 3–4)

### 3.1 Endpoint Specification

**Authority**: API_ARCHITECTURE.md, SECURITY_ARCHITECTURE.md §7 (Authorization)

**Route**: `POST /api/v1/consents`

**Request**:
```json
{
  "dataPrincipalId": "citizen-12345",
  "purpose": "marketing",
  "grantConsent": true
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "dataPrincipalId": "citizen-12345",
  "purpose": "marketing",
  "status": "granted",
  "grantedAt": "2026-10-15T10:30:00Z",
  "createdAt": "2026-10-15T10:30:00Z",
  "createdBy": "user-uuid"
}
```

**Error responses**:
- 400: Invalid input (missing field, invalid purpose)
- 401: Unauthorized (no auth token)
- 403: Forbidden (user lacks permission)
- 409: Conflict (consent already exists for this purpose)
- 500: Server error (no stack trace to client)

### 3.2 Implementation Stack

**Authentication** (AGENTS.md §17, SECURITY_ARCHITECTURE.md §2):
- Keycloak JWT in Authorization header: `Bearer <token>`
- Validate JWT signature, expiry, scopes
- Extract tenant from `tenant_id` claim (trusted server-side only)
- ❌ Never trust `tenant_id` from request body

**Authorization** (AGENTS.md §7, SECURITY_ARCHITECTURE.md §7):
- Default: DENY
- User must have `consent:write` permission in their role
- Tenant context verified server-side
- Cross-tenant access fails securely (404, not 403 to avoid enumeration)

**Validation**:
- `dataPrincipalId`: non-empty string, max 255 chars
- `purpose`: enum (marketing, analytics, operations, research)
- `grantConsent`: boolean

**Audit Event** (AGENTS.md §15):
```json
{
  "resourceType": "consent",
  "resourceId": "uuid",
  "action": "create",
  "changes": { "status": null, "statusNew": "granted" },
  "actor": "user-uuid",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

**Files to create/modify**:
- `apps/api/src/routes/consents.ts` — Route handler
- `apps/api/src/middleware/auth.ts` — JWT validation
- `apps/api/src/middleware/authz.ts` — Permission enforcement
- `apps/api/src/services/ConsentService.ts` — Business logic
- `apps/api/src/services/AuditService.ts` — Audit logging
- `apps/api/src/types/index.ts` — Add types

**Acceptance Criteria**:
- [ ] Endpoint accepts and validates request
- [ ] JWT authentication enforces valid token
- [ ] Authorization denies users without `consent:write`
- [ ] Audit event logged for every consent creation
- [ ] Tenant isolation enforced (RLS test passes)
- [ ] Error responses don't leak stack traces
- [ ] OpenAPI schema generated for the endpoint

---

## Phase 4: Testing & Verification (Days 4–5)

### 4.1 Unit Tests

**Authority**: AGENTS.md §28 (Testing Rules)

**Tests to write**:
1. **ConsentService.ts**:
   - ✅ Create consent with valid input
   - ✅ Reject duplicate purpose for same principal
   - ✅ Withdraw consent (update status)
   - ❌ Invalid purpose (enum)
   - ❌ Missing required fields

2. **AuditService.ts**:
   - ✅ Audit event created for consent actions
   - ✅ Audit event includes actor, IP, user agent
   - ❌ Audit event not created if service fails (transaction rollback)

**Test file**:
- `tests/unit/ConsentsService.test.mjs` — Unit tests (Node.js test runner)

**Acceptance Criteria**:
- [ ] `pnpm test` passes all unit tests
- [ ] Code coverage ≥ 80% for consent logic
- [ ] No failing tests in CI

### 4.2 Authorization Tests

**Authority**: AGENTS.md §28, SECURITY_ARCHITECTURE.md §7 (Authorization Testing)

**Tests**:
1. ✅ Admin user can create consent
2. ❌ Viewer user cannot create consent (403)
3. ❌ User from tenant B cannot create consent in tenant A (cross-tenant isolation)
4. ❌ No auth token → 401 Unauthorized
5. ❌ Expired JWT → 401 Unauthorized

**Test file**:
- `tests/integration/consents.auth.test.mjs` — Auth/authz tests

**Acceptance Criteria**:
- [ ] All authorization tests pass
- [ ] Cross-tenant access verified to fail securely
- [ ] No data leakage in error messages

### 4.3 Tenant Isolation Tests

**Authority**: AGENTS.md §6 (Tenant Isolation), §28 (Tenant-isolation tests are mandatory)

**Tests**:
1. Tenant A user queries consents → sees only Tenant A data
2. Tenant B user queries consents → sees only Tenant B data (RLS enforced)
3. Bulk operations respect tenant boundaries

**Test file**:
- `tests/integration/tenants.isolation.test.mjs`

**Acceptance Criteria**:
- [ ] RLS blocks cross-tenant reads
- [ ] Audit events isolated by tenant
- [ ] No cross-tenant data leakage detected

### 4.4 Integration Tests

**Tests**:
1. End-to-end: POST `/api/v1/consents` with valid JWT → consent created
2. Audit event created in database
3. Audit event includes correct tenant, actor, changes

**Test file**:
- `tests/integration/consents.e2e.test.mjs`

**Acceptance Criteria**:
- [ ] `pnpm test` passes all tests
- [ ] `pnpm test:cp1-postgres` verifies RLS
- [ ] No flaky tests

### 4.5 Security Scanning

**Authority**: AGENTS.md §29 (Mandatory Security Verification)

**Checks**:
- ❌ No hardcoded secrets (git-secrets, gitleaks)
- ❌ No SQL injection (input validation, parameterized queries)
- ❌ No XSS (output encoding, CSP headers)
- ❌ No missing auth/authz
- ❌ No PII in logs

**Commands**:
```bash
pnpm audit:deps                    # Dependency vulnerability scan
pnpm lint                          # ESLint
pnpm typecheck                     # TypeScript strict
pnpm test                          # Unit & security tests
pnpm test:cp1-postgres            # RLS validation
```

**Acceptance Criteria**:
- [ ] All security gates pass
- [ ] No high-severity dependencies
- [ ] No secrets committed

---

## Phase 5: Documentation & API Contract (Days 5)

### 5.1 OpenAPI Schema

**File**: `apps/api/src/openapi.json`

**Generates**:
- Interactive API docs at `/api/docs`
- Client SDK generation
- Contract-first validation

**Acceptance Criteria**:
- [ ] OpenAPI 3.0 schema validates
- [ ] All endpoints documented
- [ ] Request/response examples present

### 5.2 README & Setup Guide

**File**: `apps/api/README.md`

**Contents**:
- Dev server startup: `pnpm -F @privy360/api dev`
- Database setup: migration instructions
- Environment variables: `APP_DB_PASSWORD`, etc.
- Testing: `pnpm test`
- API docs: `/api/docs`

**Acceptance Criteria**:
- [ ] New developer can follow README and run the API
- [ ] Commands work from scratch (fresh `pnpm install`)

---

## Architecture Impact & Dependencies

### Database Schema
- ✅ Tenants table (multi-tenancy anchor)
- ✅ Users table (Keycloak linkage)
- ✅ Consents table (first domain entity)
- ✅ Audit events table (immutable trail)
- ✅ RLS policies (tenant isolation)

### API Contracts
- ✅ POST `/api/v1/consents` (consent creation)
- Future: GET `/api/v1/consents` (list), GET `/api/v1/consents/{id}` (fetch), DELETE (withdraw)

### Authorization Rules
- ✅ `consent:write` permission → can create/update consents
- ✅ `consent:read` permission → can view consents
- ✅ Tenant context verified from JWT
- ✅ RLS enforces isolation at database level

### Audit Events
- ✅ `resource_type: consent`, `action: create`
- ✅ Captured: actor, tenant, changes, IP, user agent
- ✅ Immutable (BIGSERIAL, no updates)

### Event Model
- ✅ `ConsentGranted` domain event (future: publish to Temporal)
- ✅ Triggers: email notification, compliance reports

---

## Parallel Work (T1 Unblocks)

**After this phase completes, unblocked work**:
- [ ] Frontend: Consent management UI (reads from API, creates consents)
- [ ] Worker: Background jobs (email notifications, data exports)
- [ ] Rights Requests API: Similar stack to consents
- [ ] Compliance Dashboard: Visualize control status, evidence

---

## Success Criteria & Definition of Done

### Code
- ✅ TypeScript compiles (strict mode)
- ✅ All tests pass (`pnpm test`, `pnpm test:cp1-postgres`, `pnpm test:e2e`)
- ✅ No security findings (SAST, SCA, secret scan)
- ✅ Code coverage ≥ 80% for new code

### Security & Compliance
- ✅ Server-side authentication (Keycloak JWT)
- ✅ Server-side authorization (deterministic, not AI)
- ✅ Tenant isolation enforced (RLS + app layer)
- ✅ Audit events immutable and complete
- ✅ No secrets in source code
- ✅ No PII in logs (except audit trail)

### Documentation
- ✅ API documented (OpenAPI schema)
- ✅ README complete (setup, dev, testing)
- ✅ DPDP control mapped (which regulation → which code)

### Acceptance
- ✅ `pnpm -F @privy360/api dev` runs
- ✅ `pnpm -F @privy360/web dev` runs
- ✅ POST `/api/v1/consents` works end-to-end
- ✅ Cross-tenant access rejected
- ✅ Audit trail recorded and immutable

---

## Risk Assessment

### High Risk
- **Tenant isolation bypass** → Implement RLS correctly, test aggressively
- **Authorization logic centralized?** → Use middleware, shared service
- **Secrets in code** → Pre-commit hooks, scanning

### Medium Risk
- **Dev server hot reload** → Test with multiple file changes
- **Database migration rollback** → Test up/down on local DB

### Low Risk
- **Component library scope** → Defer non-essentials to Phase 2

---

## Rollback Strategy

If issues arise:
1. **DB schema problem** → `migrate down` to previous migration, fix, reapply
2. **API regression** → Revert commit, re-run tests
3. **Tenant isolation failure** → Disable RLS changes, debug in isolation

---

## Schedule & Team

| Phase | Days | Owner | Deliverable |
|-------|------|-------|-------------|
| 1. Dev Servers | 1–2 | Backend | API & web dev servers running |
| 2. DB & RLS | 2–3 | Backend | Schema, migrations, RLS policies |
| 3. First Endpoint | 3–4 | Backend | POST `/consent` production-ready |
| 4. Testing | 4–5 | Backend + QA | All tests green, security gates pass |
| 5. Documentation | 5 | Backend + DevEx | README, OpenAPI, DPDP mapping |

**Parallel tracks** (after Phase 1 completes):
- Frontend: Component library, consent UI
- DevOps: CI/CD pipeline for dev servers
- Security: SAST/SCA setup, compliance reporting

---

## How to Start

**Week 1, Day 1:**

```bash
# 1. Dev servers (Phase 1)
pnpm -F @privy360/api dev &
pnpm -F @privy360/web dev &

# 2. Services (already running)
pnpm services:up

# 3. Migrations (Phase 2)
pnpm -F @privy360/api migrate up

# 4. Tests
pnpm test
pnpm test:cp1-postgres
```

**Expected state by end of Week 2:**
- All phases complete
- `pnpm test` passes (unit + integration + auth/authz/tenant tests)
- POST `/consent` endpoint documented and tested
- Ready for PR review and merge

---

## Authority References

- **AGENTS.md** — Engineering rules (§5, §6, §7, §15, §17, §28, §29, §35)
- **ARCHITECTURE.md** — Modular monolith, module boundaries
- **SECURITY_ARCHITECTURE.md** — Auth/authz/tenant isolation
- **API_ARCHITECTURE.md** — Endpoint design, contracts
- **DATABASE_SPEC.md** — Schema, migrations, RLS
- **ADR-004** — PostgreSQL + RLS decision
- **ADR-005** — Audit architecture
- **ADR-006** — Tenant isolation
- **ADR-007** — Authorization (RBAC)
- **ADR-017** — Regulatory versioning

---

**This plan is ready for review. Do you want to:**
1. Start Phase 1 now? (Dev server scaffolding)
2. Refine the scope before starting?
3. Assign specific tasks to team members?
