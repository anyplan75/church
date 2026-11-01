/**
 * 지도가 처음 열릴 중심입니다.
 * 제주도 전체나 전국이 아니라, 한 점 기준 반경만 씁니다.
 */

import { SERVICE_FOCUS, radiusView, HERE_RADIUS_METERS } from "@/map/follow";
import { regionFromAddress } from "@/map/region";
import type { MapPoint } from "@/map/rules";

export type MapOpeningSource = "address" | "region" | "home-church" | "service";

/** 이미 쓰는 제주시·서귀포시 중심입니다. 새 입력란이 아닙니다. */
export const REGION_FOCUS = {
  제주시: SERVICE_FOCUS,
  서귀포시: { lat: 33.2541, lon: 126.56 },
} as const;

export function openingFocus(input: {
  addressPoint?: MapPoint | null;
  addressText?: string | null;
  homeChurchPoint?: MapPoint | null;
}): { point: MapPoint; source: MapOpeningSource } {
  if (input.addressPoint) return { point: input.addressPoint, source: "address" };
  const region = regionFromAddress(input.addressText ?? "");
  if (region?.district === "제주시" || region?.district === "서귀포시") {
    return { point: REGION_FOCUS[region.district], source: "region" };
  }
  if (input.homeChurchPoint) return { point: input.homeChurchPoint, source: "home-church" };
  return { point: SERVICE_FOCUS, source: "service" };
}

/** 처음 화면의 남북 길이입니다. 단위는 킬로미터입니다. */
export function openingSpanKm(point: MapPoint): number {
  const view = radiusView(point, HERE_RADIUS_METERS);
  return (view.north - view.south) * 111.32;
}
