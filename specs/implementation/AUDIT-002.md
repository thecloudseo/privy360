# AUDIT-002 Implementation Plan

## Objective and acceptance

Implement durable outbox delivery for the AUDIT-001 append/outbox boundary: consumer inbox deduplication, visible dead-letter state, bounded retry, and an explicitly scoped replay operation. Acceptance is a single consumer effect after a publish/ack crash, deterministic poison-event visibility, and no loss when the transient delivery path is unavailable.

## CP2 requirements

The roadmap CP2 gate is after `IDENTITY-002`, `AUTHZ-003`, and `AUDIT-002`, before enabling non-test business/identity/grant mutations. Its evidence is: actor/membership/permission matrix and deny cases (owned by identity/authz lanes), audit rollback, outbox crash/dedupe, and service context. This lane supplies the outbox crash/dedupe, retry/dead-letter, replay-boundary, correlation/causation, and audit rollback evidence available without implementing those other lanes. Protected PostgreSQL execution remains subject to FOUNDATION-003 admission.

## AUDIT-001 contracts consumed

The implementation consumes `AuditContext`, `AuditRecord`, `DomainEvent`, `IdempotencyClaim`, `AtomicAuditUnitOfWork`, and `AuditTransaction` conceptually and preserves their tenant/global scope, attribution, correlation, payload minimisation, append-only, and transactional direction. It does not alter their semantics or implement identity, tenant context, or authorization.

## Contracts and artifacts owned

- `DeliveryEnvelope`: event ID, trusted scope/tenant attribution, correlation/causation, schema identifier, and minimized payload reference.
- `InboxReceipt`: unique `(scope, tenant, consumer, event)` processing key with an atomic effect boundary.
- `OutboxDispatcher`: bounded retry, visible `DEAD_LETTER`, and no acknowledgement before consumer completion.
- `DeadLetterReplay`: explicit operator-scoped replay request; replay never silently mutates the original event or bypasses current authorization.
- Migration `0004_audit_delivery` for inbox receipts, work items, and delivery indexes/RLS.

## Failure and integrity semantics

Delivery is at-least-once. A crash after consumer publication but before acknowledgement may redeliver; the inbox receipt makes the business effect idempotent. A consumer failure rolls back its receipt/effect together. Transient failure retains the outbox item for retry; poison/schema/authorization failure becomes visible dead letter after the configured bound. Replay is explicit and bounded, not automatic. Tenant and global-corpus scopes remain distinct; a tenant event cannot be replayed as global and global events carry no tenant ID.

## Explicit exclusions and downstream blockers

No signed anchoring/WORM, audit query UI, identity or membership implementation, AUTHZ-003 service-token guard, tenant-context implementation, Redis broker, external production dispatcher, or downstream ticket implementation. AUDIT-003, REGULATORY-003, PORTAL-001, RIGHTS-001, NOTICES-001, CONSENT-001, VENDOR-001, RISK-001, INCIDENT-001, CONNECTOR-001, TENANT-004, and IDENTITY-005 remain blocked on this contract plus their other prerequisites.

## Verification

TDD tests cover duplicate delivery, crash-before-ack, transient retry, poison dead letter, explicit replay, correlation/causation preservation, prohibited payloads, tenant/global separation, and rollback of the in-memory delivery transaction. Static migration tests cover ownership, uniqueness, RLS, and bounded rollback. Full repository gates and CP2 evidence are reported separately; no live database admission is bypassed.
