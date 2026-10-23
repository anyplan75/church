"use server";

/**
 * 주보 작성 화면의 글과 파일을 읽습니다.
 * 글을 읽지 못하면 파일만 저장하고 칸은 비워 둡니다.
 */

import { randomBytes } from "node:crypto";
import { servicesFromBulletinText, BULLETIN_UPLOAD_BYTES, type BulletinServiceDraft } from "@/bulletin/intake";
import { canPublishBulletin } from "@/server/bulletin/access";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { readBulletinImage } from "@/server/bulletin/read/image";
import { readBulletinFile } from "@/server/bulletin/read/files";
import { saveBulletinFile } from "@/server/bulletin/read/store";
import { assertTextsAllowed, BannedWordError } from "@/server/moderation/guard";

export type BulletinReadResult =
  | { ok: false; message: string }
  | { ok: true; filled: false; note: string; fileHref: string | null }
  | { ok: true; filled: true; note: string; fileHref: string | null; services: BulletinServiceDraft[] };

const EMPTY_NOTE = "파일을 저장했습니다. 글을 읽지 못해 칸은 비워 둡니다.";

export async function readBulletinSourceAction(formData: FormData): Promise<BulletinReadResult> {
  try {
    return await readBulletinSource(formData);
  } catch (error) {
    if (error instanceof BannedWordError) return { ok: false, message: error.message };
    return { ok: false, message: "주보를 읽지 못했습니다. 다시 눌러 주세요." };
  }
}

async function readBulletinSource(formData: FormData): Promise<BulletinReadResult> {
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId || !canPublishBulletin(actor, communityId)) {
    return { ok: false, message: "주보를 만들 수 있는 사람은 그 교회 담당자입니다." };
  }
  const pasted = typeof formData.get("text") === "string" ? String(formData.get("text")) : "";
  const file = formData.get("file");
  let extracted = "";
  let fileHref: string | null = null;
  let unread = false;
  if (file instanceof File && file.size > 0) {
    if (file.size > BULLETIN_UPLOAD_BYTES) {
      return { ok: false, message: "파일은 16MB 이하로 올려 주세요." };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      fileHref = await saveBulletinFile(file.name || "bulletin", bytes);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "파일을 저장하지 못했습니다." };
    }
    const read = await readBulletinFile(file.name || "bulletin", bytes, (data, ext) =>
      readBulletinImage(data, ext, process.env.QT_OCR_API_KEY ?? ""),
    );
    if (read.kind === "text") extracted = read.text;
    else unread = true;
  }
  const text = [pasted.trim(), extracted.trim()].filter(Boolean).join("\n");
  if (text) await assertTextsAllowed(text);
  if (!text) {
    if (fileHref) return { ok: true, filled: false, note: EMPTY_NOTE, fileHref };
    return { ok: false, message: "주보 내용을 붙여 넣거나 파일을 선택해 주세요." };
  }
  let serial = 0;
  const services = servicesFromBulletinText(text, () => `read-${randomBytes(4).toString("hex")}-${serial++}`);
  if (services.length === 0) {
    return {
      ok: true,
      filled: false,
      note: unread ? EMPTY_NOTE : "예배 순서를 찾지 못했습니다. 칸은 비워 둡니다.",
      fileHref,
    };
  }
  return {
    ok: true,
    filled: true,
    note: `주보에서 예배 ${services.length}개를 함께 읽었습니다.`,
    fileHref,
    services,
  };
}
