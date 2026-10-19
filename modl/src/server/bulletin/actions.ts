"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { parseBlocks } from "@/bulletin/blocks";
import { readableBulletinError, saveBulletin, unpublishBulletin } from "@/server/bulletin/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableBulletinError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveBulletinAction(formData: FormData) {
  const bulletinId = text(formData, "bulletinId");
  const intent = text(formData, "intent") === "publish" ? "publish" : "save";
  const back = bulletinId ? `/bulletin/${bulletinId}` : "/bulletin/new";
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
    });
  } catch (error) {
    fail(back, error);
  }
  redirect(`/bulletin/${savedId}?ok=${intent === "publish" ? "published" : "saved"}`);
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
