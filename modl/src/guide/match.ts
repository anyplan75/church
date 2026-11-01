/**
 * 메일 제목, 본문, 파일 이름, 보낸 사람으로 교회나 모들을 고릅니다.
 * 두 곳이 같이 맞거나 서로 다르면 맞추지 않습니다.
 */

export type GuidePlace = {
  kind: "church" | "gathering";
  id: string;
  communityId: string;
  name: string;
  creatorEmail: string | null;
};

export function compactGuideText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s_\-./]+/g, "");
}

function nameKeys(name: string): string[] {
  const full = compactGuideText(name);
  const keys: string[] = [];
  if (full.length >= 4) keys.push(full);
  const stem = full.replace(/(교회|성당|모들|모임)$/, "");
  if (stem.length >= 4 && stem !== full) keys.push(stem);
  return keys;
}

function longestNamed(text: string, places: readonly GuidePlace[]): GuidePlace | null {
  let bestLength = 0;
  let best: GuidePlace | null = null;
  let tied = false;
  for (const place of places) {
    const matched = nameKeys(place.name).filter((key) => text.includes(key));
    const length = matched.reduce((max, key) => Math.max(max, key.length), 0);
    if (length === 0) continue;
    if (length > bestLength) {
      bestLength = length;
      best = place;
      tied = false;
      continue;
    }
    if (length === bestLength && best && best.id !== place.id) tied = true;
  }
  if (tied) return null;
  return best;
}

function senderPlace(fromEmail: string, places: readonly GuidePlace[]): GuidePlace | null {
  const email = fromEmail.trim().toLowerCase();
  if (!email.includes("@")) return null;
  const found = places.filter((place) => place.creatorEmail?.trim().toLowerCase() === email);
  if (found.length !== 1) return null;
  return found[0] ?? null;
}

/** 한 곳으로만 떨어질 때 그 교회나 모들을 돌려줍니다. */
export function matchGuidePlace(input: {
  subject: string;
  body: string;
  fileName: string;
  fromEmail: string;
  places: readonly GuidePlace[];
}): GuidePlace | null {
  const text = compactGuideText(`${input.subject}\n${input.body}\n${input.fileName}`);
  const named = longestNamed(text, input.places);
  const sender = senderPlace(input.fromEmail, input.places);
  if (named && sender && named.id !== sender.id) return null;
  return named ?? sender;
}

/** 사이트 운영자는 못 맞춘 메일도 승인합니다. 담당은 맞춰진 곳만 승인합니다. */
export function canDecideGuide(input: { operator: boolean; creator: boolean; matched: boolean }): boolean {
  if (input.operator) return true;
  return input.matched && input.creator;
}
