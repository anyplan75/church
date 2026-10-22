import type { ReactNode } from "react";
import Link from "next/link";
import { showsCommunitySettings, showsOwnPickup, showsPeopleSettings } from "@/account/access";
import { ApprovalWork, GroupWork, InviteWork, NewcomerWork, RosterWork, seasonYear } from "@/components/account-work";
import { BannedWordSettings, OwnPickupSettings, SurveyAccountSettings } from "@/components/account-settings";
import { ChurchSettingsPanel } from "@/components/church-settings-panel";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermText } from "@/components/term-text";
import { SocialLoginButtons } from "@/components/social-login";
import { loginAction, logoutAction, signupAction } from "@/server/community/actions";
import { loadAccountPage } from "@/server/community/service";
import { loadChurchSettings } from "@/server/map/board";
import { loadBannedWordsForEditor } from "@/server/moderation/words";
import { loadSurveyDesk } from "@/server/survey/service";

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
  searchParams: Promise<{ error?: string; ok?: string; count?: string; missed?: string; tab?: string; year?: string }>;
}) {
  const query = await searchParams;
  const account = await loadAccountPage();
  const status = note(query.ok, query.count, query.missed);
  const tabs: Array<{ id: string; label: string; panel: ReactNode }> = [];
  if (account.user && showsPeopleSettings(account.role)) {
    const year = seasonYear(query.year);
    tabs.push(
      { id: "roster", label: "교인", panel: <RosterWork /> },
      { id: "group", label: "모임", panel: <GroupWork year={year} scope="account" /> },
      { id: "invite", label: "초대", panel: <InviteWork /> },
      { id: "newcomer", label: "새가족", panel: <NewcomerWork /> },
      { id: "approval", label: "승인", panel: <ApprovalWork /> },
    );
  }
  if (account.user) {
    const desk = await loadSurveyDesk();
    if (desk) tabs.push({ id: "survey", label: "설문", panel: <SurveyAccountSettings desk={desk} /> });
  }
  if (account.user && showsCommunitySettings(account.role)) {
    const churches = await loadChurchSettings();
    const banned = await loadBannedWordsForEditor();
    if (churches.ok) tabs.push({ id: "church", label: "교회", panel: <ChurchSettingsPanel churches={churches.churches} /> });
    if (banned.ok) {
      tabs.push({ id: "banned", label: "금지어", panel: <BannedWordSettings words={banned.words.map((item) => item.word).join(", ")} /> });
    }
  }
  const current = tabs.find((tab) => tab.id === query.tab) ?? tabs[0];

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
          <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <p className="font-semibold leading-snug">{account.user.name}</p>
            {account.pendingCount > 0 ? (
              <p className="leading-relaxed text-[#5c5148]">가입 승인을 기다리는 공동체가 있습니다. 승인이 나기 전에는 정식 일을 할 수 없습니다.</p>
            ) : null}
          </section>
          {showsOwnPickup(account.role) ? <OwnPickupSettings /> : null}
          {current ? (
            <div className="grid gap-4">
              <nav role="tablist" aria-label="계정 설정" data-testid="account-tabs" className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <Link
                    key={tab.id}
                    href={`/account?tab=${tab.id}`}
                    role="tab"
                    aria-selected={tab.id === current.id}
                    className={`rounded-full px-3 py-2 text-sm font-semibold ${tab.id === current.id ? "bg-[#111827] text-white" : "bg-[#fffaf3] text-[#475569]"}`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>
              <div role="tabpanel">{current.panel}</div>
            </div>
          ) : null}
          <form action={logoutAction} data-testid="account-logout" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <SubmitButton termKey="logout" />
          </form>
        </div>
      ) : (
        <div className="grid gap-6">
          <section className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <SocialLoginButtons />
          </section>
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
