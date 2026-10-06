# FOUNDATION-005 Implementation Plan

**Objective:** Implement the error, validation, correlation, and pagination API middleware skeleton required by the approved API contract, with deterministic fail-closed behavior and no database or business endpoint implementation.

## Prerequisites and authority

- Exact ticket: `BUILD_PLAN.md` FOUNDATION-005 — “Implement error validation correlation and pagination middleware skeleton.”
- Dependency: FOUNDATION-004; consume only its exported security contracts where needed. No secrets/KMS interaction is required by this ticket.
- Relevant authority: `API_ARCHITECTURE.md`, `RBAC_ABAC.md`, `SECURITY_ARCHITECTURE.md`, ADR-016, and the FOUNDATION-004 plan.
- Roadmap entry: `EXECUTION_ROADMAP.md` ledger; wave W1, impact `CS`, no checkpoint gate.

## Contracts consumed from FOUNDATION-004

No runtime secret access is needed. The package boundary remains available for later consumers; FOUNDATION-005 must not duplicate or bypass `@privy360/security` ports, fake-provider rules, or OPEN-02.

## Contracts/artifacts owned

- A framework-neutral `@privy360/api-common` TypeScript boundary for typed API errors, correlation IDs, validation results, pagination parsing, and default-deny route permission checks.
- Stable response shapes matching `API_ARCHITECTURE.md`: `{type,title,status,code,correlationId,fieldErrors?}` and `{items,nextCursor,watermark?}`.
- Explicit limits: pagination `limit` 1..100, default 25; opaque cursor input is bounded and never treated as authorization.
- Unknown route permissions deny by default; DTO validation rejects caller-controlled `tenant_id`, `actor_id`, ownership, approval, and policy fields.

## Expected files/modules

- Create `packages/api-common/package.json`, `packages/api-common/tsconfig.json`, and `packages/api-common/src/index.ts`.
- Create focused contract tests in `tests/unit/foundation-005.test.mjs`.
- Update `pnpm-workspace.yaml`, `pnpm-lock.yaml` only if package-manager metadata requires it.

## Boundary implications

- Tenant/security: no tenant persistence or authorization implementation; trusted tenant/actor context remains server-side. Unknown permissions and malformed boundary data fail closed.
- Database: none; no migration, schema, RLS, or query implementation.
- Identity/auth: none; this ticket only exposes a permission-decision boundary that later auth layers can call.
- API/events/audit: common error/validation/correlation/pagination contracts only. No durable audit or outbox implementation; denial metadata remains safe for later AUDIT-001 integration.
- Privacy: no personal data, secrets, stack traces, or raw exception messages in client-facing errors.

## TDD and acceptance criteria

1. Error responses have stable non-disclosing fields and preserve a supplied safe correlation ID.
2. Invalid/missing correlation IDs produce a fresh UUID-shaped ID; caller secrets are not echoed.
3. DTO validation rejects unknown fields and specifically rejects browser-supplied tenant/actor/ownership/policy fields.
4. Pagination defaults to 25, accepts only 1..100, bounds cursors, and rejects malformed limits without leaking details.
5. Unknown route permissions are denied; only explicitly registered permissions can allow.
6. Contract tests cover positive and negative cases, including fail-closed behavior.
7. No downstream ticket is implemented; no database/API route/identity/auth/tenant/audit infrastructure is added.

## Downstream consumers

Direct dependents newly able to consume the frozen common boundary: `FOUNDATION-006`, `TENANT-001`, `AUDIT-001`, and `REGULATORY-001`. Their business implementations remain out of scope.

## Explicitly out of scope

NestJS controller/guard registration, OpenAPI generation, authentication, tenant registry/RLS, RBAC registry, durable audit/outbox, database migrations, rate limiting, UI shells, secrets/KMS, production provider selection, and all downstream ticket implementation.

## Verification plan

- TDD focused unit/contract test with red-green evidence.
- `pnpm install --frozen-lockfile`, format, lint, strict typecheck, focused test, full repository test, build, structure and production-boundary checks, changed-path secret scan, and `git diff --check`.
- Stage only FOUNDATION-005 source, tests, and this plan; inspect staged diff before committing.
