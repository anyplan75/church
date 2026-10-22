/**
 * 금지어가 글 안에 단어로 들어왔는지 가르는 규칙입니다.
 * 단어 목록은 이 파일에 없습니다. 데이터베이스에서 읽어 넘깁니다.
 */

const LETTER = "0-9A-Za-z\\u1100-\\u11FF\\u3130-\\u318F\\uAC00-\\uD7A3";

/** 앞뒤 공백을 없애고, 가운데 공백은 한 칸으로 맞춥니다. */
export function normalizeBannedWord(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appearsAsWord(text: string, phrase: string): boolean {
  const parts = phrase.split(" ");
  if (parts.length === 0 || parts.some((part) => part.length === 0)) return false;
  const body = parts.map(escapeRegExp).join("\\s+");
  const pattern = new RegExp(`(?:^|[^${LETTER}])${body}(?=$|[^${LETTER}])`, "iu");
  return pattern.test(text);
}

/** 금지어가 단어이거나 띄어 쓴 말로 있으면 그 말을 돌려줍니다. 없으면 비웁니다. */
export function findBannedWord(text: string, words: readonly string[]): string | null {
  const haystack = text.normalize("NFC");
  const ordered = words
    .map((word) => normalizeBannedWord(word))
    .filter((word) => word.length > 0)
    .sort((left, right) => right.length - left.length);
  for (const word of ordered) {
    if (appearsAsWord(haystack, word)) return word;
  }
  return null;
}
