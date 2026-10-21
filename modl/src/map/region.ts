/**
 * 교회 지역입니다.
 * 통역 커뮤니티는 시/도(sido)와 시군구(district)로 지역을 나누고,
 * 지역 키는 둘을 붙인 값입니다. 모들 교회는 그 중 제주만 쓰고,
 * 시군구는 제주시와 서귀포시만 둡니다.
 * 주소에서 두 시 이름이 함께 보이거나 둘 다 없으면 지역을 비웁니다.
 */

export const JEJU_SIDO = "제주";
export const JEJU_CITIES = ["제주시", "서귀포시"] as const;
export type JejuCity = (typeof JEJU_CITIES)[number];

export type ChurchRegion = {
  sido: typeof JEJU_SIDO;
  district: JejuCity;
  regionId: string;
};

export function isJejuCity(value: string): value is JejuCity {
  return value === "제주시" || value === "서귀포시";
}

/** 통역 쪽 regionIdFrom("제주", 시 이름)과 같은 지역 키입니다. */
export function churchRegionFromDistrict(district: string): ChurchRegion | null {
  const city = district.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!isJejuCity(city)) return null;
  return { sido: JEJU_SIDO, district: city, regionId: `${JEJU_SIDO}-${city}` };
}

function hasSeogwipo(text: string): boolean {
  return text.includes("서귀포") || /seogwipo/i.test(text);
}

function hasJejuCity(text: string): boolean {
  return text.includes("제주시") || /jeju[\s-]*si/i.test(text);
}

/** 주소 글자만 봅니다. 좌표나 읍·면 이름으로 시를 만들지 않습니다. */
export function regionFromAddress(address: string): ChurchRegion | null {
  const text = address.normalize("NFC");
  const seogwipo = hasSeogwipo(text);
  const jeju = hasJejuCity(text);
  if (seogwipo === jeju) return null;
  return churchRegionFromDistrict(seogwipo ? "서귀포시" : "제주시");
}

/** 저장된 세 칸이 통역 지역 키와 같을 때만 시를 돌려줍니다. */
export function cityFromStored(sido: string | null, district: string | null, regionId: string | null): JejuCity | null {
  if (!district) return null;
  const region = churchRegionFromDistrict(district);
  if (!region) return null;
  if (sido !== region.sido || regionId !== region.regionId) return null;
  return region.district;
}
