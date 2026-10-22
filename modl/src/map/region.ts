/**
 * 교회 지역입니다.
 * 통역 커뮤니티는 시/도(sido)와 시군구(district)로 지역을 나누고,
 * 지역 키는 둘을 붙인 값입니다. 모들 교회는 그 중 제주만 쓰고,
 * 시군구는 제주시와 서귀포시만 둡니다.
 * 주소의 한글·영문 지명으로 시를 가립니다.
 * 서귀포 지명이 있으면 서귀포시이고, 그 주소에 제주만 더 있어도 서귀포시입니다.
 * 제주시 읍·면·동이나, 서귀포가 아닌 제주/Jeju 는 제주시입니다.
 * 두 시 지명이 함께 있거나 지명을 못 읽으면 비웁니다.
 */

export const JEJU_SIDO = "제주";
export const JEJU_CITIES = ["제주시", "서귀포시"] as const;
export type JejuCity = (typeof JEJU_CITIES)[number];

export type ChurchRegion = {
  sido: typeof JEJU_SIDO;
  district: JejuCity;
  regionId: string;
};

/** 서귀포시로 읽는 지명입니다. */
const SEOGWIPO_KO = ["서귀포", "남원", "표선", "성산", "안덕", "대정", "중문", "예래", "대포", "법환", "서호", "색달"] as const;
const SEOGWIPO_EN = ["seogwipo", "namwon", "pyoseon", "seongsan", "andeok", "daejeong", "jungmun"] as const;

/** 제주시로 읽는 읍·면·동과 시 이름입니다. 짧은 영문은 단어로만 맞춥니다. */
const JEJU_KO = [
  "제주시",
  "조천",
  "애월",
  "한림",
  "한경",
  "구좌",
  "추자",
  "우도",
  "이도",
  "연동",
  "노형",
  "아라",
  "오라",
  "화북",
  "삼양",
  "봉개",
  "외도",
  "이호",
  "도두",
  "용담",
  "건입",
  "삼도",
  "일도",
] as const;
const JEJU_EN = ["jocheon", "aewol", "hallim", "hanrim", "hangyeong", "gujwa", "ido", "oedo", "samyang", "hwabuk", "ora", "yongdam", "bonggae"] as const;

export function isJejuCity(value: string): value is JejuCity {
  return value === "제주시" || value === "서귀포시";
}

/** 통역 쪽 regionIdFrom("제주", 시 이름)과 같은 지역 키입니다. */
export function churchRegionFromDistrict(district: string): ChurchRegion | null {
  const city = district.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!isJejuCity(city)) return null;
  return { sido: JEJU_SIDO, district: city, regionId: `${JEJU_SIDO}-${city}` };
}

function hasKorean(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function hasEnglish(text: string, words: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => new RegExp(`(?:^|[^a-z])${word}`).test(lower));
}

function hasSeogwipo(text: string): boolean {
  return hasKorean(text, SEOGWIPO_KO) || hasEnglish(text, SEOGWIPO_EN);
}

function hasJejuTown(text: string): boolean {
  return hasKorean(text, JEJU_KO) || hasEnglish(text, JEJU_EN) || /jeju[\s-]*si/i.test(text);
}

function hasJejuIsland(text: string): boolean {
  return text.includes("제주") || /(?:^|[^a-z])jeju(?:[^a-z]|$)/i.test(text);
}

/** 주소 글자만 봅니다. 좌표로 시를 만들지 않습니다. */
export function regionFromAddress(address: string): ChurchRegion | null {
  const text = address.normalize("NFC");
  const seogwipo = hasSeogwipo(text);
  const jejuTown = hasJejuTown(text);
  if (seogwipo && jejuTown) return null;
  if (seogwipo) return churchRegionFromDistrict("서귀포시");
  if (jejuTown || hasJejuIsland(text)) return churchRegionFromDistrict("제주시");
  return null;
}

/** 저장된 세 칸이 통역 지역 키와 같을 때만 시를 돌려줍니다. */
export function cityFromStored(sido: string | null, district: string | null, regionId: string | null): JejuCity | null {
  if (!district) return null;
  const region = churchRegionFromDistrict(district);
  if (!region) return null;
  if (sido !== region.sido || regionId !== region.regionId) return null;
  return region.district;
}
