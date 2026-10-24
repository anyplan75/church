"use server";

/**
 * 주보 작성 화면의 글과 파일을 읽습니다.
 * 글을 읽지 못하면 파일만 저장하고 칸은 비워 둡니다.
 * 큰 파일은 배포 서버가 거절하기 전에 조각으로 받아 같은 읽기로 이어 붙입니다.
 */

import { randomBytes } from "node:crypto";
import { servicesFromBulletinText, BULLETIN_PART_BYTES, BULLETIN_UPLOAD_BYTES, type BulletinServiceDraft } from "@/bulletin/intake";
import { eq } from "drizzle-orm";
import { canPublishBulletin } from "@/server/bulletin/access";
import type { Actor } from "@/server/auth/actor";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { readBulletinImage } from "@/server/bulletin/read/image";
import { readBulletinFile } from "@/server/bulletin/read/files";
import { resolveBulletinExtension, saveBulletinFile } from "@/server/bulletin/read/store";
import { mapChurches, smallGroups } from "@/server/db/schema";
import { ensureDatabase, getDb, getPool } from "@/server/db/runtime";
import { assertTextsAllowed, BannedWordError } from "@/server/moderation/guard";

export type BulletinReadResult =
  | { ok: false; message: string }
  | { ok: true; filled: false; note: string; fileHref: string | null }
  | { ok: true; filled: true; note: string; fileHref: string | null; services: BulletinServiceDraft[] };

type PartStored = { ok: true } | { ok: false; message: string };

const EMPTY_NOTE = "파일을 저장했습니다. 글을 읽지 못해 칸은 비워 둡니다.";
const READ_FAILED = "주보를 읽지 못했습니다. 다시 눌러 주세요.";
const MAX_PARTS = Math.ceil(BULLETIN_UPLOAD_BYTES / BULLETIN_PART_BYTES);
const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readFailureMessage(error: unknown): string {
  if (!(error instanceof Error)) return READ_FAILED;
  const message = error.message.trim();
  if (!message || message.length > 180 || /[/\\]/.test(message)) return READ_FAILED;
  return message;
}

function wholeNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function uploadName(value: FormDataEntryValue | null): string {
  const name = typeof value === "string" ? value.trim() : "";
  return (name || "bulletin").slice(0, 240);
}

async function publisher(formData: FormData): Promise<{ userId: string } | { message: string }> {
  const actor = await loadActor();
  const userId = userIdOf(actor);
  const kind = formData.get("placeKind");
  const id = formData.get("placeId");
  if ((kind === "church" || kind === "gathering") && typeof id === "string" && id) {
    if (!(await managesPlace(userId, kind, id))) {
      return { message: "안내는 그 교회나 모들 관리자가 설정에서 만듭니다." };
    }
    return { userId };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId || !canPublishBulletin(actor, communityId)) {
    return { message: "안내는 그 교회나 모들 관리자가 설정에서 만듭니다." };
  }
  return { userId };
}

async function managesPlace(userId: string, kind: "church" | "gathering", id: string): Promise<boolean> {
  if (!userId) return false;
  await ensureDatabase();
  const db = getDb();
  if (kind === "church") {
    const [row] = await db.select({ createdByUserId: mapChurches.createdByUserId }).from(mapChurches).where(eq(mapChurches.id, id)).limit(1);
    return row?.createdByUserId === userId;
  }
  const [row] = await db.select({ createdByUserId: smallGroups.createdByUserId }).from(smallGroups).where(eq(smallGroups.id, id)).limit(1);
  return row?.createdByUserId === userId;
}

function userIdOf(actor: Actor): string {
  if (actor.kind !== "user") return "";
  return actor.userId;
}

export async function readBulletinSourceAction(formData: FormData): Promise<BulletinReadResult> {
  try {
    return await readBulletinSource(formData);
  } catch (error) {
    if (error instanceof BannedWordError) return { ok: false, message: error.message };
    return { ok: false, message: readFailureMessage(error) };
  }
}

async function readBulletinSource(formData: FormData): Promise<BulletinReadResult> {
  const allowed = await publisher(formData);
  if ("message" in allowed) return { ok: false, message: allowed.message };
  const pasted = typeof formData.get("text") === "string" ? String(formData.get("text")) : "";
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > BULLETIN_UPLOAD_BYTES) {
      return { ok: false, message: "파일은 30MB 이하로 올려 주세요." };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    return interpretBulletin(file.name || "bulletin", bytes, pasted);
  }
  return interpretBulletin("", Buffer.alloc(0), pasted);
}

