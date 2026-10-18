"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DEFAULT_NEARBY_RADIUS_KM,
  NEARBY_RADIUS_OPTIONS_KM,
  filterNearbyChurches,
  formatDistanceKm,
  isValidGeoPoint,
  type NearbyRadiusKm,
} from "@/lib/geo";
import { GeocodeError, geocodeAddress, geocodeProviderLabel } from "@/lib/geocode";
import type { ChurchRow } from "@/lib/app-db";

export type GeocodedChurchFields = {
  address: string;
  lat: string;
  lng: string;
  displayName: string;
};

type Props = {
  churches: ChurchRow[];
  /** 주변 교회를 골랐을 때 (기존 교회 열기) */
  onSelectExisting?: (churchId: string) => void;
  /** 주변 교회 정보 수정 */
  onEditExisting?: (churchId: string) => void;
  /** 주소 검색 결과가 바뀌면 숨은 필드용 값 전달 */
  onGeocoded?: (fields: GeocodedChurchFields | null) => void;
  /** 기본 주소 (폼 초기값) */
  defaultAddress?: string;
};

export function ChurchNearbyPicker({ churches, onSelectExisting, onEditExisting, onGeocoded, defaultAddress = "" }: Props) {
  const [address, setAddress] = useState(defaultAddress);
  const [radiusKm, setRadiusKm] = useState<NearbyRadiusKm>(DEFAULT_NEARBY_RADIUS_KM);
  const [origin, setOrigin] = useState<{ lat: number; lng: number; displayName: string } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const nearby = useMemo(() => {
    if (!origin || !isValidGeoPoint(origin)) return [];
    return filterNearbyChurches(churches, origin, radiusKm);
  }, [churches, origin, radiusKm]);

  function search() {
    setError("");
    startTransition(async () => {
      try {
        const result = await geocodeAddress(address);
        setOrigin({ lat: result.lat, lng: result.lng, displayName: result.displayName });
        onGeocoded?.({
          address: address.trim().slice(0, 200),
          lat: String(result.lat),
          lng: String(result.lng),
          displayName: result.displayName,
        });
      } catch (reason) {
        setOrigin(null);
        onGeocoded?.(null);
        if (reason instanceof GeocodeError) {
          setError(reason.message);
        } else {
          setError("주소 검색에 실패했습니다.");
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="field sm:col-span-1">
          <span>교회 주소</span>
          <input
            className="input"
            name="address"
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={200}
            placeholder="예: 제주특별자치도 제주시 …"
            autoComplete="street-address"
          />
        </label>
        <label className="field">
          <span>반경</span>
          <select
            className="input"
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value) as NearbyRadiusKm)}
            aria-label="주변 검색 반경"
          >
            {NEARBY_RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {km}km
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="button" className="btn btn-quiet w-full sm:w-auto" onClick={search} disabled={pending || !address.trim()}>
            {pending ? "찾는 중…" : "주변 교회 찾기"}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">주소로 위치를 찾은 뒤, 가까운 기존 교회를 고르거나 같은 주소로 새 교회를 만듭니다. ({geocodeProviderLabel()})</p>
      {error ? <p className="text-sm text-wine">{error}</p> : null}
      {origin ? (
        <p className="text-sm text-pine">
          위치: {origin.displayName} ({origin.lat.toFixed(5)}, {origin.lng.toFixed(5)})
        </p>
      ) : null}
      {origin ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">주변 교회 ({nearby.length})</h3>
          {nearby.length === 0 ? (
            <p className="text-sm text-muted">이 반경 안에 등록된 교회가 없습니다. 아래에서 새 교회를 만들 수 있습니다.</p>
          ) : (
            <ul className="space-y-2">
              {nearby.map((church) => (
                <li key={church.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{church.name}</p>
                    <p className="text-sm text-muted">
                      {formatDistanceKm(church.distanceKm)}
                      {church.address ? ` · ${church.address}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onEditExisting ? (
                      <button type="button" className="btn btn-quiet btn-small" onClick={() => onEditExisting(church.id)}>
                        교회 정보 수정
                      </button>
                    ) : null}
                    {onSelectExisting ? (
                      <button type="button" className="btn btn-quiet btn-small" onClick={() => onSelectExisting(church.id)}>
                        이 교회 열기
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
