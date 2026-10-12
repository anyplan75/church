import { SubmitButton } from "@/components/submit-button";
import { updateSettings } from "@/lib/actions";
import { readDb } from "@/lib/store";

export const metadata = { title: "설정 · 예배 운영" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const query = await searchParams;
  const churchName = readDb().settings.churchName;

  return (
    <div className="page max-w-xl">
      <h1 className="font-serif text-4xl">설정</h1>
      <p className="mt-2 text-muted">주보와 진행 화면 위에 표시되는 교회 이름입니다.</p>
      {query.saved ? <p className="mt-4 text-sm text-pine">교회 이름을 저장했습니다.</p> : null}
      {query.error === "empty" ? <p className="mt-4 text-sm text-wine">교회 이름을 입력해 주세요.</p> : null}
      <form action={updateSettings} autoComplete="off" className="card mt-6 space-y-4 p-5">
        <label className="field">
          <span>교회 이름</span>
          <input className="input" name="churchName" defaultValue={churchName} maxLength={40} required />
        </label>
        <SubmitButton>저장</SubmitButton>
      </form>
    </div>
  );
}
