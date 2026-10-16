"use client";

import { useEffect, useState } from "react";
import { AccountPanel } from "@/components/account-panel";
import { SubmitButton } from "@/components/submit-button";
import { useChurch, useClientQuery } from "@/components/church-state";
import { deleteGroup, finishSetup, saveGroup, updateSettings } from "@/lib/actions";
import { listAccounts, storedBackgroundUrl } from "@/lib/app-db";
import { hostEntry } from "@/lib/output-host";
import { captionSize, formatVisit, settingsReady, setupComplete } from "@/lib/simple";

const OVERLAYS = [
  { id: "bottom", label: "아래" },
  { id: "top", label: "위" },
  { id: "left", label: "왼쪽" },
  { id: "right", label: "오른쪽" },
] as const;

export default function SettingsPage() {
  const { ready, user, db } = useChurch();
  const query = useClientQuery();
  const [hostDraft, setHostDraft] = useState("");
  const [hostTouched, setHostTouched] = useState(false);
  useEffect(() => {
    if (!db || hostTouched) return;
    setHostDraft(db.settings.outputHost || "");
  }, [db, hostTouched]);
  if (!ready || !user || !db) return null;
  const settings = db.settings;
  const accounts = listAccounts();
  const missing = setupGaps(settings);
  const hostProblem = hostEntry(hostDraft).problem;

  return (
    <div className="page max-w-3xl">
      <h1 className="font-serif text-4xl">설정</h1>
      <p className="mt-2 text-muted">예배마다 같은 기본값은 여기에 두고, 예배마다 다른 담당은 사람 그룹으로 고릅니다. 이 설정이 끝나기 전에는 예배를 시작할 수 없습니다.</p>
      {settingsReady(settings) ? <p className="mt-4 text-sm text-pine">메인 설정을 마쳤습니다.</p> : null}
      {query.saved ? <p className="mt-4 text-sm text-pine">설정을 저장했습니다.</p> : null}
      {query.error === "empty" ? <p className="mt-4 text-sm text-wine">교회 이름을 입력해 주세요.</p> : null}
      {query.error === "host" ? <p className="mt-4 text-sm text-wine">이 송출 컴퓨터의 IP만 넣어 주세요. 예: 192.168.0.10</p> : null}
      {query.error === "url" || hostProblem === "url" ? <p className="mt-4 text-sm text-wine">192.168 주소를 넣어 주세요.</p> : null}
      {query.error === "image" ? <p className="mt-4 text-sm text-wine">배경 그림은 5MB 이하의 JPG, PNG, WEBP로 올려 주세요.</p> : null}
      {query.error === "group" ? <p className="mt-4 text-sm text-wine">그룹 이름과 사람을 한 명 이상 골라 주세요.</p> : null}
      {query.error === "setup" ? (
        <p className="mt-4 text-sm text-wine">아직 메인 설정을 마칠 수 없습니다. {missing.join(" ")}</p>
      ) : null}

      <form action={updateSettings} autoComplete="off" className="card mt-6 space-y-4 p-5">
        <h2 className="font-serif text-2xl">예배 기본값</h2>
        <label className="field">
          <span>교회 이름</span>
          <input className="input" name="churchName" defaultValue={settings.churchName} maxLength={40} required />
        </label>
        <label className="field">
          <span>기본 장소</span>
          <input className="input" name="defaultPlace" defaultValue={settings.defaultPlace || "본당"} maxLength={40} />
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
          <span>송출 컴퓨터</span>
          <input className="input" name="outputHost" value={hostDraft} onChange={(event) => { setHostTouched(true); setHostDraft(event.target.value); }} inputMode="decimal" autoComplete="off" placeholder="이 컴퓨터의 192.168 주소를 입력" maxLength={200} aria-label="이 송출 컴퓨터의 IP" />
        </label>
        <p className="text-sm text-muted">송출 컴퓨터의 IP는 이 설정에만 넣습니다. 예: 192.168.0.10</p>
        <label className="field">
          <span>메인 글자 크기</span>
          <input className="input" name="mainFontSize" type="number" min={16} max={200} step={1} defaultValue={captionSize(settings.mainFontSize)} aria-label="메인 글자 크기" />
        </label>
        <label className="field">
          <span>오버레이 글자 크기</span>
          <input className="input" name="overlayFontSize" type="number" min={16} max={200} step={1} defaultValue={captionSize(settings.overlayFontSize)} aria-label="오버레이 글자 크기" />
        </label>
        <p className="text-sm text-muted">픽셀입니다. 메인의 첫째 줄과 둘째 줄은 이 크기로 같습니다.</p>
        <label className="field">
          <span>오버레이 자막 위치</span>
          <select className="select" name="overlay" defaultValue={settings.overlay}>
            {OVERLAYS.map((overlay) => (
              <option key={overlay.id} value={overlay.id}>
                {overlay.label}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton>기본값 저장</SubmitButton>
      </form>

      <section className="card mt-6 space-y-4 p-5">
        <h2 className="font-serif text-2xl">사람 그룹</h2>
        <p className="text-sm text-muted">예배 설정에서 이 그룹을 고르면 그 예배의 담당이 됩니다.</p>
        {(settings.groups ?? []).map((group) => (
          <form key={group.id} action={saveGroup} className="space-y-3 rounded-xl border border-line p-3">
            <input type="hidden" name="id" value={group.id} />
            <label className="field">
              <span>그룹 이름</span>
              <input className="input" name="name" defaultValue={group.name} maxLength={40} required />
            </label>
            <PersonPicks people={db.people} selected={group.personIds} />
            <div className="flex gap-2">
              <SubmitButton className="btn btn-quiet">그룹 저장</SubmitButton>
            </div>
          </form>
        ))}
        {(settings.groups ?? []).map((group) => (
          <form key={`${group.id}-delete`} action={deleteGroup}>
            <input type="hidden" name="id" value={group.id} />
            <button type="submit" className="btn btn-quiet btn-small text-wine">
              {group.name} 삭제
            </button>
          </form>
        ))}
        <form action={saveGroup} className="space-y-3">
          <label className="field">
            <span>새 그룹</span>
            <input className="input" name="name" maxLength={40} placeholder="주일 1부 인도" />
          </label>
          <PersonPicks people={db.people} selected={[]} />
          <SubmitButton className="btn btn-quiet">그룹 추가</SubmitButton>
        </form>
      </section>

      <form action={finishSetup} className="card mt-6 space-y-3 p-5">
        <h2 className="font-serif text-2xl">메인 설정 마치기</h2>
        {missing.length > 0 ? <p className="text-sm text-wine">{missing.join(" ")}</p> : <p className="text-sm text-muted">필요한 항목을 모두 채웠습니다.</p>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="mainReady" defaultChecked={settings.mainReady === true} />
          메인 설정을 마쳤습니다
        </label>
        <SubmitButton>설정 마치기</SubmitButton>
      </form>

      <section className="card mt-6 p-5">
        <h2 className="font-serif text-2xl">접속 기록</h2>
        <p className="mt-2 text-sm text-muted">접속한 시각, 본 화면, 나간 시각만 남깁니다.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {(db.visits ?? []).length === 0 ? <li className="text-muted">아직 기록이 없습니다.</li> : null}
          {(db.visits ?? []).slice(0, 20).map((visit) => (
            <li key={visit.id}>{formatVisit(visit)}</li>
          ))}
        </ul>
      </section>

      <AccountPanel accounts={accounts} people={db.people} currentId={user.id} error={query.accountError} saved={query.accountSaved} errorAccount={query.account} />
    </div>
  );
}

function PersonPicks({ people, selected }: { people: { id: string; name: string }[]; selected: string[] }) {
  if (people.length === 0) return <p className="text-sm text-muted">먼저 사람을 등록해 주세요.</p>;
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {people.map((person) => (
        <label key={person.id} className="flex items-center gap-2">
          <input type="checkbox" name="personId" value={person.id} defaultChecked={selected.includes(person.id)} />
          {person.name}
        </label>
      ))}
    </div>
  );
}

function setupGaps(settings: Parameters<typeof setupComplete>[0]): string[] {
  const gaps: string[] = [];
  if (!settings.churchName.trim()) gaps.push("교회 이름이 필요합니다.");
  if (!(settings.defaultPlace ?? "").trim()) gaps.push("기본 장소가 필요합니다.");
  if (!settings.folders?.bible.trim() || !settings.folders?.hymn.trim() || !settings.folders?.praise.trim()) {
    gaps.push("라이브러리에서 성경, 찬송가, 찬양 폴더를 지정해 주세요.");
  }
  if (!(settings.groups ?? []).some((group) => group.name.trim() && group.personIds.length > 0)) {
    gaps.push("사람이 있는 그룹이 하나 필요합니다.");
  }
  return gaps;
}
