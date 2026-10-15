#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
const DB_NAME = process.env.DB_NAME || 'privy360';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

const client = new pg.Client({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
});

const migrationsDir = path.join(__dirname, 'migrations');

async function getMigrations() {
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files;
}

async function createMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

async function getExecutedMigrations() {
  const result = await client.query('SELECT name FROM migrations;');
  return new Set(result.rows.map((r) => r.name));
}

async function runMigration(filename) {
  const content = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
  console.log(`Running migration: ${filename}`);

  try {
    await client.query(content);
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [filename]);
    console.log(`✓ Migration completed: ${filename}`);
    return true;
  } catch (err) {
    console.error(`✗ Migration failed: ${filename}`);
    console.error(err.message);
    return false;
  }
}

async function main() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    await createMigrationsTable();
    const executed = await getExecutedMigrations();
    const migrations = await getMigrations();

    let hasChanges = false;
    for (const migration of migrations) {
      if (!executed.has(migration)) {
        const success = await runMigration(migration);
        if (!success) {
          console.error('Migration failed, stopping.');
          process.exit(1);
        }
        hasChanges = true;
      }
    }

    if (hasChanges) {
      console.log('\n✓ All migrations completed successfully');
    } else {
      console.log('\n✓ Database is up to date');
    }
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
