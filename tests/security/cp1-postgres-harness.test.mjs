import test from "node:test";
import assert from "node:assert/strict";
import {
  CP1_CASE_NAMES,
  MIGRATION_SEQUENCE,
  assertCp1Evidence,
  composeArguments,
  migrationExecutionSql,
  ownershipTransferSql,
} from "../../scripts/cp1-postgres-rls.mjs";

const validEvidence = () => ({
  schemaVersion: 1,
  checkpoint: "CP1",
  image: "cgr.dev/chainguard/postgres@sha256:" + "a".repeat(64),
  platform: "linux/amd64",
  admission: {
    service: "app-db",
    currentScan: true,
    eligible: true,
    highCriticalFindings: 0,
    configurationHash: "b".repeat(64),
    canonicalConfigurationHash: "c".repeat(64),
    configurationDelta: "app-db.environment.POSTGRES_USER",
  },
  bootstrapBoundary: {
    initializationRole: "privy360_cp1_bootstrap",
    migrationOwner: "privy360_migrator",
    runtimeRole: "privy360_app",
    databaseOwner: "privy360_migrator",
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
  cases: CP1_CASE_NAMES.map((name) => ({ name, passed: true })),
  cleanup: { containerRemoved: true, volumeRemoved: true },
});

test("CP1 harness starts only admitted PostgreSQL and destroys its volume", () => {
  assert.deepEqual(composeArguments("privy360-cp1-1234", "up"), [
    "compose",
    "--project-name",
    "privy360-cp1-1234",
    "-f",
    "-",
    "up",
    "--detach",
    "--wait",
    "--wait-timeout",
    "120",
    "app-db",
  ]);
  assert.deepEqual(composeArguments("privy360-cp1-1234", "down"), [
    "compose",
    "--project-name",
    "privy360-cp1-1234",
    "-f",
    "-",
    "down",
    "--volumes",
    "--remove-orphans",
  ]);
});

test("CP1 evidence requires the canonical migrations and every adversarial case", () => {
  assert.doesNotThrow(() => assertCp1Evidence(validEvidence()));

  const missingMigration = validEvidence();
  missingMigration.migrations.pop();
  assert.throws(() => assertCp1Evidence(missingMigration));

  const bypassRole = validEvidence();
  bypassRole.runtimeRole.bypassRls = true;
  assert.throws(() => assertCp1Evidence(bypassRole));

  const failedCase = validEvidence();
  failedCase.cases[0].passed = false;
  assert.throws(() => assertCp1Evidence(failedCase));

  const retainedVolume = validEvidence();
  retainedVolume.cleanup.volumeRemoved = false;
  assert.throws(() => assertCp1Evidence(retainedVolume));

  const changedBoundary = validEvidence();
  changedBoundary.bootstrapBoundary.runtimeRole = "privy360_cp1_bootstrap";
  assert.throws(() => assertCp1Evidence(changedBoundary));
});

test("CP1 privileged bootstrap applies canonical SQL then transfers ownership", () => {
  const migration = migrationExecutionSql("select 'canonical migration';");
  assert.match(migration, /^begin;/i);
  assert.doesNotMatch(migration, /set\s+(?:local\s+)?role/i);
  assert.match(migration, /select 'canonical migration';/i);
  assert.match(migration, /commit;$/i);

  const transfer = ownershipTransferSql("postgres");
  assert.match(transfer, /alter database privy360 owner to privy360_migrator/i);
  assert.match(transfer, /platform_audit/i);
  assert.match(transfer, /alter routine/i);
  assert.doesNotMatch(transfer, /reassign owned/i);
  assert.doesNotMatch(transfer, /privy360_app/i);
  assert.throws(() => ownershipTransferSql("postgres; drop database privy360"));
});
