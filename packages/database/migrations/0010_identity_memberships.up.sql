-- IDENTITY-002: verified tenant membership selection state.
create table if not exists tenant.user_memberships (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  user_id uuid not null,
  actor_id uuid not null,
  state text not null default 'ACTIVE' check (state in ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  security_epoch bigint not null default 1 check (security_epoch >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, user_id) references tenant.users(tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_id) references tenant.actor_refs(tenant_id, id) on delete restrict
);
create unique index if not exists user_memberships_active_user_idx on tenant.user_memberships (tenant_id, user_id) where state = 'ACTIVE';
create index if not exists user_memberships_lookup_idx on tenant.user_memberships (tenant_id, user_id, state, id);
alter table tenant.user_memberships enable row level security;
alter table tenant.user_memberships force row level security;
create policy user_memberships_tenant_isolation on tenant.user_memberships
  using (tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid);
revoke all on tenant.user_memberships from public;
grant select on tenant.user_memberships to privy360_app;
insert into platform.schema_migrations(version, checksum)
values ('0010_identity_memberships', 'IDENTITY-002-SQL-V1') on conflict (version) do nothing;
