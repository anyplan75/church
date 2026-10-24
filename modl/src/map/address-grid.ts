import proj4 from "proj4";
import type { MapPoint } from "@/map/rules";

/** 주소 표식에 적힌 격자 좌표를 위도·경도로 바꿉니다. 다른 장소의 검색 좌표는 만들지 않습니다. */
const KOREA_CENTRAL = "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs";
proj4.defs("MODL:5181", KOREA_CENTRAL);

export function addressGridToWgs(wx: number, wy: number): MapPoint | null {
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;
  const [lon, lat] = proj4("MODL:5181", "WGS84", [wx / 2.5, wy / 2.5]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}
