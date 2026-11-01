/**
 * 교회 목록에서 켜고 끄는 태그입니다.
 * 주소로 태그를 만들지 않고, 사람이 수정 화면에서 켠 것만 저장합니다.
 */

export const CHURCH_TAG_GROUPS = [
  {
    label: "소속 / 성격",
    tags: ["초교파", "독립교회", "예장통합", "예장합동", "기독교대한감리회", "기독교한국침례회", "한국기독교장로회", "순복음", "성결교"],
  },
  {
    label: "예배 / 세대",
    tags: ["밴드찬양", "전통예배", "청년부", "청소년부", "어린이주일학교", "영유아부", "평일모임"],
  },
  {
    label: "통역 / 언어",
    tags: ["영어통역", "중국어통역", "다국어자막", "수어통역", "통역수신기"],
  },
  {
    label: "시설 / 접근성",
    tags: ["휠체어이동", "엘리베이터", "장애인화장실", "자모실", "전용주차장", "셔틀운행", "버스정류장인접"],
  },
] as const;

export type ChurchTag = (typeof CHURCH_TAG_GROUPS)[number]["tags"][number];

export const CHURCH_TAGS: readonly ChurchTag[] = CHURCH_TAG_GROUPS.flatMap((group) => [...group.tags]);

const KNOWN = new Set<string>(CHURCH_TAGS);

export function isChurchTag(value: string): value is ChurchTag {
  return KNOWN.has(value);
}

/** 목록에 있는 태그만 남기고 같은 태그는 한 번만 둡니다. */
export function normalizeChurchTags(values: readonly string[]): ChurchTag[] {
  const seen = new Set<string>();
  const tags: ChurchTag[] = [];
  for (const value of values) {
    const tag = value.trim();
    if (!isChurchTag(tag) || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/**
 * 같은 묶음에서 여러 개를 켜면 그 중 하나면 맞습니다.
 * 다른 묶음을 같이 켜면 묶음마다 맞아야 합니다.
 * 아무것도 안 켜면 모든 교회가 맞습니다.
 */
export function churchMatchesTags(tags: readonly string[], selected: ReadonlySet<string>): boolean {
  const active = CHURCH_TAG_GROUPS.map((group) => group.tags.filter((tag) => selected.has(tag))).filter((group) => group.length > 0);
  if (active.length === 0) return true;
  const have = new Set(tags);
  return active.every((group) => group.some((tag) => have.has(tag)));
}
