import { showsCommunitySettings, showsOwnPickup, showsPeopleSettings } from "@/account/access";
import { CommunityAccountSettings, OwnPickupSettings, PeopleSettings, SurveyAccountSettings } from "@/components/account-settings";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermText } from "@/components/term-text";
import { loginAction, logoutAction, signupAction } from "@/server/community/actions";
import { loadAccountPage } from "@/server/community/service";

export const dynamic = "force-dynamic";

function note(ok: string | undefined, count: string | undefined, missed: string | undefined): string {
  if (ok === "church") return "교회를 저장했습니다.";
  if (ok === "removed") return "교회를 지웠습니다.";
  if (ok === "missed") return "교회는 저장했지만, 주소를 지도에서 찾지 못해 핀은 없습니다.";
  if (ok === "banned") return "금지어를 저장했습니다.";
  if (ok === "banned-removed") return "금지어를 지웠습니다.";
  if (ok === "address") return "내 주소를 저장했습니다.";
  if (ok === "pickup") return "데리러 가기 동의를 저장했습니다.";
  if (ok === "survey") return "설문을 저장했습니다.";
  if (ok === "sheet") {
    const saved = count && /^\d+$/.test(count) ? `${count}곳을 넣었습니다.` : "엑셀의 교회를 넣었습니다.";
    if (missed && /^\d+$/.test(missed) && missed !== "0") return `${saved} ${missed}곳은 주소를 찾지 못해 핀이 없습니다.`;
    return saved;
  }
  return "";
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; count?: string; missed?: string }>;
}) {
  const query = await searchParams;
  const account = await loadAccountPage();
  const status = note(query.ok, query.count, query.missed);

  return (
    <section className="grid gap-6">
      <h1 className="page-title text-[clamp(1.45rem,1.1rem+0.85vw,2rem)] leading-tight">
        <TermText termKey="account" />
      </h1>
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {status ? (
        <p role="status" className="rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed">
          {status}
        </p>
      ) : null}
      {account.user ? (
        <div className="grid gap-6">
          <form action={logoutAction} className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <p className="font-semibold leading-snug">{account.user.name}</p>
            {account.pendingCount > 0 ? (
              <p className="leading-relaxed text-[#5c5148]">가입 승인을 기다리는 공동체가 있습니다. 승인이 나기 전에는 정식 일을 할 수 없습니다.</p>
            ) : null}
            <SubmitButton termKey="logout" />
          </form>
          {showsOwnPickup(account.role) ? <OwnPickupSettings /> : null}
          {showsPeopleSettings(account.role) ? <PeopleSettings /> : null}
          <SurveyAccountSettings />
          {showsCommunitySettings(account.role) ? <CommunityAccountSettings /> : null}
        </div>
      ) : (
        <div className="grid gap-6">
          <form action={loginAction} id="login-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <TermField termKey="field_email" name="email" type="email" required autoComplete="username" />
            <TermField termKey="field_password" name="password" type="password" required autoComplete="current-password" />
            <SubmitButton termKey="login" />
          </form>
          <form action={signupAction} id="signup-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <TermField termKey="field_name" name="name" required autoComplete="name" />
            <TermField termKey="field_email" name="email" type="email" required autoComplete="email" />
            <TermField termKey="field_password" name="password" type="password" required autoComplete="new-password" />
            <SubmitButton termKey="signup" />
          </form>
        </div>
      )}
    </section>
  );
}
