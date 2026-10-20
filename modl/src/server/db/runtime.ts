/**
 * 데이터베이스 접속과 표 만들기를 한곳에서 엽니다.
 * 로컬에서는 .env 의 DATABASE_URL 만 읽습니다.
 * 앱 호스팅에서는 modl-comm Postgres 인스턴스 이름과 비밀번호 환경 변수를 읽습니다.
 * 비밀번호와 접속 문자열은 코드에 없습니다.
 * 이 파일을 불러도 바로 접속하지 않고, ensureDatabase 를 부를 때 접속합니다.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { dbSchema } from "@/server/db/schema";

const globalForDb = globalThis as unknown as {
  modlPool?: Pool;
  modlReady?: Promise<void>;
  modlOpening?: Promise<Pool>;
};

function usesCloudSql(): boolean {
  return Boolean(
    process.env.CLOUD_SQL_CONNECTION_NAME &&
      process.env.DB_USER &&
      process.env.DB_NAME &&
      process.env.DB_PASSWORD,
  );
}

function missingDatabaseMessage(): string {
  return "데이터베이스 설정이 없습니다. 로컬은 DATABASE_URL, 앱 호스팅은 프로젝트 Postgres 환경 변수를 채워 주세요.";
}

/** 앱이 켜질 때 접속 문을 미리 엽니다. 이미 열렸으면 같은 문을 돌려줍니다. */
export async function prepareDatabasePool(): Promise<Pool> {
  if (globalForDb.modlPool) return globalForDb.modlPool;
  if (!globalForDb.modlOpening) {
    globalForDb.modlOpening = openPool().catch((error: unknown) => {
      globalForDb.modlOpening = undefined;
      throw error;
    });
  }
  globalForDb.modlPool = await globalForDb.modlOpening;
  return globalForDb.modlPool;
}

async function openPool(): Promise<Pool> {
  if (usesCloudSql()) {
    const { AuthTypes, Connector, IpAddressTypes } = await import("@google-cloud/cloud-sql-connector");
    const connector = new Connector();
    const options = await connector.getOptions({
      instanceConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME as string,
      ipType: IpAddressTypes.PUBLIC,
      authType: AuthTypes.PASSWORD,
    });
    const config: PoolConfig = {
      ...options,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 5,
    };
    return new Pool(config);
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error(missingDatabaseMessage());
  return new Pool({ connectionString, max: 5 });
}

export function getPool(): Pool {
  if (globalForDb.modlPool) return globalForDb.modlPool;
  if (usesCloudSql()) {
    throw new Error("데이터베이스 준비가 끝나기 전에 접속을 열었습니다.");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error(missingDatabaseMessage());
  globalForDb.modlPool = new Pool({ connectionString, max: 5 });
  return globalForDb.modlPool;
}

export function getDb() {
  return drizzle(getPool(), { schema: dbSchema });
}

/** 아직 없는 표 만들기 명령만 순서대로 실행합니다. */
export async function ensureDatabase(): Promise<void> {
  if (!globalForDb.modlReady) {
    globalForDb.modlReady = (async () => {
      await prepareDatabasePool();
      await migrate();
    })().catch((error: unknown) => {
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
