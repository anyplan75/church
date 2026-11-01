/**
 * 지금 화면에 들어온 핀만 고릅니다.
 * 멀리 축소하면 가까운 핀을 하나로 묶습니다.
 */

import type { MapPoint } from "@/map/rules";

/** 이 길이보다 남북으로 넓으면 핀을 묶습니다. 반경 10km 화면은 이보다 좁습니다. */
export const CLUSTER_BEYOND_KM = 36;

export type ViewBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export function pointInside(point: MapPoint, bounds: ViewBounds, pad = 0): boolean {
  return point.lon >= bounds.west - pad && point.lon <= bounds.east + pad && point.lat >= bounds.south - pad && point.lat <= bounds.north + pad;
}

export function boundsSpanKm(bounds: ViewBounds): number {
  return Math.abs(bounds.north - bounds.south) * 111.32;
}

export type DrawnPin<T> = {
  id: string;
  point: MapPoint;
  count: number;
  items: T[];
};

/** 화면 밖 핀은 빼니다. 축소가 깊으면 칸 단위로 묶습니다. */
export function pinsForView<T extends { id: string; point: MapPoint }>(
  pins: readonly T[],
  bounds: ViewBounds,
  zoom: number,
): DrawnPin<T>[] {
  const inside = pins.filter((pin) => pointInside(pin.point, bounds, 0.01));
  if (!Number.isFinite(zoom) || boundsSpanKm(bounds) <= CLUSTER_BEYOND_KM) {
    return inside.map((pin) => ({ id: pin.id, point: pin.point, count: 1, items: [pin] }));
  }
  const cell = boundsSpanKm(bounds) > 80 ? 0.2 : 0.05;
  const groups = new Map<string, T[]>();
  for (const pin of inside) {
    const key = `${Math.floor(pin.point.lat / cell)}:${Math.floor(pin.point.lon / cell)}`;
    const list = groups.get(key) ?? [];
    list.push(pin);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, items]) => {
    const lat = items.reduce((sum, item) => sum + item.point.lat, 0) / items.length;
    const lon = items.reduce((sum, item) => sum + item.point.lon, 0) / items.length;
    return { id: `cluster-${key}`, point: { lat, lon }, count: items.length, items };
  });
}
