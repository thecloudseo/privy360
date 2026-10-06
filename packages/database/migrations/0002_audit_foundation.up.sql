-- AUDIT-001: durable audit streams, immutable audit rows, outbox and idempotency.
-- Tenant context is supplied by TENANT-002; this migration never selects it.

create schema if not exists audit;
create schema if not exists platform_audit;
create extension if not exists pgcrypto;

create table if not exists audit.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now(),
  checksum text not null
);

create table if not exists audit.audit_streams (
  stream_id uuid primary key default uuidv7(),
  tenant_id uuid not null,
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  last_hash bytea,
  created_at timestamptz not null default now(),
  unique (tenant_id, stream_id)
);

create table if not exists audit.audit_events (
  event_id uuid primary key,
  stream_id uuid not null references audit.audit_streams(stream_id) on delete restrict,
  tenant_id uuid not null,
  sequence bigint not null check (sequence >= 1),
  actor_id uuid,
  actor_kind text check (actor_kind is null or actor_kind in ('USER', 'PRINCIPAL', 'SERVICE', 'SUPPORT', 'BOOTSTRAP')),
  action text not null check (action ~ '^[A-Z][A-Z0-9_.:-]{0,127}$'),
  resource_type text not null check (char_length(resource_type) between 1 and 128),
  resource_id uuid not null,
  resource_version text,
  result text not null check (result in ('SUCCESS', 'FAILURE', 'DENIED')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  correlation_id uuid not null,
  causation_id uuid,
  policy_decision_id uuid,
  source_channel text not null check (source_channel ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,127}$'),
  changed_field_names text[] not null default '{}',
  before_digest text,
  after_digest text,
  previous_hash bytea,
  event_hash bytea not null,
  unique (stream_id, sequence),
  foreign key (tenant_id, stream_id) references audit.audit_streams(tenant_id, stream_id),
  constraint audit_event_actor_required check (actor_id is not null or actor_kind = 'BOOTSTRAP')
);

create table if not exists platform_audit.platform_audit_streams (
  stream_id uuid primary key default uuidv7(),
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  last_hash bytea,
  created_at timestamptz not null default now()
);

create table if not exists platform_audit.platform_audit_events (
  event_id uuid primary key,
  stream_id uuid not null references platform_audit.platform_audit_streams(stream_id) on delete restrict,
  sequence bigint not null check (sequence >= 1),
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('USER', 'SERVICE', 'SUPPORT', 'BOOTSTRAP')),
  action text not null check (action ~ '^[A-Z][A-Z0-9_.:-]{0,127}$'),
  resource_type text not null,
  resource_id uuid not null,
  result text not null check (result in ('SUCCESS', 'FAILURE', 'DENIED')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  correlation_id uuid not null,
  source_channel text not null,
  changed_field_names text[] not null default '{}',
  before_digest text,
  after_digest text,
  previous_hash bytea,
  event_hash bytea not null,
  unique (stream_id, sequence)
);

create or replace function audit.jsonb_contains_prohibited_key(value jsonb)
returns boolean language plpgsql immutable as $$
declare entry record;
begin
  if jsonb_typeof(value) = 'object' then
    for entry in select * from jsonb_each(value) loop
      if entry.key ~* 'password|secret|token|credential|private[_-]?key|otp|bearer|prompt|uploaded[_-]?content' then
        return true;
      end if;
      if audit.jsonb_contains_prohibited_key(entry.value) then return true; end if;
    end loop;
  elsif jsonb_typeof(value) = 'array' then
    for entry in select value from jsonb_array_elements(value) loop
      if audit.jsonb_contains_prohibited_key(entry.value) then return true; end if;
    end loop;
  end if;
  return false;
end $$;

create table if not exists audit.outbox_events (
  event_id uuid primary key,
  tenant_id uuid not null,
  envelope jsonb not null,
  payload_schema text not null,
  state text not null default 'PENDING' check (state in ('PENDING', 'LEASED', 'DELIVERED', 'DEAD_LETTER')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  leased_until timestamptz,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (event_id),
  constraint outbox_no_prohibited_payload check (not audit.jsonb_contains_prohibited_key(envelope))
);

create table if not exists audit.idempotency_records (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null,
  actor_id uuid not null,
  route text not null,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 255),
  request_hash text not null,
  response_ref uuid,
  status text not null check (status in ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, actor_id, route, idempotency_key)
);

create index if not exists audit_outbox_ready_idx on audit.outbox_events(state, available_at, created_at);
create index if not exists audit_event_tenant_time_idx on audit.audit_events(tenant_id, recorded_at, event_id);
create unique index if not exists audit_idempotency_lookup_idx on audit.idempotency_records(tenant_id, actor_id, route, idempotency_key);

create or replace function audit.reserve_stream_position(target_stream uuid)
returns table(sequence bigint, previous_hash bytea)
language plpgsql security definer set search_path = audit, pg_temp as $$
declare current_sequence bigint; current_hash bytea;
begin
  select last_sequence, last_hash into current_sequence, current_hash
    from audit.audit_streams where stream_id = target_stream for update;
  if not found then raise exception 'audit stream not found'; end if;
  update audit.audit_streams set last_sequence = current_sequence + 1 where stream_id = target_stream;
  sequence := current_sequence + 1;
  previous_hash := current_hash;
  return next;
end $$;

create or replace function audit.compute_event_hash(canonical_event jsonb, prior_hash bytea)
returns bytea language sql immutable strict as $$
  select digest(convert_to(canonical_event::text || coalesce(encode(prior_hash, 'hex'), ''), 'UTF8'), 'sha256')
$$;

create or replace function audit.reject_immutable_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit records are append-only';
end $$;
create trigger audit_events_append_only
before update or delete on audit.audit_events
for each row execute function audit.reject_immutable_audit_mutation();
create trigger platform_audit_events_append_only
before update or delete on platform_audit.platform_audit_events
for each row execute function audit.reject_immutable_audit_mutation();

do $$ declare table_name text; begin
  foreach table_name in array array['audit_streams','audit_events','outbox_events','idempotency_records'] loop
    execute format('alter table audit.%I enable row level security', table_name);
    execute format('alter table audit.%I force row level security', table_name);
    execute format('create policy %I on audit.%I using (tenant_id = nullif(current_setting(''privy360.tenant_id'', true), '''')::uuid) with check (tenant_id = nullif(current_setting(''privy360.tenant_id'', true), '''')::uuid)', table_name || '_tenant_isolation', table_name);
  end loop;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'privy360_app') then
    revoke update, delete, truncate on audit.audit_events from privy360_app;
    revoke update, delete, truncate on audit.outbox_events from privy360_app;
    revoke update, delete, truncate on audit.idempotency_records from privy360_app;
    grant insert on audit.audit_events, audit.outbox_events, audit.idempotency_records to privy360_app;
  end if;
end $$;

insert into audit.schema_migrations(version, checksum)
values ('0002_audit_foundation', 'AUDIT-001-SQL-V1')
on conflict (version) do nothing;
