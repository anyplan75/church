/**
 * 데리러 가기 핀을 누가 보는지 정합니다.
 * 본인, 사역자, 임원만 봅니다.
 */

import type { MemberRole } from "@/server/auth/actor";

export function canSeePickupPin(input: {
  viewerUserId: string | null;
  viewerRole: MemberRole | null;
  pinUserId: string | null;
}): boolean {
  if (input.viewerRole === "PASTOR" || input.viewerRole === "EXECUTIVE") return true;
  return Boolean(input.viewerUserId && input.pinUserId && input.viewerUserId === input.pinUserId);
}