/** 큰 한글 파일의 한 조각입니다. 마지막 조각 다음 finishBulletinUploadAction 이 이어 붙입니다. */
export async function storeBulletinPartAction(formData: FormData): Promise<PartStored> {
  try {
    const allowed = await publisher(formData);
    if ("message" in allowed) return { ok: false, message: allowed.message };
    const uploadId = typeof formData.get("uploadId") === "string" ? String(formData.get("uploadId")) : "";
    const index = wholeNumber(formData.get("index"));
    const count = wholeNumber(formData.get("count"));
    const part = formData.get("part");
    if (!UPLOAD_ID.test(uploadId) || index === null || count === null) return { ok: false, message: READ_FAILED };
    if (count < 2 || count > MAX_PARTS || index < 0 || index >= count) return { ok: false, message: READ_FAILED };
    if (!(part instanceof File) || part.size === 0 || part.size > BULLETIN_PART_BYTES) return { ok: false, message: READ_FAILED };
    const bytes = Buffer.from(await part.arrayBuffer());
    const pool = getPool();
    await pool.query(`DELETE FROM bulletin_upload_parts WHERE created_at < now() - interval '2 hours'`);
    await pool.query(
      `INSERT INTO bulletin_upload_parts (upload_id, user_id, part_index, part_count, file_name, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (upload_id, user_id, part_index)
       DO UPDATE SET payload = EXCLUDED.payload, part_count = EXCLUDED.part_count, file_name = EXCLUDED.file_name, created_at = now()`,
      [uploadId, allowed.userId, index, count, uploadName(formData.get("name")), bytes],
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, message: readFailureMessage(error) };
  }
}

/** 나뉜 조각을 한 파일로 이어 은혜로운 예배와 같은 읽기를 탑니다. */
export async function finishBulletinUploadAction(formData: FormData): Promise<BulletinReadResult> {
  try {
    const allowed = await publisher(formData);
    if ("message" in allowed) return { ok: false, message: allowed.message };
    const uploadId = typeof formData.get("uploadId") === "string" ? String(formData.get("uploadId")) : "";
    const count = wholeNumber(formData.get("count"));
    if (!UPLOAD_ID.test(uploadId) || count === null || count < 2 || count > MAX_PARTS) {
      return { ok: false, message: READ_FAILED };
    }
    const pasted = typeof formData.get("text") === "string" ? String(formData.get("text")) : "";
    const pool = getPool();
    const found = await pool.query<{ part_index: number; file_name: string; payload: unknown }>(
      `SELECT part_index, file_name, payload
       FROM bulletin_upload_parts
       WHERE upload_id = $1 AND user_id = $2
       ORDER BY part_index`,
      [uploadId, allowed.userId],
    );
    await pool.query(`DELETE FROM bulletin_upload_parts WHERE upload_id = $1 AND user_id = $2`, [uploadId, allowed.userId]);
    const rows = found.rows;
    if (rows.length !== count) return { ok: false, message: READ_FAILED };
    const pieces: Buffer[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row || Number(row.part_index) !== index) return { ok: false, message: READ_FAILED };
      pieces.push(payloadBytes(row.payload));
    }
    const bytes = Buffer.concat(pieces);
    if (bytes.length === 0 || bytes.length > BULLETIN_UPLOAD_BYTES) {
      return { ok: false, message: "파일은 30MB 이하로 올려 주세요." };
    }
    const sentName = typeof formData.get("name") === "string" ? String(formData.get("name")).trim() : "";
    const name = (sentName || rows[0]?.file_name || "bulletin").slice(0, 240);
    return interpretBulletin(name, bytes, pasted);
  } catch (error) {
    if (error instanceof BannedWordError) return { ok: false, message: error.message };
    return { ok: false, message: readFailureMessage(error) };
  }
}

function payloadBytes(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    const hex = value.startsWith("\\x") ? value.slice(2) : value;
    return Buffer.from(hex, "hex");
  }
  throw new Error(READ_FAILED);
}

async function interpretBulletin(name: string, bytes: Buffer, pasted: string): Promise<BulletinReadResult> {
  let extracted = "";
  let fileHref: string | null = null;
  let unread = false;
  if (bytes.length > 0) {
    if (!resolveBulletinExtension(name, bytes)) {
      return { ok: false, message: "텍스트, 워드, 한글, PDF, RTF, ODT, HTML, 사진만 올릴 수 있습니다." };
    }
    try {
      fileHref = await saveBulletinFile(name, bytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "파일을 저장하지 못했습니다.";
      if (message.includes("30MB") || message.includes("골라 주세요") || message.includes("올릴 수 있습니다")) {
        return { ok: false, message };
      }
      fileHref = null;
    }
    const read = await readBulletinFile(name, bytes, (data) => readBulletinImage(data));
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
