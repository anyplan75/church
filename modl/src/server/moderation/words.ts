/**
 * 금지어를 데이터베이스에 넣고 고치고 지웁니다.
 * 이 일은 사역자만 합니다. 목록을 고치는 저장은 내용 검사를 거치지 않습니다.
 */

import { asc } from "drizzle-orm";
import { parseBannedWordField } from "@/moderation/word-field";
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

/** 칸에 적힌 쉼표 목록으로 금지어를 바꿉니다. 칸이 비면 목록도 비우고, 다시 심지 않습니다. */
export async function saveBannedWordList(raw: string): Promise<void> {
  await requirePastor();
  const parsed = parseBannedWordField(raw);
  if (!parsed.ok) throw new BannedWordAdminError(parsed.message);
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      await tx.delete(bannedWords);
      if (parsed.words.length === 0) return;
      await tx.insert(bannedWords).values(parsed.words.map((word) => ({ word })));
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new BannedWordAdminError("같은 말이 겹칩니다.");
    throw error;
  }
}
