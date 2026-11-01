/**
 * 지도가 처음 보여줄 범위와, 내 위치 안내의 확대 간격을 정합니다.
 * 속도가 없으면 중간 간격만 씁니다. 없는 길은 만들지 않습니다.
 */

import { metersBetween } from "@/map/jeju-bus";
import type { MapPoint } from "@/map/rules";

/** 제주도 전체가 들어오게 하는 범위입니다. 서쪽, 남쪽, 동쪽, 북쪽 순서의 경도·위도입니다. */
export const JEJU_VIEW = {
  west: 126.08,
  south: 33.16,
  east: 127.0,
  north: 33.57,
} as const;

/** 내 위치를 가운데 두고 보이게 할 반경입니다. 단위는 미터입니다. */
export const HERE_RADIUS_METERS = 10000;

/** 이 거리보다 길에서 멀어지면 같은 수단으로 다시 찾습니다. 단위는 미터입니다. */
export const OFF_ROUTE_METERS = 100;

/** 빠를수록 넓게, 느릴수록 지금 있는 곳이 크게 보이게 합니다. 단위는 미터입니다. */
export function followWindowMeters(speedMps: number | null): number {
  if (speedMps === null || !Number.isFinite(speedMps) || speedMps < 0) return 450;
  if (speedMps >= 12) return 1600;
  if (speedMps <= 3) return 160;
  return 600;
}

/** 한 점을 가운데 두고 사방 반경이 들어가게 범위를 만듭니다. */
export function radiusView(point: MapPoint, radiusMeters: number): { west: number; south: number; east: number; north: number } {
  const latDelta = radiusMeters / 111320;
  const cos = Math.cos((point.lat * Math.PI) / 180);
  const lonDelta = radiusMeters / (111320 * (Math.abs(cos) < 0.2 ? 0.2 : cos));
  return {
    west: point.lon - lonDelta,
    south: point.lat - latDelta,
    east: point.lon + lonDelta,
    north: point.lat + latDelta,
  };
}

function localMeters(origin: MapPoint, point: MapPoint): { x: number; y: number } {
  const cos = Math.cos((origin.lat * Math.PI) / 180);
  return {
    x: (point.lon - origin.lon) * 111320 * cos,
    y: (point.lat - origin.lat) * 111320,
  };
}

function segmentMeters(point: MapPoint, start: MapPoint, end: MapPoint): number {
  const here = localMeters(point, point);
  const from = localMeters(point, start);
  const to = localMeters(point, end);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  if (length === 0) return Math.hypot(here.x - from.x, here.y - from.y);
  const ratio = Math.min(1, Math.max(0, ((here.x - from.x) * dx + (here.y - from.y) * dy) / length));
  return Math.hypot(here.x - (from.x + dx * ratio), here.y - (from.y + dy * ratio));
}

/** 점에서 길까지의 가장 가까운 거리입니다. 길이 없으면 null 입니다. */
export function distanceToLineMeters(point: MapPoint, line: readonly MapPoint[]): number | null {
  if (line.length < 2) return null;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1];
    const end = line[index];
    if (!start || !end) continue;
    best = Math.min(best, segmentMeters(point, start, end));
  }
  return Number.isFinite(best) ? best : null;
}

/** 내 위치에서 가장 가까운 구간 번호입니다. 구간이 없으면 -1 입니다. */
export function nearestSegmentIndex(point: MapPoint, segments: readonly { line: readonly MapPoint[] }[]): number {
  let best = -1;
  let bestMeters = Number.POSITIVE_INFINITY;
  segments.forEach((segment, index) => {
    const meters = distanceToLineMeters(point, segment.line);
    if (meters === null || meters >= bestMeters) return;
    best = index;
    bestMeters = meters;
  });
  return best;
}

/** 한 구간의 길이입니다. */
export function lineLengthMeters(line: readonly MapPoint[]): number {
  let total = 0;
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1];
    const end = line[index];
    if (start && end) total += metersBetween(start, end);
  }
  return total;
}
