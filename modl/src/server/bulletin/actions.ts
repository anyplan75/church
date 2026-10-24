"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { parseBlocks, type BulletinBlock } from "@/bulletin/blocks";
import { readableBulletinError, saveBulletin, saveBulletinWeek, unpublishBulletin } from "@/server/bulletin/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableBulletinError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function placeBack(kind: string, id: string): string {
  if ((kind === "church" || kind === "gathering") && id) return `/promo/${kind}/${id}/settings`;
  return "/bulletin/new";
}

export async function saveBulletinAction(formData: FormData) {
  const bulletinId = text(formData, "bulletinId");
  const intent = text(formData, "intent") === "publish" ? "publish" : "save";
  const placeKind = text(formData, "placeKind");
  const placeId = text(formData, "placeId");
  const back = bulletinId ? `/bulletin/${bulletinId}` : placeBack(placeKind, placeId);
  let blocksJson: unknown = [];
  try {
    blocksJson = JSON.parse(text(formData, "blocksJson") || "[]");
  } catch {
    fail(back, new Error("주보 블록을 읽지 못했습니다. 다시 저장해 주세요."));
  }
  const blocks = parseBlocks(blocksJson);
  if (!blocks.ok) fail(back, new Error(blocks.message));
  const parsed = z
    .object({
      worshipDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "예배 날짜를 골라 주세요."),
      sermonTitle: z.string().trim().min(1, "설교 제목을 적어 주세요.").max(200),
      scriptureText: z.string().max(500),
      preacher: z.string().max(120),
    })
    .safeParse({
      worshipDate: text(formData, "worshipDate"),
      sermonTitle: text(formData, "sermonTitle"),
      scriptureText: text(formData, "scriptureText"),
      preacher: text(formData, "preacher"),
    });
  if (!parsed.success || !blocks.ok) {
    fail(back, new Error(parsed.success ? "주보 내용을 확인해 주세요." : parsed.error.issues[0]?.message));
  }
  if (!parsed.success || !blocks.ok) return;
  let savedId = bulletinId;
  try {
    savedId = await saveBulletin({
      bulletinId: bulletinId || null,
      worshipDate: parsed.data.worshipDate,
      sermonTitle: parsed.data.sermonTitle,
      scriptureText: parsed.data.scriptureText,
      preacher: parsed.data.preacher,
      blocks: blocks.blocks,
      intent,
      placeKind,
      placeId,
    });
  } catch (error) {
    fail(back, error);
  }
  redirect(`/bulletin/${savedId}?ok=${intent === "publish" ? "published" : "saved"}`);
}

export async function saveBulletinWeekAction(formData: FormData) {
  let raw: unknown = [];
  try {
    raw = JSON.parse(text(formData, "weekJson") || "[]");
  } catch {
    fail(placeBack(text(formData, "placeKind"), text(formData, "placeId")), new Error("이번 주 예배를 읽지 못했습니다. 다시 읽어 주세요."));
  }
  const placeKind = text(formData, "placeKind");
  const placeId = text(formData, "placeId");
  if (!Array.isArray(raw) || raw.length === 0) {
    fail(placeBack(placeKind, placeId), new Error("저장할 예배가 없습니다."));
  }
  const services: Array<{
    label: string;
    time: string;
    worshipDate: string;
    sermonTitle: string;
    scriptureText: string;
    preacher: string;
    blocks: BulletinBlock[];
  }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") fail(placeBack(placeKind, placeId), new Error("이번 주 예배를 확인해 주세요."));
    const row = item as Record<string, unknown>;
    const parsed = z
      .object({
        label: z.string().trim().min(1, "예배 이름을 읽지 못했습니다.").max(80),
        time: z.string().regex(/^$|^\d{2}:\d{2}$/, "예배 시각을 확인하지 못했습니다."),
        worshipDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "예배 날짜를 주보에서 찾지 못했습니다."),
        sermonTitle: z.string().max(200),
        scriptureText: z.string().max(500),
        preacher: z.string().max(120),
      })
      .safeParse({
        label: typeof row.label === "string" ? row.label : "",
        time: typeof row.time === "string" ? row.time : "",
        worshipDate: typeof row.worshipDate === "string" ? row.worshipDate : "",
        sermonTitle: typeof row.sermonTitle === "string" ? row.sermonTitle : "",
        scriptureText: typeof row.scriptureText === "string" ? row.scriptureText : "",
        preacher: typeof row.preacher === "string" ? row.preacher : "",
      });
    if (!parsed.success) fail(placeBack(placeKind, placeId), new Error(parsed.error.issues[0]?.message ?? "이번 주 예배를 확인해 주세요."));
    const blocks = parseBlocks(row.blocks);
    if (!blocks.ok) fail(placeBack(placeKind, placeId), new Error(blocks.message));
    services.push({ ...parsed.data, blocks: blocks.blocks });
  }
  try {
    await saveBulletinWeek(services, { kind: placeKind, id: placeId });
  } catch (error) {
    fail(placeBack(placeKind, placeId), error);
  }
  redirect("/bulletin?ok=week");
}

export async function unpublishBulletinAction(formData: FormData) {
  const bulletinId = text(formData, "bulletinId");
  try {
    await unpublishBulletin(bulletinId);
  } catch (error) {
    fail(`/bulletin/${bulletinId}`, error);
  }
  redirect(`/bulletin/${bulletinId}?ok=unpublished`);
}
