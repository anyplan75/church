/** 주소를 위도·경도로 바꿉니다. Mapbox/Google 키가 있으면 쓰고, 없으면 OpenStreetMap Nominatim. */

import { isValidGeoPoint, type GeoPoint } from "./geo";

export type GeocodeResult = GeoPoint & {
  displayName: string;
  provider: "mapbox" | "google" | "nominatim";
};

export type GeocodeErrorCode = "empty" | "not_found" | "network" | "denied";

export class GeocodeError extends Error {
  code: GeocodeErrorCode;
  constructor(code: GeocodeErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function envToken(name: string): string {
  if (typeof process === "undefined" || !process.env) return "";
  return String(process.env[name] || "").trim();
}

function pickProvider(): { kind: "mapbox" | "google" | "nominatim"; token: string } {
  const mapbox = envToken("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN") || envToken("NEXT_PUBLIC_MAPBOX_TOKEN");
  if (mapbox) return { kind: "mapbox", token: mapbox };
  const google = envToken("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY") || envToken("NEXT_PUBLIC_GOOGLE_GEOCODING_KEY");
  if (google) return { kind: "google", token: google };
  return { kind: "nominatim", token: "" };
}

async function geocodeMapbox(address: string, token: string): Promise<GeocodeResult> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${encodeURIComponent(token)}&limit=1&language=ko`;
  const res = await fetch(url);
  if (!res.ok) throw new GeocodeError(res.status === 401 || res.status === 403 ? "denied" : "network", "지도 서비스를 쓰지 못했습니다.");
  const data = (await res.json()) as { features?: { place_name?: string; center?: number[] }[] };
  const feature = data.features?.[0];
  const lng = Number(feature?.center?.[0]);
  const lat = Number(feature?.center?.[1]);
  if (!isValidGeoPoint({ lat, lng })) throw new GeocodeError("not_found", "주소를 찾지 못했습니다.");
  return { lat, lng, displayName: String(feature?.place_name || address).slice(0, 200), provider: "mapbox" };
}

async function geocodeGoogle(address: string, token: string): Promise<GeocodeResult> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(token)}&language=ko`;
  const res = await fetch(url);
  if (!res.ok) throw new GeocodeError("network", "지도 서비스를 쓰지 못했습니다.");
  const data = (await res.json()) as {
    status?: string;
    results?: { formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }[];
  };
  if (data.status === "REQUEST_DENIED") throw new GeocodeError("denied", "지도 키를 확인해주세요.");
  if (data.status === "ZERO_RESULTS" || !data.results?.length) throw new GeocodeError("not_found", "주소를 찾지 못했습니다.");
  const row = data.results[0];
  const lat = Number(row?.geometry?.location?.lat);
  const lng = Number(row?.geometry?.location?.lng);
  if (!isValidGeoPoint({ lat, lng })) throw new GeocodeError("not_found", "주소를 찾지 못했습니다.");
  return { lat, lng, displayName: String(row?.formatted_address || address).slice(0, 200), provider: "google" };
}

async function geocodeNominatim(address: string): Promise<GeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&accept-language=ko`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new GeocodeError("network", "주소 검색에 실패했습니다.");
  const data = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[];
  const row = Array.isArray(data) ? data[0] : null;
  const lat = Number(row?.lat);
  const lng = Number(row?.lon);
  if (!isValidGeoPoint({ lat, lng })) throw new GeocodeError("not_found", "주소를 찾지 못했습니다.");
  return { lat, lng, displayName: String(row?.display_name || address).slice(0, 200), provider: "nominatim" };
}

/** 주소 문자열 → 위도·경도. */
export async function geocodeAddress(rawAddress: string): Promise<GeocodeResult> {
  const address = rawAddress.trim().slice(0, 200);
  if (!address) throw new GeocodeError("empty", "주소를 입력해 주세요.");
  const provider = pickProvider();
  try {
    if (provider.kind === "mapbox") return await geocodeMapbox(address, provider.token);
    if (provider.kind === "google") return await geocodeGoogle(address, provider.token);
    return await geocodeNominatim(address);
  } catch (reason) {
    if (reason instanceof GeocodeError) throw reason;
    throw new GeocodeError("network", "주소 검색에 실패했습니다.");
  }
}

/** 지금 쓸 지오코딩 제공자 이름(안내 문구용). */
export function geocodeProviderLabel(): string {
  const provider = pickProvider();
  if (provider.kind === "mapbox") return "Mapbox";
  if (provider.kind === "google") return "Google";
  return "OpenStreetMap";
}
