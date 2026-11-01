import type { MapPoint } from "@/map/rules";

function compact(text: string): string {
  return text.replace(/\s+/g, "");
}

function hasWholeToken(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\d])${escaped}(?:$|[^\\d])`).test(text);
}

/** 주소에서 번길과 건물번호를 꺼냅니다. 상위 도로 이름만으로는 같은 주소가 아닙니다. */
export function addressMarks(text: string): { road: string | null; building: string | null } {
  const flat = compact(text);
  const road = flat.match(/(\d+번길)/)?.[1] ?? null;
  const hyphen = flat.match(/(\d+-\d+)(?!\d)/)?.[1] ?? null;
  if (hyphen) return { road, building: hyphen };
  const afterRoad = road ? (flat.split(road)[1] ?? "") : flat;
  const plain = afterRoad.match(/(\d+)(?!\d)/)?.[1] ?? null;
  return { road, building: plain };
}

/** 검색 결과가 저장된 주소와 같은 번길·건물번호인지 확인합니다. */
export function isSameSavedAddress(query: string, candidate: string): boolean {
  const wanted = addressMarks(query);
  if (!wanted.building && !wanted.road) return false;
  const flat = compact(candidate);
  if (wanted.building && !hasWholeToken(flat, wanted.building)) return false;
  if (wanted.road && !flat.includes(wanted.road)) return false;
  return true;
}

function asPoint(lat: number, lon: number): MapPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/**
 * 주소 글에 적힌 위도·경도만 읽습니다.
 * 번지나 우편번호처럼 소수점이 없는 숫자는 좌표로 보지 않습니다.
 */
export function coordinatesWrittenInAddress(text: string): MapPoint | null {
  const numbers = [...text.matchAll(/-?\d{1,3}\.\d{4,}/g)].map((match) => Number(match[0]));
  for (let index = 0; index < numbers.length - 1; index += 1) {
    const first = numbers[index];
    const second = numbers[index + 1];
    const ordered = asPoint(first, second) ?? asPoint(second, first);
    if (ordered) return ordered;
  }
  return null;
}

/** 같은 주소인 후보의 좌표만 고릅니다. 상위 도로나 동네 좌표는 고르지 않습니다. */
export function pickMatchingAddressPoint(query: string, candidates: readonly { label: string; point: MapPoint }[]): MapPoint | null {
  const written = coordinatesWrittenInAddress(query);
  if (written) return written;
  for (const candidate of candidates) {
    if (isSameSavedAddress(query, candidate.label)) return candidate.point;
  }
  return null;
}
