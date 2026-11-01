/**
 * 글을 저장하기 전에 데이터베이스의 금지어를 확인합니다.
 * 단어 목록은 이 파일에 없습니다.
 */

import { findBannedWord } from "@/moderation/match";
import { bannedWords } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";

export class BannedWordError extends Error {
  constructor(word: string) {
    super(`이 글에는 서로 불편할 수 있는 말이 들어 있습니다. 「${word}」 이 말을 빼고 다시 저장해 주세요.`);
    this.name = "BannedWordError";
  }
}

function textLeaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean" || value == null) return [];
  if (value instanceof Date) return [];
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return [];
  if (value instanceof Uint8Array) return [];
  if (Array.isArray(value)) return value.flatMap(textLeaves);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(textLeaves);
  return [];
}

/** 넘긴 글에 금지어가 단어로 있으면 저장하지 않고 안내를 던집니다. */
export async function assertTextsAllowed(...values: unknown[]): Promise<void> {
  const texts = values.flatMap(textLeaves).filter((item) => item.trim().length > 0);
  if (texts.length === 0) return;
  await ensureDatabase();
  const rows = await getDb().select({ word: bannedWords.word }).from(bannedWords);
  if (rows.length === 0) return;
  const words = rows.map((row) => row.word);
  for (const text of texts) {
    const found = findBannedWord(text, words);
    if (found) throw new BannedWordError(found);
  }
}
