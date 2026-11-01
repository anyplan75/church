/**
 * 데이터베이스 접속 문입니다.
 * 이 파일을 불러오는 것만으로는 접속하지 않습니다.
 * 주소는 비밀 파일 .env 의 DATABASE_URL 에서만 읽습니다. 코드에 비밀번호를 적지 마세요.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { dbSchema } from "@/server/db/schema";

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema: dbSchema });
}

export function createDbFromEnv() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 이 없습니다. .env.example 을 보고 .env 를 만들어 주세요.");
  }
  return createDb(connectionString);
}
