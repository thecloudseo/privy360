drop trigger if exists audit_anchors_append_only on audit.audit_anchors;
drop trigger if exists platform_audit_anchors_append_only on platform_audit.platform_audit_anchors;
drop function if exists audit.reject_immutable_anchor_mutation();
drop table if exists audit.audit_anchors;
drop table if exists platform_audit.platform_audit_anchors;
