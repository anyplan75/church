/**
 * 제주 버스 정의서에 적힌 주소만 부릅니다.
 * 열쇠 항목은 정의서에서 없음으로 표시되어 있어 붙이지 않습니다.
 * 응답에 없는 정류장과 도착은 만들지 않습니다.
 */

import { isJejuPoint, nearbyStations, parseArrivals, parsePassingRoutes, parseRouteNames, parseStations, shapeStop, type BusGuide, type BusStation } from "@/map/jeju-bus";
import type { MapPoint } from "@/map/rules";
import { MapServiceError } from "@/server/map/service";

const STATIONS_URL = "http://busopen.jeju.go.kr/OpenAPI/service/bis/Station2";
const ROUTES_URL = "http://busopen.jeju.go.kr/OpenAPI/service/bis/Bus";
const ARRIVALS_URL = "http://busopen.jeju.go.kr/OpenAPI/service/bis/BusArrives";
const PASSING_URL = "http://busopen.jeju.go.kr/OpenAPI/service/bis/StationRoutePs";
const CACHE_MS = 10 * 60 * 1000;

let stationCache: { at: number; stations: BusStation[] } | null = null;
let routeCache: { at: number; names: Map<string, string> } | null = null;

async function readXml(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/xml", "User-Agent": "modl-map/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new MapServiceError("제주 버스 정보를 부르지 못했습니다.");
  }
  if (!response.ok) throw new MapServiceError("제주 버스 정보를 부르지 못했습니다.");
  try {
    return await response.text();
  } catch {
    throw new MapServiceError("제주 버스 응답을 읽지 못했습니다.");
  }
}

async function loadStations(): Promise<BusStation[]> {
  if (stationCache && Date.now() - stationCache.at < CACHE_MS) return stationCache.stations;
  const stations = parseStations(await readXml(STATIONS_URL));
  if (stations.length === 0) throw new MapServiceError("제주 버스 정보를 부르지 못했습니다.");
  stationCache = { at: Date.now(), stations };
  return stations;
}

async function loadRouteNames(): Promise<Map<string, string>> {
  if (routeCache && Date.now() - routeCache.at < CACHE_MS) return routeCache.names;
  try {
    const names = parseRouteNames(await readXml(ROUTES_URL));
    if (names.size === 0) return new Map();
    routeCache = { at: Date.now(), names };
    return names;
  } catch {
    return new Map();
  }
}

/** 장소가 제주가 아니면 안내 문장만 돌려주고, 제주이면 응답이 있는 정류장만 돌려줍니다. */
export async function guideBus(point: MapPoint): Promise<BusGuide> {
  if (!isJejuPoint(point)) return { kind: "outside" };
  const stations = nearbyStations(await loadStations(), point);
  if (stations.length === 0) return { kind: "empty" };
  const names = await loadRouteNames();
  const stops = await Promise.all(
    stations.map(async (station) => {
      const [arrivals, passing] = await Promise.all([
        readXml(`${ARRIVALS_URL}?station=${encodeURIComponent(station.id)}`).then(parseArrivals).catch(() => []),
        readXml(`${PASSING_URL}?station=${encodeURIComponent(station.id)}`).then(parsePassingRoutes).catch(() => []),
      ]);
      return shapeStop(station, arrivals, passing, names);
    }),
  );
  return { kind: "stops", stops };
}
