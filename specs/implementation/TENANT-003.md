# TENANT-003 Implementation Plan

## Objective and acceptance

Define portable, fail-closed helpers for tenant-scoped work items, deployment routing, cache namespaces, and object-storage keys. Tenant-owned infrastructure namespaces originate only from the immutable `TrustedTenantContext` established by TENANT-002. The ticket is accepted when forged request tenant values cannot alter scope, tenant routes consume verified registry output, tenant cache keys cannot collide or invalidate across tenants, and canonical object keys cannot escape their trusted deployment/tenant prefix.

## Contracts consumed

- TENANT-001: stable tenant UUID ownership and deny-by-default/RLS direction. No schema is changed; the `work_items` migration remains owned by audit/workflow tickets.
- TENANT-002: `TrustedTenantContext`, verified server-side context creation, UUID validation, missing-context denial, and same-tenant nested-context enforcement. No competing tenant context is introduced.
- FOUNDATION-005: safe, non-secret error behavior and server-side validation direction; no public API middleware is added.

## Contracts owned

- Immutable tenant work-item attribution copied from trusted context: tenant, actor, membership, correlation, policy version, work ID, and scope fingerprint.
- A deployment registry port and deterministic route resolver. The resolver supplies the trusted tenant ID to the registry and verifies returned tenant ownership. Platform routes use a separate resolver and namespace.
- Deterministic tenant and platform cache keys with validated segments. Tenant invalidation requires the same trusted tenant context that created the namespace.
- Deterministic tenant and platform object keys with validated canonical segments. Absolute paths, traversal, encoded delimiters, mixed/duplicate separators, and reserved infrastructure namespace segments are rejected.
- Deployment modes remain portable: shared SaaS, dedicated SaaS, customer cloud/VPC, and Government on-premise.

## Security and privacy invariants

Browser headers, query/body tenant IDs, caller cache namespaces, and caller storage prefixes are never accepted as trusted isolation input. Missing context and registry mismatches fail closed. Tenant and platform namespaces are structurally distinct. Outputs contain identifiers only and never credentials, endpoints, connection strings, bucket names, or personal data. Application authorization remains a prerequisite outside this pure helper boundary.

## Files and tests

- Add `packages/security/src/tenant-infrastructure.ts` and export it from the existing package root.
- Add adversarial contract tests in `tests/tenancy/tenant-003.test.mjs` covering missing/malformed/unverified context, route mismatch, cross-tenant cache collision/invalidation, platform confusion, traversal/absolute/encoded/mixed paths, deterministic generation, and nested-context mismatch regression.
- Run TENANT-001/002 regressions, complete unit/security tests, package/repository gates, and approved runtime checks only if FOUNDATION-003 admits PostgreSQL.

## Downstream consumers and exclusions

TENANT-003 freezes ports for PORTAL-001, TENANT-004, IDENTITY-001 routing/session lookup, workers, caches, and storage-owning modules. Out of scope: identity/authentication, RBAC/ABAC, tenant provisioning, public domain verification, Redis/S3 clients, bucket/database creation, work-item persistence, audit emission, physical sharding, W3 tickets, and production/runtime admission changes.

## CP1 evidence

This ticket supplies the routing/cache/object-key contract and adversarial evidence required by CP1. CP1 still requires the approved PostgreSQL runtime-role RLS escape suite; static fixtures cannot replace it.
