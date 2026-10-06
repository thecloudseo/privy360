-- AUDIT-001 rollback. Tenant, identity and regulatory schemas are untouched.
drop trigger if exists audit_events_append_only on audit.audit_events;
drop trigger if exists platform_audit_events_append_only on platform_audit.platform_audit_events;
drop function if exists audit.reject_immutable_audit_mutation();
drop schema if exists audit cascade;
drop schema if exists platform_audit cascade;
