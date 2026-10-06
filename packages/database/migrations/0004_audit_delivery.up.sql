create table if not exists audit.inbox_receipts (
  receipt_id uuid primary key default uuidv7(),
  scope text not null check (scope in ('TENANT', 'GLOBAL_CORPUS')),
  tenant_id uuid,
  consumer text not null check (consumer ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,127}$'),
  event_id uuid not null,
  correlation_id uuid not null,
  causation_id uuid,
  processed_at timestamptz not null default now(),
  unique (scope, tenant_id, consumer, event_id),
  check ((scope = 'TENANT' and tenant_id is not null) or (scope = 'GLOBAL_CORPUS' and tenant_id is null))
);

create table if not exists audit.work_items (
  work_item_id uuid primary key default uuidv7(),
  scope text not null check (scope in ('TENANT', 'GLOBAL_CORPUS')),
  tenant_id uuid,
  event_id uuid not null references audit.outbox_events(event_id),
  state text not null default 'PENDING' check (state in ('PENDING', 'LEASED', 'DELIVERED', 'DEAD_LETTER')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  leased_until timestamptz,
  last_error_code text,
  last_error_digest text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  check ((scope = 'TENANT' and tenant_id is not null) or (scope = 'GLOBAL_CORPUS' and tenant_id is null)),
  unique (scope, tenant_id, event_id)
);

create index if not exists audit_work_items_ready_idx on audit.work_items(state, available_at, created_at);
alter table audit.inbox_receipts enable row level security;
alter table audit.inbox_receipts force row level security;
alter table audit.work_items enable row level security;
alter table audit.work_items force row level security;
create policy inbox_receipts_tenant_isolation on audit.inbox_receipts using (scope = 'GLOBAL_CORPUS' or tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid);
create policy work_items_tenant_isolation on audit.work_items using (scope = 'GLOBAL_CORPUS' or tenant_id = nullif(current_setting('privy360.tenant_id', true), '')::uuid);

insert into audit.schema_migrations(version, checksum) values ('0004_audit_delivery', 'AUDIT-002-SQL-V1') on conflict (version) do nothing;
