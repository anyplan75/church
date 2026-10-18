"use client";

import { useState, useTransition } from "react";
import { saveChurchProfile } from "@/lib/platform-actions";
import { GeocodeError, geocodeAddress, geocodeProviderLabel } from "@/lib/geocode";
import { SubmitButton } from "@/components/submit-button";

export type ChurchProfileDraft = {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
};

type Props = {
  church: ChurchProfileDraft;
  /** 저장 후 돌아갈 경로 (예: /platform, /settings) */
  returnTo?: string;
  /** 닫기 버튼이 필요할 때 */
  onCancel?: () => void;
  heading?: string;
};

/**
 * 기존 교회 이름·주소를 고치는 폼.
 * 주소를 바꾸면 「좌표 다시 찾기」로 lat/lng를 갱신한 뒤 저장합니다.
 */
export function ChurchProfileEditor({ church, returnTo = "/platform", onCancel, heading = "교회 정보 수정" }: Props) {
  const [name, setName] = useState(church.name);
  const [address, setAddress] = useState(church.address || "");
  const [lat, setLat] = useState(church.lat != null && Number.isFinite(church.lat) ? String(church.lat) : "");
  const [lng, setLng] = useState(church.lng != null && Number.isFinite(church.lng) ? String(church.lng) : "");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function findCoords() {
    setError("");
    startTransition(async () => {
      try {
        const result = await geocodeAddress(address);
        setLat(String(result.lat));
        setLng(String(result.lng));
        setDisplayName(result.displayName);
      } catch (reason) {
        setLat("");
        setLng("");
        setDisplayName("");
        if (reason instanceof GeocodeError) setError(reason.message);
        else setError("주소 검색에 실패했습니다.");
      }
    });
  }

  return (
    <form action={saveChurchProfile} className="space-y-4">
      <input type="hidden" name="churchId" value={church.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-serif text-2xl">{heading}</h2>
        {onCancel ? (
          <button type="button" className="btn btn-quiet btn-small" onClick={onCancel}>
            닫기
          </button>
        ) : null}
      </div>
      <p className="text-sm text-muted">이름과 교회 주소를 고친 뒤 저장합니다. 주소를 바꾸면 좌표를 다시 찾아 주변 검색에 반영됩니다.</p>
      {error ? <p className="text-sm text-wine">{error}</p> : null}
      <label className="field">
        <span>교회 이름</span>
        <input className="input" name="name" type="text" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required />
      </label>
      <label className="field">
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
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-quiet" onClick={findCoords} disabled={pending || !address.trim()}>
          {pending ? "찾는 중…" : "좌표 다시 찾기"}
        </button>
        <span className="text-xs text-muted">({geocodeProviderLabel()})</span>
      </div>
      {lat && lng ? (
        <p className="text-sm text-pine">
          저장될 좌표: {displayName ? `${displayName} · ` : ""}
          {lat}, {lng}
        </p>
      ) : (
        <p className="text-sm text-muted">좌표가 없으면 주변 교회 찾기에 이 교회가 나타나지 않을 수 있습니다.</p>
      )}
      <SubmitButton>교회 정보 저장</SubmitButton>
    </form>
  );
}
