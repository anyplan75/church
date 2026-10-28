/**
 * 데이터베이스 접속 문을 미리 열어 둡니다.
 * 호스팅 일정이 Authorization 표식을 보낼 때만 동작합니다.
 * 앱이 오래 쉬었다가 첫 화면만 느려지는 일을 줄입니다.
 */

import { warmDatabase } from "@/server/health/warm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const header = request.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  await warmDatabase();
  return Response.json({ ok: true, warm: true });
}
