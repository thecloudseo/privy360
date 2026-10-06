import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import {
  cp1PostgresVerificationConfiguration,
  configurationHash,
  scopeLocalServiceConfiguration,
} from "./local-security-policy.mjs";
import {
  executionBindingMatches,
  localCredentials,
  redactConfig,
} from "./local-services.mjs";
import { mountedMaterial } from "./local-material.mjs";

const root = resolve(import.meta.dirname, "..");
const composeFile = resolve(root, "infra/docker/compose.yaml");
const imageFile = resolve(root, "infra/docker/security/images.json");
const evidenceFile = resolve(
  root,
  "specs/acceptance/CP1-postgresql-rls-evidence.json",
);

export const MIGRATION_SEQUENCE = Object.freeze([
  "0001_tenant_foundation.up.sql",
  "0002_audit_foundation.up.sql",
  "0003_regulatory_foundation.up.sql",
  "0004_audit_delivery.up.sql",
  "0005_regulatory_intake.up.sql",
]);

export const CP1_CASE_NAMES = Object.freeze([
  "missing_context_read",
  "missing_context_write_denied",
  "tenant_a_read_isolation",
  "tenant_a_write_allowed",
  "tenant_a_foreign_insert_denied",
  "tenant_a_update_isolation",
  "tenant_a_delete_isolation",
  "cross_tenant_fk_denied",
  "tenant_b_symmetry",
  "untrusted_tenant_filter_no_effect",
  "transaction_local_cleanup",
  "pooled_connection_reuse",
  "rollback_cleanup",
  "row_security_off_denied",
  "policy_change_denied",
  "rls_disable_denied",
  "ownership_change_denied",
  "self_grant_denied",
  "privilege_elevation_denied",
  "nested_context_mismatch",
]);

export function composeArguments(project, action) {
  const prefix = ["compose", "--project-name", project, "-f", "-"];
  if (action === "up")
    return [
      ...prefix,
      "up",
      "--detach",
      "--wait",
      "--wait-timeout",
      "120",
      "app-db",
    ];
  if (action === "down")
    return [...prefix, "down", "--volumes", "--remove-orphans"];
  throw new Error(`Unsupported CP1 Compose action: ${action}.`);
}

export function migrationExecutionSql(sql) {
  return `begin;\n${sql}\ncommit;`;
}

export function ownershipTransferSql(migrationExecutor) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(migrationExecutor))
    throw new Error("CP1 migration executor role is malformed.");
  return `alter database privy360 owner to privy360_migrator;
do $cp1$
declare
  owned_object record;
begin
  for owned_object in
    select n.nspname, c.relname, c.relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_roles r on r.oid = c.relowner
     where n.nspname in ('platform', 'tenant', 'audit', 'platform_audit', 'regulatory')
       and r.rolname = '${migrationExecutor}'
       and c.relkind in ('r', 'p', 'S', 'v', 'm', 'f')
  loop
    execute format(
      'alter %s %I.%I owner to privy360_migrator',
      case owned_object.relkind
        when 'S' then 'sequence'
        when 'v' then 'view'
        when 'm' then 'materialized view'
        when 'f' then 'foreign table'
        else 'table'
      end,
      owned_object.nspname,
      owned_object.relname
    );
  end loop;

  for owned_object in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_roles r on r.oid = p.proowner
     where n.nspname in ('platform', 'tenant', 'audit', 'platform_audit', 'regulatory')
       and r.rolname = '${migrationExecutor}'
  loop
    execute format(
      'alter routine %I.%I(%s) owner to privy360_migrator',
      owned_object.nspname,
      owned_object.proname,
      owned_object.arguments
    );
  end loop;

  for owned_object in
    select n.nspname
      from pg_namespace n
      join pg_roles r on r.oid = n.nspowner
     where n.nspname in ('platform', 'tenant', 'audit', 'platform_audit', 'regulatory')
       and r.rolname = '${migrationExecutor}'
  loop
    execute format(
      'alter schema %I owner to privy360_migrator',
      owned_object.nspname
    );
  end loop;
end
$cp1$;`;
}

