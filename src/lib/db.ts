import pg from "pg";

// numeric → number, date → 'YYYY-MM-DD' string, time stays string.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const g = globalThis as unknown as { __scPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!g.__scPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    g.__scPool = new pg.Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 10) });
  }
  return g.__scPool;
}

export type Db = Pick<pg.PoolClient, "query">;

export async function q<T extends pg.QueryResultRow = any>(sql: string, params: unknown[] = [], db?: Db): Promise<T[]> {
  const r = await (db ?? pool()).query<T>(sql, params as any[]);
  return r.rows;
}

export async function one<T extends pg.QueryResultRow = any>(sql: string, params: unknown[] = [], db?: Db): Promise<T | null> {
  const rows = await q<T>(sql, params, db);
  return rows[0] ?? null;
}

/** Runs fn inside a transaction. Rolls back on any thrown error. */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export function pgCode(e: unknown): string | undefined {
  return (e as { code?: string })?.code;
}
