/**
 * 키 없이 열리는 공개 지도 서비스만 부릅니다.
 * 응답에 없는 장소나 길은 만들지 않습니다.
 */

import {
  parseMatch,
  parseNearest,
  parsePlaces,
  parseRoute,
  type MapPoint,
  type PlaceHit,
  type RouteResult,
  type SnapResult,
} from "@/map/rules";

const USER_AGENT = "modl-map/1.0 (community map)";

export class MapServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapServiceError";
  }
}

function assertPoint(point: MapPoint): void {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
    throw new MapServiceError("위치 숫자가 올바르지 않습니다.");
  }
  if (point.lat < -90 || point.lat > 90 || point.lon < -180 || point.lon > 180) {
    throw new MapServiceError("위치 숫자가 올바르지 않습니다.");
  }
}

async function readJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new MapServiceError("지도 서비스를 부르지 못했습니다.");
  }
  if (!response.ok) throw new MapServiceError("지도 서비스를 부르지 못했습니다.");
  try {
    return await response.json();
  } catch {
    throw new MapServiceError("지도 응답을 읽지 못했습니다.");
  }
}

/** 식당과 숙소 주소를 공개 주소 검색으로 찾습니다. */
export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const text = query.trim();
  if (!text) throw new MapServiceError("주소를 적어 주세요.");
  if (text.length > 120) throw new MapServiceError("주소는 120자 안으로 적어 주세요.");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "10");
  url.searchParams.set("accept-language", "ko");
  url.searchParams.set("layer", "poi");
  url.searchParams.set("q", text);
  const payload = await readJson(url.toString());
  return parsePlaces(payload);
}

function coordPath(points: MapPoint[]): string {
  return points.map((point) => `${point.lon},${point.lat}`).join(";");
}

/** 흔들리는 점을 가까운 길 위에 붙입니다. */
export async function snapToRoad(points: MapPoint[]): Promise<SnapResult> {
  if (points.length === 0) throw new MapServiceError("붙일 점을 먼저 찍어 주세요.");
  if (points.length > 20) throw new MapServiceError("점은 20개까지 붙입니다.");
  for (const point of points) assertPoint(point);
  if (points.length === 1) {
    const payload = await readJson(
      `https://router.project-osrm.org/nearest/v1/driving/${coordPath(points)}?number=1`,
    );
    const snapped = parseNearest(payload);
    if (!snapped) throw new MapServiceError("가까운 길을 찾지 못했습니다.");
    return { snapped: [snapped], line: [] };
  }
  const payload = await readJson(
    `https://router.project-osrm.org/match/v1/driving/${coordPath(points)}?overview=full&geometries=geojson&gaps=ignore&tidy=true`,
  );
  const snap = parseMatch(payload);
  if (!snap) throw new MapServiceError("가까운 길을 찾지 못했습니다.");
  return snap;
}

/** 두 지점 사이 길을 계산합니다. */
export async function routeBetween(start: MapPoint, end: MapPoint): Promise<RouteResult> {
  assertPoint(start);
  assertPoint(end);
  const payload = await readJson(
    `https://router.project-osrm.org/route/v1/driving/${coordPath([start, end])}?overview=full&geometries=geojson`,
  );
  const route = parseRoute(payload);
  if (!route) throw new MapServiceError("두 지점 사이 길을 찾지 못했습니다.");
  return route;
}
