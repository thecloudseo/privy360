import pg from 'pg';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
const DB_NAME = process.env.DB_NAME || 'privy360';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Query with automatic RLS context setting
 * Per DATABASE_SPEC.md: RLS context must be set before any query
 */
export async function query(
  text: string,
  values: unknown[] = [],
  tenantId?: string
): Promise<pg.QueryResult> {
  const client = await getPool().connect();
  try {
    // Set RLS context if tenant_id provided
    if (tenantId) {
      await client.query(
        `SELECT set_config('app.tenant_id', $1, false)`,
        [tenantId]
      );
    }

    return await client.query(text, values);
  } finally {
    client.release();
  }
}

/**
 * Parameterized query execution (prevents SQL injection)
 * Per AGENTS.md §5: Only use parameterized queries
 */
export async function safeQuery(
  text: string,
  values: unknown[] = [],
  tenantId?: string
): Promise<pg.QueryResult> {
  return query(text, values, tenantId);
}
