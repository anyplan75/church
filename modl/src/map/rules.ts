/**
 * 지도 검색 결과와 길 응답을 읽습니다.
 * 바깥 서비스가 주지 않은 위치는 만들지 않습니다.
 */

export type PlaceKind = "restaurant" | "lodging";

export type MapPoint = {
  lat: number;
  lon: number;
};

export type PlaceHit = {
  id: string;
  name: string;
  address: string;
  kind: PlaceKind;
  point: MapPoint;
};

export const PLACE_KIND_LABEL: Record<PlaceKind, string> = {
  restaurant: "식당",
  lodging: "숙소",
};

const RESTAURANT_TYPES = new Set(["restaurant", "fast_food", "food_court"]);
const LODGING_TYPES = new Set(["hotel", "guest_house", "hostel", "motel"]);

export function placeKind(category: string, type: string): PlaceKind | null {
  if (category === "amenity" && RESTAURANT_TYPES.has(type)) return "restaurant";
  if (category === "tourism" && LODGING_TYPES.has(type)) return "lodging";
  return null;
}

function finitePoint(lat: number, lon: number): MapPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function lonLatPair(value: unknown): MapPoint | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = typeof value[0] === "number" ? value[0] : Number.NaN;
  const lat = typeof value[1] === "number" ? value[1] : Number.NaN;
  return finitePoint(lat, lon);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 주소 검색 응답에서 식당과 숙소만 남깁니다. */
export function parsePlaces(payload: unknown): PlaceHit[] {
  if (!Array.isArray(payload)) return [];
  const hits: PlaceHit[] = [];
  const seen = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const kind = placeKind(text(record.category), text(record.type));
    if (!kind) continue;
    const id = text(record.place_id) || String(record.place_id ?? "");
    if (!id || seen.has(id)) continue;
    const point = finitePoint(Number(record.lat), Number(record.lon));
    if (!point) continue;
    seen.add(id);
    hits.push({
      id,
      name: text(record.name) || "이름 없음",
      address: text(record.display_name),
      kind,
      point,
    });
  }
  return hits;
}

export function parseNearest(payload: unknown): MapPoint | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.code !== "Ok" || !Array.isArray(record.waypoints)) return null;
  const first = record.waypoints[0];
  if (!first || typeof first !== "object") return null;
  return lonLatPair((first as Record<string, unknown>).location);
}

export type SnapResult = {
  snapped: Array<MapPoint | null>;
  line: MapPoint[];
};

function lineFromGeometry(value: unknown): MapPoint[] {
  if (!value || typeof value !== "object") return [];
  const coordinates = (value as Record<string, unknown>).coordinates;
  if (!Array.isArray(coordinates)) return [];
  return coordinates.flatMap((pair) => {
    const point = lonLatPair(pair);
    return point ? [point] : [];
  });
}

/** 여러 점을 길에 붙인 응답입니다. 붙지 않은 점은 null 입니다. */
export function parseMatch(payload: unknown): SnapResult | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.code !== "Ok" || !Array.isArray(record.tracepoints)) return null;
  const snapped = record.tracepoints.map((item) => {
    if (!item || typeof item !== "object") return null;
    return lonLatPair((item as Record<string, unknown>).location);
  });
  const line = Array.isArray(record.matchings)
    ? record.matchings.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        return lineFromGeometry((item as Record<string, unknown>).geometry);
      })
    : [];
  if (snapped.every((point) => point === null) && line.length === 0) return null;
  return { snapped, line };
}

export type RouteSegment = {
  line: MapPoint[];
  speedMps: number | null;
};

export type RouteResult = {
  line: MapPoint[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  segments: RouteSegment[];
};

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** 두 점 사이 길입니다. 길이 없으면 null 입니다. */
export function parseRoute(payload: unknown): RouteResult | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.code !== "Ok" || !Array.isArray(record.routes) || !record.routes[0]) return null;
  const route = record.routes[0];
  if (!route || typeof route !== "object") return null;
  const body = route as Record<string, unknown>;
  const line = lineFromGeometry(body.geometry);
  if (line.length < 2) return null;
  return {
    line,
    distanceMeters: optionalNumber(body.distance),
    durationSeconds: optionalNumber(body.duration),
    segments: routeSegments(body),
  };
}

function routeSegments(body: Record<string, unknown>): RouteSegment[] {
  if (!Array.isArray(body.legs)) return [];
  const segments: RouteSegment[] = [];
  for (const leg of body.legs) {
    if (!leg || typeof leg !== "object" || !Array.isArray((leg as Record<string, unknown>).steps)) continue;
    for (const step of (leg as Record<string, unknown>).steps as unknown[]) {
      if (!step || typeof step !== "object") continue;
      const record = step as Record<string, unknown>;
      const stepLine = lineFromGeometry(record.geometry);
      if (stepLine.length < 2) continue;
      const distance = optionalNumber(record.distance);
      const duration = optionalNumber(record.duration);
      const speed = distance !== null && duration !== null && duration > 0 ? distance / duration : null;
      segments.push({ line: stepLine, speedMps: speed });
    }
  }
  return segments;
}

/** 맵박스 주소 검색이 돌려준 첫 좌표만 읽습니다. 없으면 비웁니다. */
export function parseMapboxGeocode(payload: unknown): MapPoint | null {
  if (!payload || typeof payload !== "object") return null;
  const features = (payload as Record<string, unknown>).features;
  if (!Array.isArray(features) || !features[0] || typeof features[0] !== "object") return null;
  return lonLatPair((features[0] as Record<string, unknown>).center);
}

/** 주소 검색 후보의 이름과 좌표입니다. 고르는 일은 호출하는 쪽이 합니다. */
export function parseMapboxGeocodeCandidates(payload: unknown): { label: string; point: MapPoint }[] {
  if (!payload || typeof payload !== "object") return [];
  const features = (payload as Record<string, unknown>).features;
  if (!Array.isArray(features)) return [];
  const found: { label: string; point: MapPoint }[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const record = feature as Record<string, unknown>;
    const point = lonLatPair(record.center);
    const label = text(record.place_name);
    if (!point || !label) continue;
    found.push({ label, point });
  }
  return found;
}
