/**
 * 공개 웹이 오래 쉰 뒤에도 데이터베이스 접속이 바로 되게, 접속 문만 미리 엽니다.
 */

import { ensureDatabase, getPool } from "@/server/db/runtime";

export async function warmDatabase(): Promise<void> {
  await ensureDatabase();
  await getPool().query("SELECT 1");
}
