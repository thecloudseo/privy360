-- CP1 disposable fixture; applied only by an approved PostgreSQL test harness.
create schema if not exists tenant_test;
create table tenant_test.resources (
  tenant_id uuid not null,
  id uuid not null,
  primary key (tenant_id, id),
  foreign key (tenant_id, id) references tenant.resource_registry(tenant_id, id)
);
create table tenant_test.resource_links (
  tenant_id uuid not null,
  id uuid not null default uuidv7(),
  resource_id uuid not null,
  primary key (tenant_id, id),
  foreign key (tenant_id, resource_id) references tenant.resource_registry(tenant_id, id)
);
create or replace function tenant_test.prevent_tenant_change() returns trigger
language plpgsql as $$ begin
  if new.tenant_id <> old.tenant_id then raise exception 'tenant_id cannot be changed'; end if;
  return new;
end $$;
create trigger resource_links_tenant_immutable before update on tenant_test.resource_links
for each row execute function tenant_test.prevent_tenant_change();
alter table tenant_test.resource_links enable row level security;
alter table tenant_test.resource_links force row level security;
create policy resource_links_tenant_isolation on tenant_test.resource_links
using (tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid)
with check (tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid);
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'privy360_app' and rolbypassrls = false) then
    raise exception 'privy360_app must be NOBYPASSRLS';
  end if;
end $$;
