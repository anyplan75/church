/**
 * 주보를 저장할 때 그 교회 일정을 다시 맞춥니다.
 * 같은 주보로 만든 예전 일정은 지우고, 예배와 광고 일정만 다시 넣습니다.
 */

import { eq } from "drizzle-orm";
import type { BulletinBlock } from "@/bulletin/blocks";
import { schedulesFromBulletin } from "@/calendar/bulletin-schedule";
import { calendarEvents } from "@/server/db/schema";
import { getDb } from "@/server/db/runtime";

type ScheduleWriter = Pick<ReturnType<typeof getDb>, "delete" | "insert">;

export async function replaceBulletinSchedule(
  communityId: string,
  bulletinId: string,
  source: {
    label: string;
    time: string;
    worshipDate: string;
    sermonTitle: string;
    blocks: readonly BulletinBlock[];
  },
  writer?: ScheduleWriter,
) {
  const db = writer ?? getDb();
  const announcements = source.blocks
    .flatMap((block) => (block.type === "announcement" ? [block.body] : []))
    .join("\n");
  const drafts = schedulesFromBulletin({
    label: source.label,
    time: source.time,
    worshipDate: source.worshipDate,
    sermonTitle: source.sermonTitle,
    announcements,
  });
  await db.delete(calendarEvents).where(eq(calendarEvents.bulletinId, bulletinId));
  if (drafts.length === 0) return;
  await db.insert(calendarEvents).values(
    drafts.map((draft) => ({
      communityId,
      bulletinId,
      sourceKey: draft.sourceKey,
      title: draft.title,
      startAt: draft.startAt,
      endAt: draft.endAt,
      category: "EVENT" as const,
      isLeaderOnly: false,
    })),
  );
}
