create schema if not exists compliance;

create table compliance.control_templates (
  id uuid primary key default uuidv7(),
  code text not null,
  family text not null,
  revision integer not null check (revision > 0),
  guidance text not null,
  test_method text not null,
  unique (code, revision),
  check (family in ('GOV','APP','LPU','NOT','CON','CMI','ACC','SEC','BRE','RET','DEL','CTC','CHD','GRD','SDF','DPA','COR','ERS','GRV','NOM','DUT','XBR','EXM','PRC','DPI','AUD','ALG','REG'))
);

create table compliance.controls (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  code text not null,
  revision integer not null check (revision > 0),
  title text not null check (char_length(title) between 1 and 255),
  classification text not null check (classification in ('LEGAL_REQUIREMENT','IMPLEMENTATION_CONTROL','GOOD_PRACTICE')),
  family text not null,
  template_id uuid references compliance.control_templates(id) on delete restrict,
  requirement_version_id uuid references regulatory.requirement_versions(requirement_version_id) on delete restrict,
  state text not null check (state in ('DRAFT','REVIEW','APPROVED','RETIRED')),
  effective_from date not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code, revision),
  check (classification <> 'LEGAL_REQUIREMENT' or requirement_version_id is not null)
);

create table compliance.obligations (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  requirement_version_id uuid not null references regulatory.requirement_versions(requirement_version_id) on delete restrict,
  applicability_id uuid,
  scope_digest text not null,
  status text not null check (status in ('OPEN','SATISFIED','BLOCKED','RETIRED')),
  effective_from date not null,
  effective_to date,
  unique (tenant_id, id),
  unique (tenant_id, applicability_id, scope_digest),
  check (effective_to is null or effective_from < effective_to)
);

create table compliance.control_mappings (
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  control_id uuid not null,
  requirement_version_id uuid not null references regulatory.requirement_versions(requirement_version_id) on delete restrict,
  rationale text not null,
  source_ref text not null,
  primary key (tenant_id, control_id, requirement_version_id),
  foreign key (tenant_id, control_id) references compliance.controls(tenant_id, id) on delete restrict
);

create table compliance.obligation_controls (
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  obligation_id uuid not null,
  control_id uuid not null,
  valid_from date not null,
  valid_to date,
  primary key (tenant_id, obligation_id, control_id, valid_from),
  foreign key (tenant_id, obligation_id) references compliance.obligations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, control_id) references compliance.controls(tenant_id, id) on delete restrict,
  check (valid_to is null or valid_from < valid_to)
);

create table compliance.evidence_requirements (
  id uuid primary key default uuidv7(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  control_id uuid not null,
  code text not null,
  required_type text not null,
  freshness_days integer check (freshness_days is null or freshness_days > 0),
  sufficiency_criteria text not null,
  revision integer not null check (revision > 0),
  unique (tenant_id, control_id, code, revision),
  foreign key (tenant_id, control_id) references compliance.controls(tenant_id, id) on delete restrict
);

create index controls_requirement_idx on compliance.controls (requirement_version_id);
create index obligations_requirement_idx on compliance.obligations (requirement_version_id);
create index obligation_controls_control_idx on compliance.obligation_controls (tenant_id, control_id);

alter table compliance.controls enable row level security;
alter table compliance.controls force row level security;
alter table compliance.obligations enable row level security;
alter table compliance.obligations force row level security;
alter table compliance.control_mappings enable row level security;
alter table compliance.control_mappings force row level security;
alter table compliance.obligation_controls enable row level security;
alter table compliance.obligation_controls force row level security;
alter table compliance.evidence_requirements enable row level security;
alter table compliance.evidence_requirements force row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['controls','obligations','control_mappings','obligation_controls','evidence_requirements'] loop
    execute format('create policy %I on compliance.%I using (tenant_id = nullif(current_setting(''privy360.tenant_id'', true), '''')::uuid) with check (tenant_id = nullif(current_setting(''privy360.tenant_id'', true), '''')::uuid)', table_name || '_tenant_isolation', table_name);
  end loop;
end $$;
