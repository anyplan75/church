/**
 * 저장된 주소의 좌표를 읽습니다.
 * 상위 도로나 동네처럼 다른 장소의 검색 결과로는 핀을 옮기지 않습니다.
 */

import { addressGridToWgs } from "@/map/address-grid";
import { coordinatesWrittenInAddress, isSameSavedAddress, pickMatchingAddressPoint } from "@/map/address-point";
import { MAPBOX_ALLOWED_ORIGIN } from "@/map/origin";
import { parseMapboxGeocodeCandidates, type MapPoint } from "@/map/rules";

type AddressCandidate = { label: string; point: MapPoint };

function finiteNumber(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** 주소 표식에 적힌 좌표만 읽습니다. 제목이 저장된 주소와 다르면 버립니다. */
async function addressRecordCandidates(query: string): Promise<AddressCandidate[]> {
  const url = new URL("https://m.map.kakao.com/actions/searchView");
  url.searchParams.set("q", query);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];
  const html = await response.text();
  const found: AddressCandidate[] = [];
  for (const block of html.split("<li ")) {
    const label = block.match(/data-title="([^"]+)"/)?.[1] ?? "";
    const wx = finiteNumber(block.match(/data-wx="(-?\d+)"/)?.[1]);
    const wy = finiteNumber(block.match(/data-wy="(-?\d+)"/)?.[1]);
    if (!label || wx === null || wy === null || !isSameSavedAddress(query, label)) continue;
    const point = addressGridToWgs(wx, wy);
    if (!point) continue;
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
  const recorded = await addressRecordCandidates(text);
  const fromRecord = pickMatchingAddressPoint(text, recorded);
  if (fromRecord) return fromRecord;
  const mapbox = await mapboxAddressCandidates(text);
  return pickMatchingAddressPoint(text, mapbox);
}
