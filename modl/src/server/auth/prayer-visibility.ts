/**
 * 기도 글을 누가 볼 수 있는지 순수하게 가립니다.
 * 데이터베이스에 접속하지 않습니다.
 *
 * 작성자 본인은 공개 범위와 상관없이 자기 글을 봅니다.
 * 익명이면 작성자가 아닌 사람에게 보내는 응답에서 작성자 번호를 뺍니다.
 */

import type { Actor, PrayerVisibility } from "@/server/auth/actor";
import { formalMembership, memberCoversGroup } from "@/server/auth/membership";

export type PrayerForFilter = {
  communityId: string;
  memberId: string;
  groupId: string | null;
  visibility: PrayerVisibility;
};

export type PrayerRecord = PrayerForFilter & {
  id: string;
  content: string;
  isAnonymous: boolean;
  prayTogetherCount: number;
  createdAt: string;
};

/** 화면이나 외부 응답에 내려도 되는 기도 글입니다. */
export type PrayerDto = {
  id: string;
  communityId: string;
  groupId: string | null;
  content: string;
  isAnonymous: boolean;
  visibility: PrayerVisibility;
  prayTogetherCount: number;
  createdAt: string;
  /** 익명이고 작성자가 아니면 null */
  authorMemberId: string | null;
};

function isAuthor(actor: Actor, prayer: PrayerForFilter): boolean {
  if (actor.kind !== "user") return false;
  return actor.memberships.some(
    (item) => item.communityId === prayer.communityId && item.memberId === prayer.memberId,
  );
}

/** 이 사람에게 이 기도 글이 보이는지 판단합니다. */
export function visiblePrayerFilter(actor: Actor, prayer: PrayerForFilter): boolean {
  if (isAuthor(actor, prayer)) return true;

  const membership = formalMembership(actor, prayer.communityId);
  if (!membership) return false;

  switch (prayer.visibility) {
    case "PUBLIC":
      return true;
    case "GROUP_ONLY":
      if (!prayer.groupId) return membership.role === "PASTOR";
      if (membership.role === "PASTOR") return true;
      if (membership.role === "CELL_LEADER" && memberCoversGroup(membership, prayer.groupId)) return true;
      return membership.currentGroupId === prayer.groupId;
    case "LEADER_ONLY":
      if (membership.role === "PASTOR") return true;
      if (!prayer.groupId) return false;
      return membership.role === "CELL_LEADER" && memberCoversGroup(membership, prayer.groupId);
    case "PASTOR_ONLY":
      return membership.role === "PASTOR";
    default: {
      const neverVisibility: never = prayer.visibility;
      return neverVisibility;
    }
  }
}

export function filterVisiblePrayers<T extends PrayerForFilter>(actor: Actor, prayers: readonly T[]): T[] {
  return prayers.filter((prayer) => visiblePrayerFilter(actor, prayer));
}

/**
 * 익명이면 작성자가 아닌 응답에서 작성자 번호를 제거합니다.
 * 작성자 본인에게는 자기 글임을 알 수 있게 번호를 남깁니다.
 */
export function toPrayerDto(prayer: PrayerRecord, actor: Actor): PrayerDto {
  const hideAuthor = prayer.isAnonymous && !isAuthor(actor, prayer);
  return {
    id: prayer.id,
    communityId: prayer.communityId,
    groupId: prayer.groupId,
    content: prayer.content,
    isAnonymous: prayer.isAnonymous,
    visibility: prayer.visibility,
    prayTogetherCount: prayer.prayTogetherCount,
    createdAt: prayer.createdAt,
    authorMemberId: hideAuthor ? null : prayer.memberId,
  };
}
