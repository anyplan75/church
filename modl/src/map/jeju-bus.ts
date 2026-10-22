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

export type BusRouteFact = {
  id: string;
  number: string;
  detail: string;
  colorCode: string;
};

export type BusRouteChip = {
  id: string;
  number: string;
  detail: string;
  background: string | null;
  text: string | null;
};

export type BusGuideStop = {
  id: string;
  name: string;
  routes: BusRouteChip[];
  arrivals: Array<{ routeId: string; label: string; minutes: number | null; stopsLeft: number | null }>;
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

const ROUTE_COLOR: Record<string, { background: string; text: string }> = {
  "0": { background: "#8a4b2f", text: "#ffffff" },
  "1": { background: "#8a4b2f", text: "#ffffff" },
  "2": { background: "#1d4ed8", text: "#ffffff" },
  "3": { background: "#15803d", text: "#ffffff" },
  "4": { background: "#dc2626", text: "#ffffff" },
  "5": { background: "#ea580c", text: "#ffffff" },
  "6": { background: "#7c3aed", text: "#ffffff" },
  "7": { background: "#eab308", text: "#1f2937" },
};

/** 정의서의 노선 색을 따르고, 색 코드가 없으면 이름에 적힌 지선·간선·급행만 칠합니다. */
export function routeInk(colorCode: string, label: string): { background: string; text: string } | null {
  const documented = ROUTE_COLOR[colorCode];
  if (documented) return documented;
  if (label.includes("급행")) return { background: "#dc2626", text: "#ffffff" };
  if (label.includes("간선")) return { background: "#1d4ed8", text: "#ffffff" };
  if (label.includes("지선")) return { background: "#15803d", text: "#ffffff" };
  return null;
}

export function parseRouteFacts(xml: string): Map<string, BusRouteFact> {
  const facts = new Map<string, BusRouteFact>();
  if (xmlResultCode(xml) !== "00") return facts;
  for (const row of parseXmlItems(xml)) {
    const id = row.routeId ?? "";
    const number = row.routeNm || row.routeNum || "";
    if (!id || !number || facts.has(id)) continue;
    facts.set(id, {
      id,
      number,
      detail: row.routeSubNm ?? "",
      colorCode: row.routeColor ?? "",
    });
  }
  return facts;
}

export function parseRouteStopOrder(xml: string): Array<{ id: string; order: number }> {
  if (xmlResultCode(xml) !== "00") return [];
  const stops: Array<{ id: string; order: number }> = [];
  const seen = new Set<string>();
  for (const row of parseXmlItems(xml)) {
    const id = row.stationId ?? "";
    const order = Number(row.stationOrd);
    if (!id || !Number.isFinite(order) || seen.has(id) || (row.useYn !== undefined && row.useYn !== "" && row.useYn !== "Y")) continue;
    seen.add(id);
    stops.push({ id, order });
  }
  stops.sort((a, b) => a.order - b.order);
  return stops;
}

/** 정류장 좌표가 응답에 있는 점만 노선 순서로 잇습니다. */
export function lineFromStops(
  order: readonly { id: string; order: number }[],
  stations: ReadonlyMap<string, BusStation>,
): MapPoint[] {
  const line: MapPoint[] = [];
  for (const stop of order) {
    const station = stations.get(stop.id);
    if (!station) continue;
    const last = line[line.length - 1];
    if (last && last.lat === station.point.lat && last.lon === station.point.lon) continue;
    line.push(station.point);
  }
  return line;
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

function chipFromFact(id: string, facts: ReadonlyMap<string, BusRouteFact>): BusRouteChip | null {
  const fact = facts.get(id);
  const number = fact?.number || "";
  if (!number) return null;
  const ink = routeInk(fact?.colorCode ?? "", `${number} ${fact?.detail ?? ""}`);
  return {
    id,
    number,
    detail: fact?.detail ?? "",
    background: ink?.background ?? null,
    text: ink?.text ?? null,
  };
}

export function shapeStop(
  station: BusStation,
  arrivals: readonly BusArrival[],
  passing: readonly BusPass[],
  facts: ReadonlyMap<string, BusRouteFact>,
): BusGuideStop {
  const routes: BusRouteChip[] = [];
  const seen = new Set<string>();
  for (const route of passing) {
    if (seen.has(route.routeId)) continue;
    const chip = chipFromFact(route.routeId, facts);
    if (!chip) continue;
    seen.add(route.routeId);
    routes.push(chip);
  }
  return {
    id: station.id,
    name: station.name,
    routes,
    arrivals: arrivals.flatMap((arrival) => {
      const chip = chipFromFact(arrival.routeId, facts);
      return [
        {
          routeId: arrival.routeId,
          label: chip ? `${chip.number}${chip.detail ? ` ${chip.detail}` : ""}` : arrival.routeId,
          minutes: arrival.minutes,
          stopsLeft: arrival.stopsLeft,
        },
      ];
    }),
  };
}
