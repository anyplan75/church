/**
 * 저장된 주소의 좌표를 읽습니다.
 * 상위 도로나 동네처럼 다른 장소의 검색 결과로는 핀을 옮기지 않습니다.
 */

import { coordinatesWrittenInAddress, pickMatchingAddressPoint } from "@/map/address-point";
import { MAPBOX_ALLOWED_ORIGIN } from "@/map/origin";
import { parseMapboxGeocodeCandidates, type MapPoint } from "@/map/rules";

type AddressCandidate = { label: string; point: MapPoint };

function finitePoint(lat: number, lon: number): MapPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

async function kakaoAddressCandidates(query: string): Promise<AddressCandidate[]> {
  const key = process.env.KAKAO_REST_API_KEY?.trim() ?? "";
  if (!key) return [];
  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", "5");
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return [];
  }
  if (!payload || typeof payload !== "object") return [];
  const documents = (payload as { documents?: unknown }).documents;
  if (!Array.isArray(documents)) return [];
  const found: AddressCandidate[] = [];
  for (const document of documents) {
    if (!document || typeof document !== "object") continue;
    const record = document as {
      address_name?: unknown;
      x?: unknown;
      y?: unknown;
      road_address?: { address_name?: unknown; x?: unknown; y?: unknown } | null;
    };
    const road = record.road_address;
    const label = typeof road?.address_name === "string" ? road.address_name : typeof record.address_name === "string" ? record.address_name : "";
    const lon = Number(road?.x ?? record.x);
    const lat = Number(road?.y ?? record.y);
    const point = finitePoint(lat, lon);
    if (!label || !point) continue;
    found.push({ label, point });
  }
  return found;
}

async function mapboxAddressCandidates(query: string): Promise<AddressCandidate[]> {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  if (!token) return [];
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "ko");
  url.searchParams.set("country", "kr");
  url.searchParams.set("access_token", token);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", Referer: MAPBOX_ALLOWED_ORIGIN },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];
  try {
    return parseMapboxGeocodeCandidates(await response.json());
  } catch {
    return [];
  }
}

/** 주소 글 안의 좌표, 또는 그 주소와 같은 장소의 좌표만 돌려줍니다. */
export async function lookupAddressPoint(query: string): Promise<MapPoint | null> {
  const text = query.trim();
  if (!text) return null;
  const written = coordinatesWrittenInAddress(text);
  if (written) return written;
  const kakao = await kakaoAddressCandidates(text);
  const fromKakao = pickMatchingAddressPoint(text, kakao);
  if (fromKakao) return fromKakao;
  const mapbox = await mapboxAddressCandidates(text);
  return pickMatchingAddressPoint(text, mapbox);
}
