/**
 * 금지어 칸을 쉼표로 나눕니다.
 * 비어 있는 조각은 버리고, 같은 말은 한 번만 남깁니다.
 * 실제 금지어 목록은 이 파일에 없습니다.
 */

import { normalizeBannedWord } from "@/moderation/match";

export function parseBannedWordField(raw: string): { ok: true; words: string[] } | { ok: false; message: string } {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const part of raw.split(/[,，]/)) {
    const word = normalizeBannedWord(part);
    if (!word) continue;
    if (word.length > 40) return { ok: false, message: "금지어는 40자 안으로 적어 주세요." };
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return { ok: true, words };
}
