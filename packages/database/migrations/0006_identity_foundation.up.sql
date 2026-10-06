-- IDENTITY-001: tenant-scoped staff identity metadata and opaque sessions.
-- Credential identity remains in the external IdP; this migration stores no credential material.

create table if not exists tenant.users (
  id uuid primary key default uuidv7(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  issuer text not null check (char_length(issuer) between 1 and 512), subject text not null check (char_length(subject) between 1 and 512),
  display_name text, state text not null default 'ACTIVE' check (state in ('ACTIVE', 'SUSPENDED', 'DISABLED')),
  security_epoch bigint not null default 1 check (security_epoch >= 1), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, id), unique (tenant_id, issuer, subject)
);

create table if not exists tenant.sessions (
  id uuid primary key default uuidv7(), tenant_id uuid not null references platform.tenants(id) on delete restrict, user_id uuid not null,
  token_hash text not null check (char_length(token_hash) = 64), issuer text not null, subject text not null,
  security_epoch bigint not null check (security_epoch >= 1), token_bundle_secret_ref text not null check (char_length(token_bundle_secret_ref) between 1 and 256),
  created_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), idle_expires_at timestamptz not null, expires_at timestamptz not null, revoked_at timestamptz,
  unique (tenant_id, id), unique (token_hash), foreign key (tenant_id, user_id) references tenant.users(tenant_id, id) on delete restrict,
  check (expires_at > created_at), check (idle_expires_at <= expires_at)
);
create index if not exists sessions_active_expiry_idx on tenant.sessions (tenant_id, expires_at) where revoked_at is null;
alter table tenant.users enable row level security;
alter table tenant.users force row level security;
alter table tenant.sessions enable row level security;
alter table tenant.sessions force row level security;
create policy users_tenant_isolation on tenant.users using (tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid) with check (tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid);
create policy sessions_tenant_isolation on tenant.sessions using (tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid) with check (tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid);
revoke all on tenant.users, tenant.sessions from public;
grant select, insert, update, delete on tenant.users, tenant.sessions to privy360_app;
insert into platform.schema_migrations(version, checksum) values ('0006_identity_foundation', 'IDENTITY-001-SQL-V1') on conflict (version) do nothing;
