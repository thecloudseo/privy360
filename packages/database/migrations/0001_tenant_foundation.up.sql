-- TENANT-001: platform tenant registry and tenant-owned organisation foundation.
-- Executed by the migration role only. Runtime context/RLS transaction setup is
-- owned by TENANT-002; this migration only installs the boundary.

create schema if not exists platform;
create schema if not exists tenant;

create table if not exists platform.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now(),
  checksum text not null
);

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'privy360_migrator') then
    create role privy360_migrator noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'privy360_app') then
    create role privy360_app noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end $$;
alter role privy360_migrator nosuperuser nocreatedb nocreaterole nobypassrls;
alter role privy360_app nosuperuser nocreatedb nocreaterole nobypassrls;

create table if not exists platform.deployments (
  id uuid primary key default uuidv7(),
  code text not null unique,
  region text not null,
  connection_ref text not null,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists platform.tenants (
  id uuid primary key default uuidv7(),
  slug text not null,
  state text not null default 'ACTIVE' check (state in ('ACTIVE', 'SUSPENDED', 'CLOSING')),
  deployment_id uuid,
  security_epoch bigint not null default 1 check (security_epoch >= 1),
  created_at timestamptz not null default now(),
  unique (slug),
  constraint tenants_slug_normalized check (slug = lower(btrim(slug)) and slug <> '')
);

alter table platform.tenants
  add constraint tenants_deployment_fk
  foreign key (deployment_id) references platform.deployments(id) on delete restrict;
alter table platform.deployments
  add column if not exists tenant_id uuid;
alter table platform.deployments
  add constraint deployments_tenant_fk
  foreign key (tenant_id) references platform.tenants(id) on delete restrict;

create table if not exists tenant.actor_refs (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  actor_kind text not null check (actor_kind in ('USER', 'PRINCIPAL', 'SERVICE', 'SUPPORT', 'BOOTSTRAP')),
  identity_ref text,
  pseudonym text not null,
  provisioning_marker text,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  version bigint not null default 1 check (version >= 1),
  unique (tenant_id, actor_kind, identity_ref),
  unique (tenant_id, id),
  constraint actor_bootstrap_restricted check (
    actor_kind <> 'BOOTSTRAP' or provisioning_marker = 'TENANT_FOUNDATION_PROVISIONING'
  )
);
alter table tenant.actor_refs
  add constraint actor_refs_self_created_by_fk
  foreign key (tenant_id, created_by) references tenant.actor_refs(tenant_id, id)
  deferrable initially deferred;
alter table tenant.actor_refs
  add constraint actor_refs_self_updated_by_fk
  foreign key (tenant_id, updated_by) references tenant.actor_refs(tenant_id, id)
  deferrable initially deferred;
create table if not exists tenant.organisations (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  code text not null,
  name text not null check (char_length(name) between 1 and 255),
  locale text not null default 'en-IN',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  version bigint not null default 1 check (version >= 1),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, created_by) references tenant.actor_refs(tenant_id, id),
  foreign key (tenant_id, updated_by) references tenant.actor_refs(tenant_id, id)
);

create table if not exists tenant.legal_entities (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  organisation_id uuid not null,
  code text not null,
  name text not null check (char_length(name) between 1 and 255),
  jurisdiction text not null check (char_length(jurisdiction) between 2 and 64),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  version bigint not null default 1 check (version >= 1),
  unique (tenant_id, id),
  unique (tenant_id, organisation_id, code),
  foreign key (tenant_id, organisation_id) references tenant.organisations(tenant_id, id),
  foreign key (tenant_id, created_by) references tenant.actor_refs(tenant_id, id),
  foreign key (tenant_id, updated_by) references tenant.actor_refs(tenant_id, id)
);

create table if not exists tenant.business_units (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  legal_entity_id uuid not null,
  parent_id uuid,
  code text not null,
  name text not null check (char_length(name) between 1 and 255),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  version bigint not null default 1 check (version >= 1),
  unique (tenant_id, id),
  unique (tenant_id, id, legal_entity_id),
  unique (tenant_id, legal_entity_id, code),
  foreign key (tenant_id, legal_entity_id) references tenant.legal_entities(tenant_id, id),
  foreign key (tenant_id, parent_id, legal_entity_id)
    references tenant.business_units(tenant_id, id, legal_entity_id),
  foreign key (tenant_id, created_by) references tenant.actor_refs(tenant_id, id),
  foreign key (tenant_id, updated_by) references tenant.actor_refs(tenant_id, id),
  constraint business_units_not_self_parent check (parent_id is null or parent_id <> id)
);

