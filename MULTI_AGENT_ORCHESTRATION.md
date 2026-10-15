# Privy360 — Multi-Agent Development Orchestration

**Orchestration Strategy**: 3 parallel teams with intelligent model distribution  
**Model Assignment**: Haiku 4.5 (simple/mechanical) ↔ Opus 4.6 (complex/strategic)  
**Context Management**: Token reduction via `/headroom` between handoffs  
**Goal**: Ship Week 2 with zero decision waste, full traceability

---

## 🎯 Orchestration Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIVY360 BUILD ORCHESTRATION                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│  │   API TRACK      │  │   WEB TRACK      │  │ SECURITY    │  │
│  │  (Opus + Haiku)  │  │  (Haiku + Opus)  │  │ (Opus Lead) │  │
│  │                  │  │                  │  │             │  │
│  │ T1.1 Dev Server  │  │ T2.1 Dev Server  │  │ T3.1 AuthZ  │  │
│  │ (Haiku)          │  │ (Haiku)          │  │ (Opus)      │  │
│  │      ↓           │  │      ↓           │  │      ↓      │  │
│  │ T1.2 DB Schema   │  │ T2.2 Design Sys  │  │ T3.2 Audit  │  │
│  │ (Opus)           │  │ (Haiku + Opus)   │  │ (Opus)      │  │
│  │      ↓           │  │      ↓           │  │      ↓      │  │
│  │ T1.3 Tenant Ctx  │  │ T2.3 Consent UI  │  │ T3.3 RLS    │  │
│  │ (Opus)           │  │ (Haiku)          │  │ (Opus)      │  │
│  │      ↓           │  │      ↓           │  │      ↓      │  │
│  │ T1.4 Endpoint    │  │ E2E Tests        │  │ Sec Scan    │  │
│  │ (Opus)           │  │ (Haiku)          │  │ (Haiku)     │  │
│  │      ↓           │  │      ↓           │  │      ↓      │  │
│  │ T1.5 Tests       │  │ Integration      │  │ CI Gates    │  │
│  │ (Haiku)          │  │ (Haiku)          │  │ (Haiku)     │  │
│  └──────────────────┘  └──────────────────┘  └─────────────┘  │
│           ↓                    ↓                     ↓          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         SYNTHESIS: Week 2 PR Ready (Opus Review)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Parallelism**: All 3 teams work simultaneously (Day 1-5, Week 1)  
**Synchronization Points**: EOD Day 2, 3, 4, 5  
**Handoffs**: Token-reduced via `/headroom` before each cross-team dependency  
**Decisions**: Traced in decision log for audit trail

---

## 📋 Team Task Decomposition

### **TEAM 1: API Backend** (Opus Lead + Haiku Support)

#### Agent 1.1 — Dev Server Scaffold (Haiku 4.5)
**Input**: Fastify template, tsconfig, package.json  
**Output**: Working API server on port 3000, hot reload functional  
**Success Criteria**:
- [ ] `pnpm -F @privy360/api dev` starts without errors
- [ ] `/health` endpoint returns 200
- [ ] Hot reload works on file change
- [ ] TypeScript strict mode compiles
- [ ] README with setup instructions

**Complexity**: Simple/mechanical (scaffolding, templating)  
**Duration**: 4 hours  
**Depends on**: Nothing  
**Blocks**: T1.2, T1.3, T1.4

**Haiku Prompt Template**:
```
Scaffold a Fastify server with TypeScript.
- Create apps/api/src/index.ts with server setup
- Add dev script: tsx watch src/index.ts
- Implement /health endpoint (no DB required)
- Enable hot reload
- Target: port 3000, strict TypeScript
- Output: working dev server, README with steps
- Test: pnpm -F @privy360/api dev → "API server running on port 3000"
Success = server runs, hot reload works, no errors on startup
```

---

#### Agent 1.2 — Database Schema & RLS (Opus 4.6)
**Input**: DATABASE_SPEC.md, AGENTS.md (tenant isolation rules)  
**Output**: 5 migration files, RLS policies, seed data  
**Success Criteria**:
- [ ] All migrations apply cleanly: `migrate up`
- [ ] Rollback works: `migrate down`
- [ ] RLS policies enabled on all tenant tables
- [ ] Seed data loads: test tenants, users, consents
- [ ] Schema matches spec exactly

