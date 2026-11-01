/**
 * 예배 화면과 언어별 자막 링크를 읽습니다.
 * 자막 주소는 담당자가 저장한 https 링크만 부릅니다.
 */

import { and, desc, eq } from "drizzle-orm";
import { parseBlocks, type BulletinBlock } from "@/bulletin/blocks";
import type { Actor } from "@/server/auth/actor";
import { formalMembership } from "@/server/auth/membership";
import { can } from "@/server/auth/rbac";
import { loadActor } from "@/server/auth/session";
import { bulletins, worshipCaptionLinks } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import {
  CAPTION_LANGUAGES,
  captionUrlError,
  isCaptionLanguage,
  linesFromCaptionBody,
  selectableCaptionLanguages,
  type CaptionLanguageCode,
} from "@/worship/caption-links";

export class WorshipFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorshipFlowError";
  }
}

function keepWorshipBlocks(blocks: readonly BulletinBlock[]): BulletinBlock[] {
  const next: BulletinBlock[] = [];
  for (const block of blocks) {
    if (block.type === "officers") continue;
    if (block.type !== "announcement") {
      next.push(block);
      continue;
    }
    const body = block.body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !/십일조|헌금|봉헌/.test(line))
      .join("\n");
    if (!body) continue;
    next.push({ id: block.id, type: "announcement", body });
  }
  return next;
}

function canEditCaptions(actor: Actor, communityId: string): boolean {
  return can(actor, { type: "publish_bulletin", communityId });
}

export async function loadWorshipPage(churchId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") return { ok: false as const, message: "예배를 보려면 먼저 들어가 주세요." };
  const membership = formalMembership(actor, churchId);
  if (!membership) return { ok: false as const, message: "이 교회의 예배를 볼 수 없습니다." };
  const db = getDb();
  const rows = await db.select().from(bulletins).where(eq(bulletins.communityId, churchId)).orderBy(desc(bulletins.worshipDate));
  const visible = rows.filter((row) => row.isPublic || membership.role === "PASTOR" || membership.role === "EXECUTIVE");
  const latestDate = visible[0]?.worshipDate ?? "";
  const services = visible
    .filter((row) => row.worshipDate === latestDate)
    .map((row) => {
      const parsed = parseBlocks(row.blocksJson);
      return {
        id: row.id,
        label: row.serviceLabel || "예배",
        time: row.serviceTime,
        worshipDate: row.worshipDate,
        sermonTitle: row.sermonTitle,
        scriptureText: row.scriptureText,
        preacher: row.preacher,
        blocks: keepWorshipBlocks(parsed.ok ? parsed.blocks : []),
      };
    });
  const links = await db.select().from(worshipCaptionLinks).where(eq(worshipCaptionLinks.communityId, churchId));
  const stored = links.map((row) => ({ code: row.languageCode, url: row.captionUrl }));
  return {
    ok: true as const,
    churchId,
    canEdit: canEditCaptions(actor, churchId),
    services,
    stored,
    choices: selectableCaptionLanguages(stored),
    languages: CAPTION_LANGUAGES,
  };
}

export async function saveCaptionLinks(communityId: string, entries: readonly { code: string; url: string }[]) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user" || !canEditCaptions(actor, communityId)) {
    throw new WorshipFlowError("자막 언어는 그 교회 담당자만 연결합니다.");
  }
  const next: { code: CaptionLanguageCode; url: string }[] = [];
  for (const entry of entries) {
    if (!isCaptionLanguage(entry.code)) throw new WorshipFlowError("알 수 없는 언어입니다.");
    const problem = captionUrlError(entry.url);
    if (problem) throw new WorshipFlowError(`${entry.code}: ${problem}`);
    const url = entry.url.trim();
    if (url) next.push({ code: entry.code, url });
  }
  const db = getDb();
  await db.delete(worshipCaptionLinks).where(eq(worshipCaptionLinks.communityId, communityId));
  if (next.length > 0) {
    await db.insert(worshipCaptionLinks).values(
      next.map((entry) => ({
        communityId,
        languageCode: entry.code,
        captionUrl: entry.url,
      })),
    );
  }
}

export async function readLinkedCaption(communityId: string, languageCode: string): Promise<{ lines: string[]; message: string }> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user" || !formalMembership(actor, communityId)) {
    return { lines: [], message: "이 교회 자막을 볼 수 없습니다." };
  }
  if (!isCaptionLanguage(languageCode)) return { lines: [], message: "그 언어는 고를 수 없습니다." };
  const [row] = await getDb()
    .select()
    .from(worshipCaptionLinks)
    .where(and(eq(worshipCaptionLinks.communityId, communityId), eq(worshipCaptionLinks.languageCode, languageCode)))
    .limit(1);
  if (!row || captionUrlError(row.captionUrl)) return { lines: [], message: "그 언어는 고를 수 없습니다." };
  try {
    const response = await fetch(row.captionUrl, {
      headers: { Accept: "application/json, text/plain" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok || captionUrlError(response.url)) return { lines: [], message: "자막을 아직 받지 못했습니다." };
    const body = (await response.text()).slice(0, 8000);
    const lines = linesFromCaptionBody(body, response.headers.get("content-type") ?? "");
    if (lines.length === 0) return { lines: [], message: "자막을 아직 받지 못했습니다." };
    return { lines, message: "" };
  } catch {
    return { lines: [], message: "자막을 아직 받지 못했습니다." };
  }
}