export function assertCp1Evidence(evidence) {
  if (
    evidence?.schemaVersion !== 1 ||
    evidence.checkpoint !== "CP1" ||
    !/@sha256:[a-f0-9]{64}$/.test(evidence.image ?? "") ||
    evidence.platform !== "linux/amd64"
  )
    throw new Error("CP1 evidence identity is incomplete.");
  if (
    evidence.admission?.service !== "app-db" ||
    evidence.admission.currentScan !== true ||
    evidence.admission.eligible !== true ||
    evidence.admission.highCriticalFindings !== 0 ||
    evidence.admission.configurationDelta !==
      "app-db.environment.POSTGRES_USER" ||
    !/^[a-f0-9]{64}$/.test(evidence.admission.configurationHash ?? "") ||
    !/^[a-f0-9]{64}$/.test(evidence.admission.canonicalConfigurationHash ?? "")
  )
    throw new Error("CP1 PostgreSQL admission evidence is incomplete.");
  if (
    evidence.bootstrapBoundary?.initializationRole !==
      "privy360_cp1_bootstrap" ||
    evidence.bootstrapBoundary?.migrationOwner !== "privy360_migrator" ||
    evidence.bootstrapBoundary?.runtimeRole !== "privy360_app" ||
    evidence.bootstrapBoundary?.databaseOwner !== "privy360_migrator" ||
    evidence.bootstrapBoundary?.bootstrapOwnsApplicationObjects !== false
  )
    throw new Error("CP1 PostgreSQL role boundary evidence is incomplete.");
  if (
    JSON.stringify(evidence.migrations) !== JSON.stringify(MIGRATION_SEQUENCE)
  )
    throw new Error("CP1 migration sequence is incomplete or out of order.");
  const role = evidence.runtimeRole;
  if (
    role?.name !== "privy360_app" ||
    role.login !== true ||
    role.superuser !== false ||
    role.createRole !== false ||
    role.createDb !== false ||
    role.bypassRls !== false ||
    role.ownsProtectedTables !== false
  )
    throw new Error("CP1 runtime role is privileged or owns protected tables.");
  if (evidence.rls?.enabled !== true || evidence.rls?.forced !== true)
    throw new Error("CP1 FORCE RLS evidence is incomplete.");
  const cases = new Map(
    (evidence.cases ?? []).map((item) => [item.name, item.passed]),
  );
  if (
    cases.size !== CP1_CASE_NAMES.length ||
    CP1_CASE_NAMES.some((name) => cases.get(name) !== true)
  )
    throw new Error("CP1 adversarial evidence is incomplete.");
  if (
    evidence.cleanup?.containerRemoved !== true ||
    evidence.cleanup?.volumeRemoved !== true
  )
    throw new Error("CP1 disposable runtime cleanup is incomplete.");
}

function execute(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
    timeout: options.timeout ?? 180_000,
    env: { ...process.env, ...(options.env ?? {}) },
    input: options.input,
  });
  return result;
}

function requireSuccess(result, label, secrets = []) {
  if (!result.error && result.status === 0) return result.stdout;
  let detail =
    result.stderr?.trim() || result.error?.message || "unknown error";
  for (const secret of secrets)
    detail = detail.replaceAll(secret, "<redacted>");
  throw new Error(`${label} failed: ${detail.slice(-1000)}`);
}

function psql(containerId, role, sql, { denied = false } = {}) {
  const result = execute(
    "docker",
    [
      "exec",
      "-i",
      containerId,
      "psql",
      "-X",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "-U",
      role,
      "-d",
      "privy360",
    ],
    { input: sql, timeout: 30_000 },
  );
  if (denied) {
    if (result.status === 0)
      throw new Error("Expected PostgreSQL operation to be denied.");
    return "denied";
  }
  return requireSuccess(result, "PostgreSQL assertion").trim();
}

const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const registryA = "00000000-0000-4000-8000-000000000101";
const registryB = "00000000-0000-4000-8000-000000000201";
const linkA = "00000000-0000-4000-8000-000000000301";
const linkB = "00000000-0000-4000-8000-000000000401";