**Complexity**: High (security-critical, architectural decision)  
**Duration**: 6 hours  
**Depends on**: Nothing (parallel to T1.1)  
**Blocks**: T1.3, T3.3 (RLS tests)

**Opus Prompt Template**:
```
Design PostgreSQL schema for Privy360 tenant-isolated system.
Authority: DATABASE_SPEC.md, AGENTS.md §6 (tenant isolation).

Create 5 migrations:
1. tenants table (UUID, name, unique, timestamps)
2. users table (tenant FK, keycloak_id unique, email, role, timestamps)
3. consents table (tenant FK, principal_id, purpose enum, status, timestamps)
4. audit_events table (tenant FK, actor FK, resource_type, action, changes JSONB, IP, user agent)
5. Enable RLS with policies:
   - users: tenant_id = current_setting('app.tenant_id')::uuid
   - consents: tenant_id = current_setting('app.tenant_id')::uuid
   - audit_events: tenant_id = current_setting('app.tenant_id')::uuid

Output: /migrations/001_*.sql through 005_*.sql
Test: migrate up → all tables exist, migrate down → clean rollback
Add seed data: dev-tenants.sql with 2 test tenants, 3 users
Success = RLS blocks cross-tenant reads, indexes created, schema matches spec
```

---

#### Agent 1.3 — Tenant Context & Auth Middleware (Opus 4.6)
**Input**: JWT validation logic, tenant context design, Keycloak config  
**Output**: middleware/tenant.ts, middleware/auth.ts, types/express.d.ts  
**Success Criteria**:
- [ ] JWT validated on every request
- [ ] Tenant ID extracted from claims (not body)
- [ ] RLS context set: `set_config('app.tenant_id', ...)`
- [ ] Request has `req.tenant` object (typed)
- [ ] TypeScript strict compiles

**Complexity**: High (security-critical, architectural foundation)  
**Duration**: 4 hours  
**Depends on**: T1.1, T1.2  
**Blocks**: T1.4, T3.1

**Opus Prompt Template**:
```
Implement tenant context resolution middleware for Privy360.
Authority: SECURITY_ARCHITECTURE.md §2, AGENTS.md §6.

Create 3 files:
1. middleware/auth.ts: JWT validation
   - Extract token from Authorization header
   - Validate signature against Keycloak public key
   - Check expiry, extract claims
   - Reject if invalid: 401 Unauthorized
2. middleware/tenant.ts: Tenant context setter
   - Extract tenant_id from JWT claims (NEVER from request body)
   - Set RLS context: SELECT set_config('app.tenant_id', tenant_id, false)
   - Attach to req.tenant = { id, userId }
   - Reject if no tenant: 403 Forbidden
3. types/express.d.ts: Type safety
   - Extend Express Request with tenant property
   - Type = { id: UUID, userId: UUID }

Integration: Apply auth → tenant middleware to all protected routes.
Test: Valid JWT → tenant context set; Invalid JWT → 401; Missing tenant → 403
Success = RLS context active, request typed, no hardcoded secrets
```

---

#### Agent 1.4 — POST `/consent` Endpoint (Opus 4.6)
**Input**: API_ARCHITECTURE.md, T1.3 middleware, authorization rules (T3.1)  
**Output**: routes/consents.ts, services/ConsentService.ts, AuditService.ts  
**Success Criteria**:
- [ ] POST /api/v1/consents accepts valid request, returns 201
- [ ] Validates input: dataPrincipalId, purpose enum, grantConsent
- [ ] Returns 400 for invalid input
- [ ] Returns 409 for duplicate
- [ ] Audit event logged with changes, actor, IP, user agent
- [ ] No PII in error responses
- [ ] No SQL injection, parameterized queries only

**Complexity**: High (authorization-critical, full-stack)  
**Duration**: 6 hours  
**Depends on**: T1.3, T3.1 (authorization rules must be frozen)  
**Blocks**: T4.1 (endpoint tests), T2.2 (web UI)

