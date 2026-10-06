-- TENANT-001 rollback. AUDIT, identity, regulatory and public schemas are not touched.
drop function if exists platform.provision_bootstrap_actor(uuid);
drop function if exists tenant.check_business_unit_hierarchy();
drop schema if exists tenant cascade;
drop schema if exists platform cascade;
