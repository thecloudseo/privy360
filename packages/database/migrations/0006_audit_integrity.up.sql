-- AUDIT-003: signed anchor metadata. Private keys and audit payloads are never stored here.

create table if not exists audit.audit_anchors (
  anchor_id uuid primary key default uuidv7(),
  scope text not null default 'TENANT' check (scope = 'TENANT'),
  tenant_id uuid not null,
  stream_id uuid not null,
  start_sequence bigint not null check (start_sequence >= 1),
  end_sequence bigint not null check (end_sequence >= start_sequence),
  start_previous_hash bytea,
  end_hash bytea not null,
  anchor_digest bytea not null,
  canonicalization_version integer not null check (canonicalization_version = 1),
  key_ref text not null check (key_ref ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,127}$'),
  signature bytea not null,
  provider_metadata_digest bytea not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (tenant_id, stream_id, end_sequence),
  foreign key (tenant_id, stream_id) references audit.audit_streams(tenant_id, stream_id)
);

create table if not exists platform_audit.platform_audit_anchors (
  anchor_id uuid primary key default uuidv7(),
  scope text not null default 'GLOBAL_CORPUS' check (scope = 'GLOBAL_CORPUS'),
  stream_id uuid not null references platform_audit.platform_audit_streams(stream_id),
  start_sequence bigint not null check (start_sequence >= 1),
  end_sequence bigint not null check (end_sequence >= start_sequence),
  start_previous_hash bytea,
  end_hash bytea not null,
  anchor_digest bytea not null,
  canonicalization_version integer not null check (canonicalization_version = 1),
  key_ref text not null check (key_ref ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,127}$'),
  signature bytea not null,
  provider_metadata_digest bytea not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (stream_id, end_sequence)
);

create or replace function audit.reject_immutable_anchor_mutation()
returns trigger language plpgsql as $$
begin raise exception 'audit anchors are append-only'; end $$;
create trigger audit_anchors_append_only before update or delete on audit.audit_anchors
for each row execute function audit.reject_immutable_anchor_mutation();
create trigger platform_audit_anchors_append_only before update or delete on platform_audit.platform_audit_anchors
for each row execute function audit.reject_immutable_anchor_mutation();

alter table audit.audit_anchors enable row level security;
alter table audit.audit_anchors force row level security;
create policy audit_anchors_tenant_isolation on audit.audit_anchors
using (tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid)
with check (tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid);

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'privy360_app') then
    revoke update, delete, truncate on audit.audit_anchors from privy360_app;
    grant insert, select on audit.audit_anchors to privy360_app;
  end if;
end $$;

insert into audit.schema_migrations(version, checksum)
values ('0006_audit_integrity', 'AUDIT-003-SQL-V1')
on conflict (version) do nothing;
