/**
 * 맵박스 주소 검색입니다.
 * 열쇠는 환경 변수에서만 읽고, 허용된 공개 주소만 출처로 붙입니다.
 * 열쇠 값과 요청 주소는 기록하지 않습니다.
 */

import { MAPBOX_ALLOWED_ORIGIN } from "@/map/origin";
import { parseMapboxGeocode, type MapPoint } from "@/map/rules";
import { MapServiceError } from "@/server/map/service";

function mapboxToken(): string {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  if (!token) throw new MapServiceError("지도 열쇠가 없습니다.");
  return token;
}

/** 주소 문자열을 맵박스가 돌려준 좌표로 바꿉니다. 결과가 없으면 null 입니다. */
export async function geocodeAddress(query: string): Promise<MapPoint | null> {
  const text = query.trim();
  if (!text) return null;
  if (text.length > 200) throw new MapServiceError("주소는 200자 안으로 적어 주세요.");
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json`);
  url.searchParams.set("limit", "1");
  url.searchParams.set("language", "ko");
  url.searchParams.set("access_token", mapboxToken());
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", Referer: MAPBOX_ALLOWED_ORIGIN },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new MapServiceError("지도 서비스를 부르지 못했습니다.");
  }
  if (!response.ok) throw new MapServiceError("지도 서비스를 부르지 못했습니다.");
  try {
    return parseMapboxGeocode(await response.json());
  } catch {
    throw new MapServiceError("지도 응답을 읽지 못했습니다.");
  }
}
