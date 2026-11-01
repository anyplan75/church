/**
 * 매일 아침 받은편지함의 새 안내를 승인 대기로 올립니다.
 * 호스팅 일정이 Authorization 표식을 보낼 때만 동작합니다.
 */

import { pullGuideMail } from "@/server/guide/inbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const header = request.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const result = await pullGuideMail();
  if (!result.ok) return Response.json({ ok: false, reason: result.reason });
  return Response.json({ ok: true, added: result.added });
}
