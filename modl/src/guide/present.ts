/**
 * 저장된 안내 초안에서 화면에 보일 예배와 광고를 고릅니다.
 */

import { parseBlocks } from "@/bulletin/blocks";
import type { BulletinServiceDraft } from "@/bulletin/intake";

export function servicesFromJson(value: unknown): BulletinServiceDraft[] {
  if (!Array.isArray(value)) return [];
  const services: BulletinServiceDraft[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const worshipDate = typeof row.worshipDate === "string" ? row.worshipDate : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(worshipDate)) continue;
    const blocks = parseBlocks(row.blocks);
    if (!blocks.ok) continue;
    services.push({
      label: typeof row.label === "string" ? row.label : "",
      time: typeof row.time === "string" ? row.time : "",
      worshipDate,
      sermonTitle: typeof row.sermonTitle === "string" ? row.sermonTitle : "",
      scriptureText: typeof row.scriptureText === "string" ? row.scriptureText : "",
      preacher: typeof row.preacher === "string" ? row.preacher : "",
      blocks: blocks.blocks,
    });
  }
  return services;
}

export function guideNews(services: readonly BulletinServiceDraft[]): string {
  const bodies = services.flatMap((service) =>
    service.blocks.flatMap((block) => (block.type === "announcement" && block.body.trim() ? [block.body.trim()] : [])),
  );
  return [...new Set(bodies)].join("\n");
}

/** 1부와 2부가 있으면 그 예배만 미리 보여 줍니다. */
export function guidePreviewLines(services: readonly BulletinServiceDraft[]): BulletinServiceDraft[] {
  const parts = services.filter((service) => /1부|2부/.test(service.label));
  return parts.length > 0 ? parts : services.slice(0, 3);
}
