# packages/audit

AUDIT-001 owns the canonical audit context/event contracts and atomic audit,
outbox, and idempotency boundary. The durable SQL schema is under
`packages/database/migrations/0002_audit_foundation.*.sql`.

AUDIT-002 owns delivery, inbox dedupe, dead-letter and replay. AUDIT-003 owns
signed anchors and independent verification. This package does not expose an
audit query endpoint and does not implement identity or tenant selection.
