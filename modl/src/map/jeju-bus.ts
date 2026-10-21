/**
 * 제주 버스 정의서 응답만 읽습니다.
 * 응답에 없는 정류장, 노선, 도착 시각은 만들지 않습니다.
 */

import type { MapPoint } from "@/map/rules";

export type BusStation = {
  id: string;
  name: string;
  point: MapPoint;
};

export type BusArrival = {
  routeId: string;
  minutes: number | null;
  stopsLeft: number | null;
};

export type BusPass = {
  routeId: string;
  running: boolean;
};

export type BusGuideStop = {
  id: string;
  name: string;
  routes: string[];
  arrivals: Array<{ label: string; minutes: number | null; stopsLeft: number | null }>;
};

export type BusGuide =
  | { kind: "outside" }
  | { kind: "empty" }
  | { kind: "stops"; stops: BusGuideStop[] };

const JEJU_LAT = { min: 33.11, max: 33.6 };
const JEJU_LON = { min: 126.08, max: 127 };

/** 제주 본섬과 가까운 바다 안인지 봅니다. 육지 좌표는 빠집니다. */
export function isJejuPoint(point: MapPoint): boolean {
  return point.lat >= JEJU_LAT.min && point.lat <= JEJU_LAT.max && point.lon >= JEJU_LON.min && point.lon <= JEJU_LON.max;
}

function finitePoint(lat: number, lon: number): MapPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export function xmlResultCode(xml: string): string {
  return xml.match(/<resultCode>([^<]*)<\/resultCode>/)?.[1]?.trim() ?? "";
}

export function parseXmlItems(xml: string): Array<Record<string, string>> {
  const items: Array<Record<string, string>> = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const row: Record<string, string> = {};
    for (const tag of match[1].matchAll(/<([A-Za-z0-9_]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g)) {
      row[tag[1]] = (tag[2] ?? tag[3] ?? "").trim();
    }
    items.push(row);
  }
  return items;
}

/** 정류장 목록에서 좌표와 이름이 있는 것만 남깁니다. */
export function parseStations(xml: string): BusStation[] {
  if (xmlResultCode(xml) !== "00") return [];
  const stations: BusStation[] = [];
  const seen = new Set<string>();
  for (const row of parseXmlItems(xml)) {
    const id = row.stationId ?? "";
    const name = row.stationNm ?? "";
    const point = finitePoint(Number(row.localY), Number(row.localX));
    if (!id || !name || !point || seen.has(id) || !isJejuPoint(point)) continue;
    seen.add(id);
    stations.push({ id, name, point });
  }
  return stations;
}

export function parseRouteNames(xml: string): Map<string, string> {
  const names = new Map<string, string>();
  if (xmlResultCode(xml) !== "00") return names;
  for (const row of parseXmlItems(xml)) {
    const id = row.routeId ?? "";
    const name = row.routeNm || row.routeNum || "";
    if (!id || !name || names.has(id)) continue;
    const sub = row.routeSubNm ?? "";
    names.set(id, sub ? `${name} ${sub}` : name);
  }
  return names;
}

/** 도착 예정 시간이 있고, 산출 시각이 최근일 때만 남깁니다. */
export function parseArrivals(xml: string, now = Date.now()): BusArrival[] {
  if (xmlResultCode(xml) !== "00") return [];
  const arrivals: BusArrival[] = [];
  for (const row of parseXmlItems(xml)) {
    const routeId = row.routeId ?? "";
    const calculated = Date.parse(row.calcDate ?? "");
    if (!routeId || !Number.isFinite(calculated) || Math.abs(now - calculated) > 30 * 60 * 1000) continue;
    const minutes = optionalCount(row.predictTravTm);
    const stopsLeft = optionalCount(row.leftStation);
    if ((minutes === null || minutes <= 0) && (stopsLeft === null || stopsLeft <= 0)) continue;
    arrivals.push({ routeId, minutes: minutes !== null && minutes > 0 ? minutes : null, stopsLeft: stopsLeft !== null && stopsLeft > 0 ? stopsLeft : null });
  }
  return arrivals;
}

/** 운행 중이라고 적힌 노선만 남깁니다. */
export function parsePassingRoutes(xml: string): BusPass[] {
  if (xmlResultCode(xml) !== "00") return [];
  const routes: BusPass[] = [];
  const seen = new Set<string>();
  for (const row of parseXmlItems(xml)) {
    const routeId = row.routeId ?? "";
    if (!routeId || seen.has(routeId) || row.useYn !== "Y") continue;
    seen.add(routeId);
    routes.push({ routeId, running: true });
  }
  return routes;
}

function optionalCount(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

export function metersBetween(from: MapPoint, to: MapPoint): number {
  const earth = 6371000;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(hav)));
}

/** 좌표가 있는 정류장 중 가까운 곳만 고릅니다. 멀면 빈 목록입니다. */
export function nearbyStations(stations: readonly BusStation[], point: MapPoint, limit = 3, maxMeters = 1200): BusStation[] {
  return stations
    .map((station) => ({ station, meters: metersBetween(point, station.point) }))
    .filter((item) => item.meters <= maxMeters)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit)
    .map((item) => item.station);
}

export function shapeStop(
  station: BusStation,
  arrivals: readonly BusArrival[],
  passing: readonly BusPass[],
  names: ReadonlyMap<string, string>,
): BusGuideStop {
  const routes: string[] = [];
  const seen = new Set<string>();
  for (const route of passing) {
    const label = names.get(route.routeId);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    routes.push(label);
  }
  return {
    id: station.id,
    name: station.name,
    routes,
    arrivals: arrivals.map((arrival) => ({
      label: names.get(arrival.routeId) || arrival.routeId,
      minutes: arrival.minutes,
      stopsLeft: arrival.stopsLeft,
    })),
  };
}
