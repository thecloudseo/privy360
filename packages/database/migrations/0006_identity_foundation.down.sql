-- IDENTITY-001 rollback. No objects outside this ticket are removed.
drop table if exists tenant.sessions;
drop table if exists tenant.users;
