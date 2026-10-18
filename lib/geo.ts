/** 교회 좌표·거리 계산. Firebase에 lat/lng가 있을 때 주변 교회 목록에 씁니다. */

export const NEARBY_RADIUS_OPTIONS_KM = [5, 10, 15, 20] as const;
export type NearbyRadiusKm = (typeof NEARBY_RADIUS_OPTIONS_KM)[number];
export const DEFAULT_NEARBY_RADIUS_KM: NearbyRadiusKm = 15;

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type LocatableChurch = {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
};

export type NearbyChurch<T extends LocatableChurch = LocatableChurch> = T & {
  distanceKm: number;
};

/** 위도·경도가 쓸 수 있는 숫자인지 확인합니다. */
export function isValidGeoPoint(point: Partial<GeoPoint> | null | undefined): point is GeoPoint {
  if (!point) return false;
  const { lat, lng } = point;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** 두 지점 사이 거리(km). 하버사인 공식. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * 기준 좌표에서 radiusKm 안쪽 교회만 골라 가까운 순으로 정렬합니다.
 * 좌표가 없는 교회는 목록에서 뺍니다.
 */
export function filterNearbyChurches<T extends LocatableChurch>(
  churches: readonly T[],
  origin: GeoPoint,
  radiusKm: number = DEFAULT_NEARBY_RADIUS_KM,
): NearbyChurch<T>[] {
  const max = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : DEFAULT_NEARBY_RADIUS_KM;
  const rows: NearbyChurch<T>[] = [];
  for (const church of churches) {
    if (!isValidGeoPoint(church)) continue;
    const km = distanceKm(origin, { lat: church.lat, lng: church.lng });
    if (km <= max) rows.push({ ...church, distanceKm: km });
  }
  return rows.sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, "ko"));
}

/** 화면 표시용 거리 글자. */
export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}
