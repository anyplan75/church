/**
 * 데이터베이스 접속과 표 만들기를 한곳에서 엽니다.
 * 주소는 .env 의 DATABASE_URL 만 읽습니다. 비밀번호는 코드에 없습니다.
 * 이 파일을 불러도 바로 접속하지 않고, ensureDatabase 를 부를 때 접속합니다.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { dbSchema } from "@/server/db/schema";

const globalForDb = globalThis as unknown as {
  modlPool?: Pool;
  modlReady?: Promise<void>;
};

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 이 없습니다. .env.example 을 보고 .env 를 만들어 주세요.");
  }
  if (!globalForDb.modlPool) {
    globalForDb.modlPool = new Pool({ connectionString });
  }
  return globalForDb.modlPool;
}

export function getDb() {
  return drizzle(getPool(), { schema: dbSchema });
}

/** 아직 없는 표 만들기 명령만 순서대로 실행합니다. */
export async function ensureDatabase(): Promise<void> {
  if (!globalForDb.modlReady) {
    globalForDb.modlReady = migrate().catch((error: unknown) => {
      globalForDb.modlReady = undefined;
      throw error;
    });
  }
  await globalForDb.modlReady;
}

async function migrate(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const dir = path.join(process.cwd(), "src/server/db/migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const found = await pool.query("SELECT 1 FROM schema_migrations WHERE id = $1", [file]);
    if (found.rowCount) continue;
    const sqlText = readFileSync(path.join(dir, file), "utf8");
    await pool.query(sqlText);
    await pool.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
  }
}
