/**
 * 금지어를 데이터베이스에 넣고 고치고 지웁니다.
 * 이 일은 사역자만 합니다. 목록을 고치는 저장은 내용 검사를 거치지 않습니다.
 */

import { asc, eq } from "drizzle-orm";
import { normalizeBannedWord } from "@/moderation/match";
import { formalMembership } from "@/server/auth/membership";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { bannedWords } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";

export class BannedWordAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BannedWordAdminError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const current = error as { code?: unknown; cause?: unknown };
  if (current.code === "23505") return true;
  return isUniqueViolation(current.cause);
}

async function requirePastor(): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  const membership = communityId ? formalMembership(actor, communityId) : null;
  if (!membership || membership.role !== "PASTOR") {
    throw new BannedWordAdminError("금지어는 사역자만 고칩니다.");
  }
}

function cleanWord(raw: string): string {
  const word = normalizeBannedWord(raw);
  if (!word) throw new BannedWordAdminError("금지어를 적어 주세요.");
  if (word.length > 40) throw new BannedWordAdminError("금지어는 40자 안으로 적어 주세요.");
  return word;
}

export async function loadBannedWordsForEditor(): Promise<
  { ok: true; words: Array<{ id: string; word: string }> } | { ok: false; message: string }
> {
  try {
    await requirePastor();
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "금지어를 열지 못했습니다." };
  }
  const rows = await getDb()
    .select({ id: bannedWords.id, word: bannedWords.word })
    .from(bannedWords)
    .orderBy(asc(bannedWords.word));
  return { ok: true, words: rows };
}

export async function addBannedWord(raw: string): Promise<void> {
  await requirePastor();
  const word = cleanWord(raw);
  try {
    await getDb().insert(bannedWords).values({ word });
  } catch (error) {
    if (isUniqueViolation(error)) throw new BannedWordAdminError("이미 있는 말입니다.");
    throw error;
  }
}

export async function updateBannedWord(id: string, raw: string): Promise<void> {
  await requirePastor();
  const word = cleanWord(raw);
  try {
    const updated = await getDb()
      .update(bannedWords)
      .set({ word, updatedAt: new Date() })
      .where(eq(bannedWords.id, id))
      .returning({ id: bannedWords.id });
    if (updated.length === 0) throw new BannedWordAdminError("금지어를 찾지 못했습니다.");
  } catch (error) {
    if (error instanceof BannedWordAdminError) throw error;
    if (isUniqueViolation(error)) throw new BannedWordAdminError("이미 있는 말입니다.");
    throw error;
  }
}

export async function removeBannedWord(id: string): Promise<void> {
  await requirePastor();
  await getDb().delete(bannedWords).where(eq(bannedWords.id, id));
}