create table if not exists tenant.departments (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  business_unit_id uuid not null,
  code text not null,
  name text not null check (char_length(name) between 1 and 255),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  version bigint not null default 1 check (version >= 1),
  unique (tenant_id, id),
  unique (tenant_id, business_unit_id, code),
  foreign key (tenant_id, business_unit_id) references tenant.business_units(tenant_id, id),
  foreign key (tenant_id, created_by) references tenant.actor_refs(tenant_id, id),
  foreign key (tenant_id, updated_by) references tenant.actor_refs(tenant_id, id)
);

create table if not exists tenant.resource_registry (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  resource_type text not null,
  resource_id uuid not null,
  scope text not null default 'TENANT',
  sensitivity text not null default 'NORMAL',
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  version bigint not null default 1 check (version >= 1),
  unique (tenant_id, id),
  unique (tenant_id, resource_type, resource_id),
  foreign key (tenant_id, created_by) references tenant.actor_refs(tenant_id, id),
  foreign key (tenant_id, updated_by) references tenant.actor_refs(tenant_id, id)
);

create or replace function tenant.check_business_unit_hierarchy()
returns trigger language plpgsql as $$
declare
  cursor_id uuid;
  cursor_legal_entity uuid;
  seen uuid[] := array[]::uuid[];
begin
  if new.parent_id is null then return new; end if;
  select id, legal_entity_id into cursor_id, cursor_legal_entity
    from tenant.business_units
    where tenant_id = new.tenant_id and id = new.parent_id;
  if cursor_id is null or cursor_legal_entity <> new.legal_entity_id then
    raise exception 'business unit parent must remain within tenant and legal entity';
  end if;
  while cursor_id is not null loop
    if cursor_id = any(seen) or cursor_id = new.id then
      raise exception 'business unit hierarchy cycle detected';
    end if;
    seen := array_append(seen, cursor_id);
    select parent_id into cursor_id from tenant.business_units
      where tenant_id = new.tenant_id and id = cursor_id;
  end loop;
  return new;
end $$;
create constraint trigger business_units_hierarchy_guard
after insert or update of parent_id, legal_entity_id on tenant.business_units
deferrable initially deferred for each row execute function tenant.check_business_unit_hierarchy();

create or replace function platform.provision_bootstrap_actor(target_tenant uuid)
returns uuid language plpgsql security definer set search_path = tenant, platform, pg_temp as $$
declare actor_id uuid := uuidv7();
begin
  if current_user <> 'privy360_migrator' then
    raise exception 'bootstrap provisioning requires migration role';
  end if;
  perform set_config('privy360.tenant_id', target_tenant::text, true);
  insert into tenant.actor_refs
    (id, tenant_id, actor_kind, pseudonym, provisioning_marker, created_by, updated_by)
  values
    (actor_id, target_tenant, 'BOOTSTRAP', 'system-bootstrap',
     'TENANT_FOUNDATION_PROVISIONING', actor_id, actor_id);
  return actor_id;
end $$;
revoke all on function platform.provision_bootstrap_actor(uuid) from public;
revoke all on function platform.provision_bootstrap_actor(uuid) from privy360_app;
grant execute on function platform.provision_bootstrap_actor(uuid) to privy360_migrator;

do $$ declare table_name text; begin
  foreach table_name in array array['actor_refs','organisations','legal_entities','business_units','departments','resource_registry'] loop
    execute format('alter table tenant.%I enable row level security', table_name);
    execute format('alter table tenant.%I force row level security', table_name);
    execute format('create policy %I on tenant.%I using (tenant_id = nullif(current_setting(''privy360.tenant_id'', true), '''')::uuid) with check (tenant_id = nullif(current_setting(''privy360.tenant_id'', true), '''')::uuid)', table_name || '_tenant_isolation', table_name);
  end loop;
end $$;

revoke all on all tables in schema tenant from privy360_app;
grant select, insert, update, delete on all tables in schema tenant to privy360_app;
revoke all on all sequences in schema tenant from privy360_app;
revoke all on schema platform, tenant from public;
grant usage on schema tenant to privy360_app;

insert into platform.schema_migrations(version, checksum)
values ('0001_tenant_foundation', 'TENANT-001-SQL-V1')
on conflict (version) do nothing;
