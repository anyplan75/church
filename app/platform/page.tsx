"use client";

import Link from "next/link";
import { useState } from "react";
import { logout } from "@/lib/account-actions";
import { addChurch, openChurch } from "@/lib/platform-actions";
import { useChurch, useClientQuery } from "@/components/church-state";
import { ChurchNearbyPicker, type GeocodedChurchFields } from "@/components/church-nearby-picker";
import { RoleFields } from "@/components/role-fields";
import { SubmitButton } from "@/components/submit-button";
import { PRODUCT_NAME } from "@/lib/brand";
import { ALL_ROLES } from "@/lib/roles";

const ERRORS: Record<string, string> = {
  name: "교회 이름을 입력해 주세요.",
  email: "이메일 형식을 확인해 주세요.",
  short: "비밀번호는 8자 이상으로 만들어 주세요.",
  confirm: "비밀번호가 서로 다릅니다.",
  roles: "권한을 하나 이상 선택해 주세요.",
  taken: "이미 있는 이메일입니다.",
  denied: "교회를 저장하지 못했습니다.",
};

export default function PlatformPage() {
  const { ready, user, churches, error } = useChurch();
  const query = useClientQuery();
  const [geo, setGeo] = useState<GeocodedChurchFields | null>(null);

  if (!ready || !user || user.kind !== "platform") return null;

  return (
    <div className="page max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gold">{PRODUCT_NAME}</p>
          <h1 className="mt-1 font-serif text-4xl">교회</h1>
          <p className="mt-2 text-muted">
            주소로 주변 교회를 찾아 열거나, 같은 주소에 새 교회와 운영자 계정을 만듭니다. 교회 운영자는 자기 교회만 봅니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/activity" className="btn btn-quiet">
            작업 기록
          </Link>
          <form action={logout}>
            <button type="submit" className="btn btn-quiet">
              나가기
            </button>
          </form>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">{user.email}</p>
      {error ? <p className="mt-4 text-sm text-wine">{error}</p> : null}
      {query.saved ? <p className="mt-4 text-sm text-pine">교회와 운영자 계정을 만들었습니다.</p> : null}

      <section className="card mt-6 space-y-4 p-5">
        <h2 className="font-serif text-3xl">주소로 교회 찾기</h2>
        <ChurchNearbyPicker
          churches={churches}
          onGeocoded={setGeo}
          onSelectExisting={(id) => {
            const data = new FormData();
            data.set("id", id);
            void openChurch(data);
          }}
        />
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-serif text-3xl">교회 목록</h2>
        {churches.length === 0 ? <p className="mt-3 text-muted">아직 교회가 없습니다.</p> : null}
        <div className="mt-4 space-y-3">
          {churches.map((church) => (
            <form key={church.id} action={openChurch} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
              <input type="hidden" name="id" value={church.id} />
              <div className="min-w-0">
                <p className="font-semibold">{church.name}</p>
                <p className="text-sm text-muted">{church.operatorEmail}</p>
                {church.address ? <p className="text-sm text-muted">{church.address}</p> : null}
              </div>
              <SubmitButton className="btn btn-quiet">이 교회 열기</SubmitButton>
            </form>
          ))}
        </div>
      </section>

      <form action={addChurch} autoComplete="off" className="card mt-6 space-y-4 p-5">
        <h2 className="font-serif text-3xl">교회 추가</h2>
        <p className="text-sm text-muted">위에서 주소를 찾은 뒤, 맞는 교회가 없으면 여기서 새로 만듭니다. 찾은 좌표가 함께 저장됩니다.</p>
        {query.error ? <p className="text-sm text-wine">{ERRORS[query.error] ?? "교회를 추가하지 못했습니다."}</p> : null}
        <input type="hidden" name="lat" value={geo?.lat || ""} />
        <input type="hidden" name="lng" value={geo?.lng || ""} />
        <input type="hidden" name="address" value={geo?.address || ""} />
        {geo ? (
          <p className="text-sm text-pine">
            저장될 위치: {geo.displayName} ({geo.lat}, {geo.lng})
          </p>
        ) : (
          <p className="text-sm text-muted">주소 검색을 하지 않아도 만들 수 있지만, 주변 검색에는 좌표가 필요합니다.</p>
        )}
        <label className="field">
          <span>교회 이름</span>
          <input className="input" name="name" type="text" maxLength={40} required placeholder="교회 이름" />
        </label>
        <label className="field">
          <span>교회 운영자 이메일</span>
          <input className="input" name="email" type="email" autoComplete="off" maxLength={120} required placeholder="operator@church.org" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>비밀번호</span>
            <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={200} required />
          </label>
          <label className="field">
            <span>비밀번호 확인</span>
            <input className="input" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={200} required />
          </label>
        </div>
        <RoleFields selected={ALL_ROLES} />
        <SubmitButton>교회와 운영자 추가</SubmitButton>
      </form>
    </div>
  );
}