async function run() {
  const project = `privy360-cp1-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const credentials = await localCredentials();
  const reviewedImages = JSON.parse(await readFile(imageFile, "utf8")).images;
  const rendered = requireSuccess(
    execute(
      "docker",
      [
        "compose",
        "-f",
        composeFile,
        "--profile",
        "probe",
        "config",
        "--format",
        "json",
      ],
      { env: credentials },
    ),
    "Compose rendering",
    Object.values(credentials),
  );
  const fullConfig = JSON.parse(rendered);
  const executionScope = scopeLocalServiceConfiguration(
    fullConfig,
    reviewedImages,
    ["app-db"],
  );
  const redactedScope = scopeLocalServiceConfiguration(
    redactConfig(fullConfig, credentials),
    reviewedImages,
    ["app-db"],
  );
  const canonicalRedactedConfig = redactedScope.config;
  const executionConfig = cp1PostgresVerificationConfiguration(
    executionScope.config,
  );
  const verificationRedactedConfig = cp1PostgresVerificationConfiguration(
    canonicalRedactedConfig,
  );
  const mountHashes = await mountedMaterial(
    verificationRedactedConfig,
    resolve(root, "infra/docker"),
  );

  requireSuccess(
    execute(
      process.execPath,
      [
        resolve(root, "scripts/local-image-evidence.mjs"),
        "preflight",
        "--service",
        "app-db",
        "--cp1-postgres",
      ],
      { timeout: 30_000 },
    ),
    "PostgreSQL admission preflight",
  );
  const admissionOutput = requireSuccess(
    execute(
      process.execPath,
      [
        resolve(root, "scripts/local-image-evidence.mjs"),
        "collect-evaluate",
        "--service",
        "app-db",
        "--cp1-postgres",
      ],
      { timeout: 600_000 },
    ),
    "Current PostgreSQL admission",
  );
  const binding = admissionOutput.match(
    /LOCAL_ELIGIBILITY_BINDING=([a-f0-9]{64})/,
  )?.[1];
  if (
    !binding ||
    !admissionOutput.includes("LOCAL_ELIGIBILITY_SERVICES=app-db") ||
    !admissionOutput.includes("LOCAL_ELIGIBILITY_PROFILE=cp1-postgres") ||
    !admissionOutput.includes(": 0 High/Critical findings;") ||
    !executionBindingMatches(
      { configurationHash: binding },
      verificationRedactedConfig,
      mountHashes,
    )
  )
    throw new Error(
      "PostgreSQL admission did not bind the exact execution configuration.",
    );

  const configInput = JSON.stringify(executionConfig);
  let containerId;
  let evidence;
  let failure;
  const cases = [];
  const passed = (name) => cases.push({ name, passed: true });
  let cleanup;
  try {
    requireSuccess(
      execute("docker", composeArguments(project, "up"), {
        input: configInput,
        env: credentials,
        timeout: 150_000,
      }),
      "Disposable PostgreSQL startup",
      Object.values(credentials),
    );
    containerId = requireSuccess(
      execute("docker", [
        "ps",
        "--filter",
        `label=com.docker.compose.project=${project}`,
        "--filter",
        "label=com.docker.compose.service=app-db",
        "--format",
        "{{.ID}}",
      ]),
      "PostgreSQL container lookup",
    ).trim();
    if (!/^[a-f0-9]{12,64}$/.test(containerId))
      throw new Error("Expected exactly one disposable PostgreSQL container.");

    const bootstrapRole = "privy360_cp1_bootstrap";
    const migrationExecutor = psql(
      containerId,
      bootstrapRole,
      "select rolname from pg_roles where oid=10 and rolsuper and rolcanlogin;",
    );
    if (migrationExecutor !== bootstrapRole)
      throw new Error("PostgreSQL bootstrap migration role is unavailable.");

    for (const migration of MIGRATION_SEQUENCE) {
      const sql = await readFile(
        resolve(root, "packages/database/migrations", migration),
        "utf8",
      );
      psql(containerId, bootstrapRole, migrationExecutionSql(sql));
    }
    psql(containerId, bootstrapRole, ownershipTransferSql(bootstrapRole));
    const runtimePassword = randomBytes(24).toString("hex");
    psql(
      containerId,
      bootstrapRole,
      `alter role privy360_app login password '${runtimePassword}';`,
    );
    const fixture = await readFile(
      resolve(root, "tests/tenancy/fixtures/tenant-context.sql"),
      "utf8",
    );
    psql(
      containerId,
      bootstrapRole,
      `begin; set local role privy360_migrator;\n${fixture}\n` +
        "grant usage on schema tenant_test to privy360_app;\n" +
        "grant select, insert, update, delete on all tables in schema tenant_test to privy360_app;\n" +
        "commit;\n",
    );

    psql(
      containerId,
      bootstrapRole,
      `begin; set local role privy360_migrator;\n` +
        `insert into platform.tenants(id,slug,state) values ('${tenantA}','synthetic-a','ACTIVE'),('${tenantB}','synthetic-b','ACTIVE');\n` +
        `select set_config('privy360.tenant_id','${tenantA}',true);\n` +
        `select platform.provision_bootstrap_actor('${tenantA}');\n` +
        `insert into tenant.resource_registry(id,tenant_id,resource_type,resource_id,created_by,updated_by) select '${registryA}','${tenantA}','SYNTHETIC','00000000-0000-4000-8000-000000001101',id,id from tenant.actor_refs where tenant_id='${tenantA}' and actor_kind='BOOTSTRAP';\n` +
        `insert into tenant_test.resources(tenant_id,id) values ('${tenantA}','${registryA}');\n` +
        `insert into tenant_test.resource_links(tenant_id,id,resource_id) values ('${tenantA}','${linkA}','${registryA}');\n` +
        `select set_config('privy360.tenant_id','${tenantB}',true);\n` +
        `select platform.provision_bootstrap_actor('${tenantB}');\n` +
        `insert into tenant.resource_registry(id,tenant_id,resource_type,resource_id,created_by,updated_by) select '${registryB}','${tenantB}','SYNTHETIC','00000000-0000-4000-8000-000000001201',id,id from tenant.actor_refs where tenant_id='${tenantB}' and actor_kind='BOOTSTRAP';\n` +
        `insert into tenant_test.resources(tenant_id,id) values ('${tenantB}','${registryB}');\n` +
        `insert into tenant_test.resource_links(tenant_id,id,resource_id) values ('${tenantB}','${linkB}','${registryB}');\ncommit;\n`,
    );

    if (
      psql(
        containerId,
        "privy360_app",
        "select count(*) from tenant_test.resource_links;",
      ) !== "0"
    )
      throw new Error("Missing tenant context exposed rows.");
    passed("missing_context_read");
    psql(
      containerId,
      "privy360_app",
      `insert into tenant_test.resource_links(tenant_id,resource_id) values ('${tenantA}','${registryA}');`,
      { denied: true },
    );
    passed("missing_context_write_denied");

    const aRead = psql(
      containerId,
      "privy360_app",
      `begin; set local "privy360.tenant_id"='${tenantA}'; select count(*) filter (where tenant_id='${tenantA}') || '|' || count(*) filter (where tenant_id='${tenantB}') from tenant_test.resource_links; commit;`,
    );
    if (aRead !== "1|0") throw new Error("Tenant A read isolation failed.");
    passed("tenant_a_read_isolation");
    psql(
      containerId,
      "privy360_app",
      `begin; set local "privy360.tenant_id"='${tenantA}'; insert into tenant_test.resource_links(id,tenant_id,resource_id) values ('00000000-0000-4000-8000-000000000302','${tenantA}','${registryA}'); commit;`,
    );
    passed("tenant_a_write_allowed");
    psql(
      containerId,
      "privy360_app",
      `begin; set local "privy360.tenant_id"='${tenantA}'; insert into tenant_test.resource_links(tenant_id,resource_id) values ('${tenantB}','${registryB}'); commit;`,
      { denied: true },
    );
    passed("tenant_a_foreign_insert_denied");
    if (
      psql(
        containerId,
        "privy360_app",
        `begin; set local "privy360.tenant_id"='${tenantA}'; with changed as (update tenant_test.resource_links set resource_id='${registryB}' where id='${linkB}' returning 1) select count(*) from changed; commit;`,
      ) !== "0"
    )
      throw new Error("Tenant A updated Tenant B row.");
    passed("tenant_a_update_isolation");
    if (
      psql(
        containerId,
        "privy360_app",
        `begin; set local "privy360.tenant_id"='${tenantA}'; with changed as (delete from tenant_test.resource_links where id='${linkB}' returning 1) select count(*) from changed; commit;`,
      ) !== "0"
    )
      throw new Error("Tenant A deleted Tenant B row.");
    passed("tenant_a_delete_isolation");
    psql(
      containerId,
      "privy360_app",
      `begin; set local "privy360.tenant_id"='${tenantA}'; insert into tenant_test.resource_links(tenant_id,resource_id) values ('${tenantA}','${registryB}'); commit;`,
      { denied: true },
    );
    passed("cross_tenant_fk_denied");
    if (
      psql(
        containerId,
        "privy360_app",
        `begin; set local "privy360.tenant_id"='${tenantB}'; select count(*) filter (where tenant_id='${tenantB}') || '|' || count(*) filter (where tenant_id='${tenantA}') from tenant_test.resource_links; commit;`,
      ) !== "1|0"
    )
      throw new Error("Tenant B read isolation failed.");
    passed("tenant_b_symmetry");
    if (
      psql(
        containerId,
        "privy360_app",
        `select count(*) from tenant_test.resource_links where tenant_id='${tenantA}';`,
      ) !== "0"
    )
      throw new Error("Caller tenant filter influenced trusted context.");
    passed("untrusted_tenant_filter_no_effect");
    if (
      psql(
        containerId,
        "privy360_app",
        `begin; set local "privy360.tenant_id"='${tenantA}'; commit; select coalesce(nullif(current_setting('privy360.tenant_id',true),''),'unset'); select count(*) from tenant_test.resource_links;`,
      ) !== "unset\n0"
    )
      throw new Error("Transaction-local tenant context leaked after commit.");
    passed("transaction_local_cleanup");
    if (
      psql(
        containerId,
        "privy360_app",
        `begin; set local "privy360.tenant_id"='${tenantA}'; select count(*) from tenant_test.resource_links; commit; select count(*) from tenant_test.resource_links; begin; set local "privy360.tenant_id"='${tenantB}'; select count(*) from tenant_test.resource_links; commit;`,
      ) !== "2\n0\n1"
    )
      throw new Error("Pooled connection tenant context was retained.");
    passed("pooled_connection_reuse");
    if (
      psql(
        containerId,
        "privy360_app",
        `begin; set local "privy360.tenant_id"='${tenantA}'; rollback; select coalesce(nullif(current_setting('privy360.tenant_id',true),''),'unset'); select count(*) from tenant_test.resource_links;`,
      ) !== "unset\n0"
    )
      throw new Error("Rolled-back tenant context leaked.");
    passed("rollback_cleanup");

    for (const [name, sql] of [
      [
        "row_security_off_denied",
        "set row_security=off; select count(*) from tenant_test.resource_links;",
      ],
      [
        "policy_change_denied",
        "alter policy resource_links_tenant_isolation on tenant_test.resource_links using (true);",
      ],
      [
        "rls_disable_denied",
        "alter table tenant_test.resource_links disable row level security;",
      ],
      [
        "ownership_change_denied",
        "alter table tenant_test.resource_links owner to privy360_app;",
      ],
      ["self_grant_denied", "grant privy360_migrator to privy360_app;"],
      ["privilege_elevation_denied", "alter role privy360_app superuser;"],
    ]) {
      psql(containerId, "privy360_app", sql, { denied: true });
      passed(name);
    }
    const nested = execute(
      process.execPath,
      [
        "--test",
        "--test-name-pattern",
        "mismatched nested",
        "tests/tenancy/tenant-002.test.mjs",
      ],
      { timeout: 30_000 },
    );
    requireSuccess(nested, "TENANT-002 nested-context regression");
    passed("nested_context_mismatch");

    const roleState = psql(
      containerId,
      bootstrapRole,
      "select rolcanlogin || '|' || rolsuper || '|' || rolcreaterole || '|' || rolcreatedb || '|' || rolbypassrls from pg_roles where rolname='privy360_app';",
    );
    if (roleState !== "true|false|false|false|false")
      throw new Error(
        "Runtime application role retained privileged attributes.",
      );
    const ownership = psql(
      containerId,
      bootstrapRole,
      "select count(*) from pg_tables where schemaname in ('tenant','tenant_test','audit') and tableowner='privy360_app';",
    );
    if (ownership !== "0")
      throw new Error("Runtime role owns protected tables.");
    const databaseOwner = psql(
      containerId,
      bootstrapRole,
      "select pg_get_userbyid(datdba) from pg_database where datname='privy360';",
    );
    const bootstrapOwnedObjects = psql(
      containerId,
      bootstrapRole,
      `select
        (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_roles r on r.oid=c.relowner where n.nspname in ('platform','tenant','tenant_test','audit','platform_audit','regulatory') and r.rolname='${bootstrapRole}' and c.relkind in ('r','p','S','v','m','f'))
        + (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname in ('platform','tenant','tenant_test','audit','platform_audit','regulatory') and r.rolname='${bootstrapRole}')
        + (select count(*) from pg_namespace n join pg_roles r on r.oid=n.nspowner where n.nspname in ('platform','tenant','tenant_test','audit','platform_audit','regulatory') and r.rolname='${bootstrapRole}');`,
    );
    if (databaseOwner !== "privy360_migrator" || bootstrapOwnedObjects !== "0")
      throw new Error(
        "Privileged bootstrap retained ownership of Privy360 database objects.",
      );
    const rlsState = psql(
      containerId,
      bootstrapRole,
      "select bool_and(c.relrowsecurity) || '|' || bool_and(c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='tenant' or (n.nspname='tenant_test' and c.relname='resource_links')) and c.relkind='r';",
    );
    if (rlsState !== "true|true") throw new Error("FORCE RLS is incomplete.");

    evidence = {
      schemaVersion: 1,
      checkpoint: "CP1",
      executedAt: new Date().toISOString(),
      sourceCommit: requireSuccess(
        execute("git", ["rev-parse", "HEAD"]),
        "Git identity",
      ).trim(),
      image: reviewedImages["app-db"].image,
      platform: reviewedImages["app-db"].platform,
      admission: {
        service: "app-db",
        currentScan: true,
        eligible: true,
        highCriticalFindings: 0,
        configurationHash: binding,
        canonicalConfigurationHash: configurationHash(
          canonicalRedactedConfig,
          mountHashes,
        ),
        configurationDelta: "app-db.environment.POSTGRES_USER",
      },
      bootstrapBoundary: {
        initializationRole: bootstrapRole,
        migrationOwner: "privy360_migrator",
        runtimeRole: "privy360_app",
        databaseOwner,
        bootstrapOwnsApplicationObjects: false,
      },
      migrations: [...MIGRATION_SEQUENCE],
      runtimeRole: {
        name: "privy360_app",
        login: true,
        superuser: false,
        createRole: false,
        createDb: false,
        bypassRls: false,
        ownsProtectedTables: false,
      },
      rls: { enabled: true, forced: true },
      cases,
    };
  } catch (error) {
    failure = error;
  } finally {
    const down = execute("docker", composeArguments(project, "down"), {
      input: configInput,
      env: credentials,
      timeout: 120_000,
    });
    if (down.status !== 0 && !failure)
      failure = new Error("Disposable PostgreSQL cleanup failed.");
    const remainingContainers = execute("docker", [
      "ps",
      "-a",
      "--filter",
      `label=com.docker.compose.project=${project}`,
      "--format",
      "{{.ID}}",
    ]);
    const remainingVolumes = execute("docker", [
      "volume",
      "ls",
      "--filter",
      `label=com.docker.compose.project=${project}`,
      "--format",
      "{{.Name}}",
    ]);
    cleanup = {
      containerRemoved:
        remainingContainers.status === 0 && !remainingContainers.stdout.trim(),
      volumeRemoved:
        remainingVolumes.status === 0 && !remainingVolumes.stdout.trim(),
    };
  }
  if (failure) throw failure;
  evidence.cleanup = cleanup;
  assertCp1Evidence(evidence);
  await writeFile(evidenceFile, JSON.stringify(evidence, null, 2) + "\n");
  process.stdout.write(
    JSON.stringify({
      checkpoint: "CP1",
      image: evidence.image,
      admission: evidence.admission,
      migrations: evidence.migrations,
      runtimeRole: evidence.runtimeRole,
      rls: evidence.rls,
      cases: evidence.cases,
      cleanup: evidence.cleanup,
      evidenceFile: "specs/acceptance/CP1-postgresql-rls-evidence.json",
    }) + "\n",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
)
  run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
