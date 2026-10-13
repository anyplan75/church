"use client";

import { AccountPanel } from "@/components/account-panel";
import { SubmitButton } from "@/components/submit-button";
import { useChurch, useClientQuery } from "@/components/church-state";
import { updateSettings } from "@/lib/actions";
import { listAccounts, storedBackgroundUrl } from "@/lib/app-db";

const OVERLAYS = [
  { id: "bottom", label: "아래" },
  { id: "top", label: "위" },
  { id: "left", label: "왼쪽" },
  { id: "right", label: "오른쪽" },
] as const;

export default function SettingsPage() {
  const { ready, user, db } = useChurch();
  const query = useClientQuery();
  if (!ready || !user || !db) return null;
  const settings = db.settings;
  const accounts = listAccounts();

  return (
    <div className="page max-w-3xl">
      <h1 className="font-serif text-4xl">설정</h1>
      <p className="mt-2 text-muted">교회 이름, 송출 배경, 자막 위치를 정합니다. 자막은 통역 화면처럼 순서 위에 겹칩니다.</p>
      {query.saved ? <p className="mt-4 text-sm text-pine">설정을 저장했습니다.</p> : null}
      {query.error === "empty" ? <p className="mt-4 text-sm text-wine">교회 이름을 입력해 주세요.</p> : null}
      {query.error === "image" ? <p className="mt-4 text-sm text-wine">배경 그림은 5MB 이하의 JPG, PNG, WEBP로 올려 주세요.</p> : null}
      <form action={updateSettings} autoComplete="off" className="card mt-6 space-y-4 p-5">
        <label className="field">
          <span>교회 이름</span>
          <input className="input" name="churchName" defaultValue={settings.churchName} maxLength={40} required />
        </label>
        <label className="field">
          <span>배경색</span>
          <input className="input h-11" name="backgroundColor" type="color" defaultValue={settings.backgroundColor || "#1b3a32"} />
        </label>
        <label className="field">
          <span>배경 그림</span>
          <input className="input" name="background" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" />
        </label>
        {settings.backgroundFile ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="clearBackground" />
            배경 그림 지우기
          </label>
        ) : null}
        {settings.backgroundFile ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={storedBackgroundUrl(settings.backgroundFile) || ""} alt="현재 배경" className="h-32 w-full rounded-xl object-cover" />
        ) : null}
        <label className="field">
          <span>자막 위치</span>
          <select className="select" name="overlay" defaultValue={settings.overlay}>
            {OVERLAYS.map((overlay) => (
              <option key={overlay.id} value={overlay.id}>
                {overlay.label}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton>저장</SubmitButton>
      </form>
      <AccountPanel accounts={accounts} currentId={user.id} error={query.accountError} saved={query.accountSaved} errorAccount={query.account} />
    </div>
  );
}
