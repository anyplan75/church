/**
 * 주보 목록에서 이 사람이 볼 수 있는 줄만 고릅니다.
 * 다른 공동체 줄은 빼고, 날짜가 늦은 주보를 앞에 둡니다.
 */

import type { Actor } from "@/server/auth/actor";
import { can } from "@/server/auth/rbac";

export type BulletinListRow = {
  id: string;
  communityId: string;
  isPublic: boolean;
  worshipDate: string;
  sermonTitle: string;
};

export function bulletinsForActor(
  actor: Actor,
  communityId: string,
  rows: readonly BulletinListRow[],
): BulletinListRow[] {
  return rows
    .filter((row) => row.communityId === communityId)
    .filter((row) => can(actor, { type: "view_public_bulletin", communityId: row.communityId, isPublic: row.isPublic }))
    .slice()
    .sort((left, right) => {
      if (left.worshipDate === right.worshipDate) return left.id < right.id ? 1 : -1;
      return left.worshipDate < right.worshipDate ? 1 : -1;
    });
}

export function canPublishBulletin(actor: Actor, communityId: string): boolean {
  return can(actor, { type: "publish_bulletin", communityId });
}