**Opus Prompt Template**:
```
Implement POST /api/v1/consents endpoint with authorization, validation, audit.
Authority: API_ARCHITECTURE.md, SECURITY_ARCHITECTURE.md §7, AGENTS.md §15.

Create route handler:
- Authenticate: JWT validated (middleware/auth.ts)
- Authorize: User has consent:write permission (from T3.1 rules)
- Validate input: dataPrincipalId (string, required), purpose (enum: marketing/analytics/operations/research), grantConsent (boolean)
- Check duplicate: UNIQUE(tenant_id, data_principal_id, purpose)
- Insert consent: status = granted|pending based on grantConsent
- Log audit event: resource_type=consent, action=create, changes={status_old:null, status_new:granted}, include IP + user agent
- Return 201 with consent object
- Error responses: 400 (validation), 409 (duplicate), 500 (generic, no stack trace)

Services:
- ConsentService.create(tenantId, { dataPrincipalId, purpose, status, createdBy })
- AuditService.log({ tenantId, actorId, resourceType, resourceId, action, changes, ipAddress, userAgent })

Database: Parameterized queries (pg library), no string interpolation
Test: Happy path, validation failure, duplicate, authorization denied
Success = Endpoint works end-to-end, audit trail recorded, RLS enforced
```

---

#### Agent 1.5 — Unit & Integration Tests (Haiku 4.5)
**Input**: T1.4 endpoint, T1.2 schema, T3.1 authorization rules  
**Output**: tests/unit/*.test.mjs, tests/integration/*.test.mjs  
**Success Criteria**:
- [ ] All unit tests pass (ConsentService, AuditService)
- [ ] All integration tests pass (endpoint, auth, tenant, audit)
- [ ] Code coverage ≥ 80%
- [ ] No flaky tests
- [ ] Tests document expected behavior

**Complexity**: Simple/mechanical (test writing, following patterns)  
**Duration**: 4 hours  
**Depends on**: T1.2, T1.3, T1.4  
**Blocks**: T4.1 (final verification)

**Haiku Prompt Template**:
```
Write comprehensive tests for Privy360 API endpoints.
Input: ConsentService, AuditService, POST /consent endpoint

Unit tests (tests/unit/):
- ConsentService.create with valid input → consent created
- ConsentService.create with duplicate → error
- AuditService.log → record inserted
- Validation: invalid purpose → error, missing fields → error

Integration tests (tests/integration/):
- Happy path: POST /consent → 201, audit logged
- Validation: invalid input → 400
- Duplicate: second consent for same principal+purpose → 409
- Authorization: viewer role → 403, operator role → 201
- Tenant isolation: Tenant A user cannot see Tenant B data (RLS)

Use: Node.js test runner, @testing-library/node
Run: pnpm test
Success = All tests pass, ≥80% coverage, no flaky tests
```

---

### **TEAM 2: Web Frontend** (Haiku Lead + Opus for Design System)

#### Agent 2.1 — Dev Server Scaffold (Haiku 4.5)
**Input**: Vite + React template, tsconfig, package.json  
**Output**: React app running on port 5173 with hot reload  
**Success Criteria**:
- [ ] `pnpm -F @privy360/web dev` starts on 5173
- [ ] App renders (title, basic layout)
- [ ] HMR works on file change
- [ ] TypeScript strict mode compiles
- [ ] README with setup

**Complexity**: Simple/mechanical  
**Duration**: 2 hours  
**Depends on**: Nothing  
**Blocks**: T2.2

**Haiku Prompt Template**:
```
Scaffold React + Vite dev server.
- Create apps/web/vite.config.ts (React plugin, port 5173)
- Create apps/web/src/main.tsx entrypoint
- Create apps/web/src/App.tsx root component
- Create apps/web/index.html
- Add dev script: vite
- Enable hot reload, strict TypeScript
- Output: working dev server, README
Test: pnpm -F @privy360/web dev → loads on http://localhost:5173
Success = app renders, HMR works, no console errors
```

---

#### Agent 2.2 — Design System & Component Library (Haiku Lead, Opus Assists on Strategy)
**Input**: Design tokens, component patterns, Tailwind config  
**Output**: 5+ components, design tokens (CSS variables), Storybook setup  
**Success Criteria**:
- [ ] Button, Form, Card, Modal, Select components created
- [ ] Design tokens defined (colors, typography, spacing)
- [ ] Dark mode CSS variables ready
- [ ] All components render without errors
- [ ] TypeScript strict mode compiles
- [ ] Snapshot tests pass

**Complexity**: Medium (creative choices, Opus advises on system design)  
**Duration**: 6 hours  
**Depends on**: T2.1  
**Blocks**: T2.3

**Opus Strategy Prompt** (high-level):
```
Design system strategy for Privy360.
- Color palette: primary (#0066cc), secondary (#666), success, danger, warning
- Typography: system fonts, 6 sizes (xs-xl)
- Spacing: 0.25rem, 0.5rem, 1rem, 1.5rem, 2rem
- Dark mode: CSS variables with media query fallback
- Components: Button, Form, Card, Modal, Select (extensible)
- Build: Tailwind CSS, BEM naming, no hardcoded colors
- Documentation: Storybook with stories per component
Output: design-tokens.css, component interfaces, Storybook setup
```

**Haiku Implementation** (component creation):
```
Create React component library with Tailwind.
Use design tokens from design-tokens.css.

Button.tsx:
- Props: variant (primary/secondary/danger), size (sm/md/lg), disabled, onClick
- CSS: btn btn--{variant} btn--{size}
- Export: Button

Card.tsx, Form.tsx, Modal.tsx, Select.tsx — same pattern
Add Storybook stories for each component
Test: Snapshot tests, accessibility checks
Success = 5 components, dark mode ready, TypeScript strict, stories written
```

---

#### Agent 2.3 — Consent Management UI (Haiku 4.5)
**Input**: API endpoint (T1.4), design system (T2.2), design tokens  
**Output**: ConsentPage.tsx, CreateConsentForm.tsx, useConsents hook  
**Success Criteria**:
- [ ] Form renders with inputs: principal ID, purpose dropdown, grant/deny
- [ ] Submit creates consent via POST /api/v1/consents
- [ ] List displays consents from GET /api/v1/consents
- [ ] Error messages displayed
- [ ] Loading state shown
- [ ] TypeScript strict mode compiles

**Complexity**: Simple/mechanical (form integration, API calls)  
**Duration**: 6 hours  
**Depends on**: T2.2, T1.4 (API endpoint must exist)  
**Blocks**: T4.2 (E2E tests)

**Haiku Prompt Template**:
```
Build Consent Management UI for Privy360.
Input: POST /consent endpoint (T1.4), design system (T2.2)

Create:
1. src/pages/ConsentPage.tsx
   - List consents from GET /api/v1/consents
   - Show loading state, error messages
   - Call useConsents hook

2. src/forms/CreateConsentForm.tsx
   - Inputs: data principal ID (text), purpose (select: marketing/analytics/operations/research), grantConsent (radio)
   - Validation: required fields
   - Submit: POST /api/v1/consents
   - Error handling: show error message

3. src/hooks/useConsents.ts
   - Fetch consents: GET /api/v1/consents
   - Create consent: POST /api/v1/consents
   - Handle authorization errors (403 → show message)
   - Handle API errors (500 → show generic message)

Styling: Use Button, Card, Form components from T2.2
Test: Form submission, API call, error display, list refresh
Success = Form creates consent, list displays, errors handled gracefully
```

---

### **TEAM 3: Security & Infrastructure** (Opus Lead)

#### Agent 3.1 — Authorization Rules & Middleware (Opus 4.6)
**Input**: RBAC_ABAC.md, SECURITY_ARCHITECTURE.md, AGENTS.md  
**Output**: middleware/authz.ts, types/permissions.ts, permission matrix  
**Success Criteria**:
- [ ] Permission definitions frozen and documented
- [ ] Middleware enforces permissions on every route
- [ ] Cross-tenant access returns 403
- [ ] Admin role has all permissions
- [ ] Operator role can read/write consents
- [ ] Viewer role can read only

**Complexity**: High (security-critical, architectural)  
**Duration**: 4 hours  
**Depends on**: Nothing (parallel to T1.1)  
**Blocks**: T1.4, T4.1

**Opus Prompt Template**:
```
Design role-based authorization (RBAC) for Privy360.
Authority: RBAC_ABAC.md, SECURITY_ARCHITECTURE.md §7, AGENTS.md §7.

Define frozen permission matrix:
Permissions:
- consent:read
- consent:write
- user:read
- user:write
- audit:read
- admin:*

Roles:
- admin: [all permissions]
- operator: [consent:read, consent:write, audit:read]
- viewer: [consent:read, audit:read]

Create:
1. types/permissions.ts: Permission and Role types, rolePermissions map
2. middleware/authz.ts: authorize(...permissions) middleware
   - Extract user role from JWT
   - Check if user has required permissions
   - Reject with 403 if not (never 404 to avoid enumeration)
3. Freeze this permission matrix — do not change mid-implementation

Database: User roles stored in users.role column
Test: Admin can all, operator can write, viewer cannot write
Success = Centralized authorization, no scattered role checks, frozen spec
```

---

#### Agent 3.2 — Audit Logging Framework (Opus 4.6)
**Input**: AGENTS.md §15 (audit requirements), audit schema (T1.2)  
**Output**: AuditService.ts, audit types, logging middleware  
**Success Criteria**:
- [ ] Audit event logged for every mutation (create, update, delete)
- [ ] Audit events immutable (INSERT only)
- [ ] Includes: tenant, actor, resource, action, changes, IP, user agent
- [ ] No PII in stdout logs (except audit table)
- [ ] Audit table indexed for efficient queries

**Complexity**: High (security-critical, audit integrity)  
**Duration**: 4 hours  
**Depends on**: T1.2 (audit table), T1.3 (tenant context)  
**Blocks**: T1.4 (audit logging required)

**Opus Prompt Template**:
```
Design immutable audit logging for Privy360.
Authority: AGENTS.md §15, IMPLEMENTATION_ROADMAP.md.

Create:
1. types/audit.ts: AuditEvent interface
   - tenantId, actorId, resourceType, resourceId, action
   - changes: JSONB (what changed)
   - ipAddress, userAgent, createdAt

2. services/AuditService.ts: Audit logging
   - log(event: AuditEvent): Insert to audit_events table
   - Use parameterized queries (no interpolation)
   - Always insert, never update/delete
   - Log to stdout: [AUDIT] {tenant} {actor} {action} {resource}

3. middleware/auditContext.ts: Capture context
   - Extract IP: req.ip
   - Extract user agent: req.get('user-agent')
   - Attach to request for use in services

Integration: Call AuditService.log after every mutation (T1.4 endpoint)
Database: Insert into audit_events (BIGSERIAL, no updates)
Test: Audit event created, immutable, indexed
Success = Audit trail complete and tamper-evident
```

---

#### Agent 3.3 — RLS Validation & Tenant Isolation Tests (Opus 4.6)
**Input**: RLS policies (T1.2), authorization rules (T3.1), endpoint (T1.4)  
**Output**: tests/integration/tenants.isolation.test.mjs, test fixtures  
**Success Criteria**:
- [ ] All cross-tenant access tests PASS
- [ ] Authorization tests PASS (viewer cannot create, operator can)
- [ ] 10+ test cases covering isolation at DB and API layers
- [ ] No data leakage in error messages
- [ ] Test data cleaned up after each test

**Complexity**: High (security-critical, must not fail)  
**Duration**: 6 hours  
**Depends on**: T1.2, T3.1, T1.4  
**Blocks**: Nothing (parallel to other tests, but required before PR)

**Opus Prompt Template**:
```
Write comprehensive tenant isolation tests for Privy360.
Authority: AGENTS.md §6, §28 (tenant isolation tests mandatory).

Create tests/integration/tenants.isolation.test.mjs:

Test cases:
1. RLS Database-level:
   - Set app.tenant_id to Tenant A, query Tenant B data → 0 rows
   - Set app.tenant_id to Tenant B, query Tenant A data → 0 rows
   - Direct query without tenant context → 0 rows (RLS blocks)

2. Authorization API-level:
   - Viewer user GET /consent → 200 (read allowed)
   - Viewer user POST /consent → 403 (write denied)
   - Operator user POST /consent → 201 (write allowed)
   - User from Tenant A POST as Tenant B → 403 (cross-tenant denied)

3. Audit Event Isolation:
   - Audit events visible only to same tenant
   - Query audit_events from different tenant → 0 rows

4. Negative cases:
   - SQL injection attempt → 0 rows (parameterized queries work)
   - Missing JWT → 401 (unauthenticated)
   - Expired JWT → 401 (invalid)
   - Malicious tenant_id in request body → 403 (server-side tenant wins)

Use: fixtures/tenants.seed.sql (2 tenants, 3 users, test consents)
Run: pnpm test:cp1-postgres
Success = All 10+ tests pass, cross-tenant access blocked at every layer
```

---

#### Agent 3.4 — Security Scanning & CI Gates (Haiku 4.5)
**Input**: codebase (T1.4, T2.3), CI config  
**Output**: CI pipeline with security gates, scanning reports  
**Success Criteria**:
- [ ] `pnpm audit:deps` passes (no high-severity issues)
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] gitleaks finds no secrets
- [ ] All tests pass (unit, integration, auth, tenant, security)

**Complexity**: Simple/mechanical (configure tools, run scans)  
**Duration**: 4 hours  
**Depends on**: T1.4, T2.3 (code to scan)  
**Blocks**: Nothing (non-blocking, but should be clean)

**Haiku Prompt Template**:
```
Set up security scanning and CI gates.
- Run pnpm audit:deps → no high-severity issues
- Run pnpm lint → ESLint checks pass
- Run pnpm typecheck → TypeScript strict mode
- Run gitleaks → no secrets in git history
- Run pnpm test → all unit/integration tests pass
- Generate SBOM (optional but recommended)
Acceptance: All gates green before PR merge
Success = CI pipeline green, no security findings
```

---

## 🔄 Data Flow & Synchronization

### **Week 1 Synchronization Points**

| Day | Team | Checkpoint | Success Criteria |
|-----|------|-----------|------------------|
| **EOD 2** | All | Dev servers running | API ✅ port 3000, Web ✅ port 5173, hot reload works |
| **EOD 3** | All | DB schema + endpoints | Schema ✅ migrations work, RLS ✅ enabled, Endpoint ✅ accepts POST |
| **EOD 4** | All | All tests green | Unit ✅, Integration ✅, Auth ✅, Tenant ✅ |
| **EOD 5** | All | Docs + PR ready | README ✅, OpenAPI ✅, DPDP ✅ mapping, PR ✅ checklist |

### **Cross-Team Handoffs (Token-Reduced)**

1. **T1.4 → T2.3 Handoff** (API endpoint ready for web)
   - **Opus writes**: Endpoint spec (request/response)
   - **`/headroom` reduces context**
   - **Haiku implements**: Consent form consuming endpoint
   - **Verification**: Web tests verify API contract

2. **T3.1 → T1.4 Handoff** (Authorization rules frozen)
   - **Opus writes**: Permission matrix (frozen)
   - **`/headroom` reduces context**
   - **Opus implements**: Endpoint with middleware
   - **Verification**: T3.3 tests verify enforcement

3. **T3.3 → T4.1 Handoff** (RLS tests validate isolation)
   - **Opus writes**: Test results, findings
   - **PR blocked if tests fail**
   - **Never ship without passing RLS tests**

---

## 🎯 Model Assignment Strategy

### **Haiku 4.5 — Simple/Mechanical Tasks**
- File scaffolding (dev servers, component generation)
- Test writing (following patterns, covering happy path)
- UI component implementation (forms, lists, using design system)
- Security scanning (running tools, reporting results)
- Documentation (README, comments)

**Saves Opus capacity** for critical decisions.  
**Parallelizes** high-volume, low-complexity work.  
**Cost-effective**: Haiku is faster and cheaper.

### **Opus 4.6 — Complex/Decision-Heavy Tasks**
- Architecture design (tenant isolation, RLS policies)
- Security implementation (auth/authz, audit logging)
- Authorization logic (role-based access control)
- Database schema design (migration strategy)
- Test strategy (isolation, security, edge cases)

**Ensures** critical decisions are sound.  
**Reviews** Haiku output for security implications.  
**Handles** edge cases and failure scenarios.

---

## 🛡️ Failure Handling

### **If Agent Fails**

| Failure | Impact | Recovery |
|---------|--------|----------|
| **Haiku dev server fails** | Blocks team immediately | Opus takes over, diagnoses, writes fix |
| **Opus RLS policy fails** | Blocks all testing | Escalate to Chief Architect, revert to simple isolation |
| **Cross-team handoff blocked** | Cascades to next team | Opus bridges gap with mock/stub, unblock parallel work |
| **Security scan finds issues** | Blocks PR | Fix in-place, re-scan, verify gate passes |

### **Escalation Criteria**

🚨 **Escalate to Chief Architect if**:
- RLS policies don't isolate correctly
- Authorization logic bypassed
- Secrets found in code
- Audit logging fails silently
- Multi-tenant read/write inconsistency

---

## 📊 Token & Time Management

### **Context Reduction Strategy**

| Handoff | Compression | Savings |
|---------|-----------|---------|
| T1.2 → T1.3 | `/headroom` before handoff | ~40% context |
| T3.1 → T1.4 | `/headroom` before handoff | ~40% context |
| T4.1 → Final PR | `/headroom` before synthesis | ~50% context |

**Each handoff uses `/headroom`** to compress intermediate results.  
**Opus reviews** compressed summary for accuracy.  
**Trace preserved** in decision log for audit trail.

### **Effort Distribution (86 hours total)**

| Task | Model | Effort | Days |
|------|-------|--------|------|
| **API Team** | | 36 hrs | 4–5 |
| T1.1 Dev Server | Haiku | 4 hrs | 1 |
| T1.2 DB Schema | Opus | 6 hrs | 1.5 |
| T1.3 Tenant Ctx | Opus | 4 hrs | 1 |
| T1.4 Endpoint | Opus | 6 hrs | 1.5 |
| T1.5 Tests | Haiku | 4 hrs | 1 |
| T1.5 E2E/Docs | Haiku | 4 hrs | 1 |
| **Web Team** | | 26 hrs | 3.5 |
| T2.1 Dev Server | Haiku | 2 hrs | 0.5 |
| T2.2 Design Sys | Opus (strategy) + Haiku | 6 hrs | 1.5 |
| T2.3 Consent UI | Haiku | 6 hrs | 1.5 |
| T2.3 Tests | Haiku | 4 hrs | 1 |
| T2.3 Docs | Haiku | 2 hrs | 0.5 |
| **Security** | | 24 hrs | 3 |
| T3.1 AuthZ | Opus | 4 hrs | 1 |
| T3.2 Audit | Opus | 4 hrs | 1 |
| T3.3 RLS Tests | Opus | 6 hrs | 1.5 |
| T3.4 Security Scan | Haiku | 4 hrs | 1 |
| T3.4 CI Gates | Haiku | 2 hrs | 0.5 |
| **Synthesis** | | 4 hrs | 1 |
| PR Review | Opus | 4 hrs | 1 |

---

## ✅ Execution Checklist

- [ ] **Week 1, Day 1**: All 3 teams spawn, start parallel work (T1.1, T2.1, T3.1, T1.2, etc.)
- [ ] **EOD Day 2**: Dev servers running (both teams unblocked for T1.3, T2.2)
- [ ] **EOD Day 3**: DB schema + AuthZ rules frozen (endpoint work can begin)
- [ ] **EOD Day 4**: All tests green (RLS, auth, tenant, audit)
- [ ] **EOD Day 5**: Docs complete, security gates pass, PR ready
- [ ] **Week 2**: PR review, merge, preparation for T2+ features

---

## 🎓 Decision Tracing

Every auto-decision logged to:  
**`DECISIONS_LOG.md`** — Timestamp, decision, rationale, who decided, impact

Example:
```markdown
| 2026-10-16 09:30 | Use Fastify over Express | @Opus: Better security headers, built-in rate-limiting | Team: 3 (T1.1, T3.1, API perf) |
| 2026-10-16 10:15 | RLS via session variable | @Opus: Avoids per-tenant DB users, AWS best practice | Isolation, maintainability |
| 2026-10-16 14:45 | Haiku: T2.3 Consent UI | @Opus: Simple form integration, no architectural decisions | Cost, velocity |
```

---

## 🚀 Ready to Launch

**This orchestration plan**:
- ✅ Maximizes parallelism (3 teams, 5 days)
- ✅ Minimizes token waste (Haiku for mechanical, Opus for strategic)
- ✅ Ensures decisions are traceable (decision log)
- ✅ Handles failures gracefully (escalation criteria)
- ✅ Synchronizes teams weekly (EOD checkpoints)

**Launch conditions**:
1. All agents briefed on their task (this document)
2. Tech stack dependencies installed
3. Parallel teams ready to start
4. Decision log initialized
5. Token budget allocated (estimated ~4M tokens for Week 1)

---

**Status**: Ready to spawn agents  
**Next step**: Launch parallel teams (T1.1, T2.1, T3.1 simultaneously)  
**Week 1 Goal**: Unblocked, working, synchronized  
**Week 2 Goal**: PR ready, all gates pass, ship  
