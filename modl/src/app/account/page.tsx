import type { ReactNode } from "react";
import Link from "next/link";
import { showsChurchManager, showsGatheringManager, showsOwnPickup, showsPeopleSettings, showsSignupList, showsSiteOperator } from "@/account/access";
import { ApprovalWork, GroupWork, InviteWork, NewcomerWork, RosterWork, seasonYear } from "@/components/account-work";
import { BannedWordSettings, OwnPickupSettings, SurveyAccountSettings } from "@/components/account-settings";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermText } from "@/components/term-text";
import { PlaceAccount } from "@/components/place-account";
import { loadPlaceAccount } from "@/server/place/service";
import { SignupPeople } from "@/components/signup-people";
import { SocialLoginButtons } from "@/components/social-login";
import { loadPendingSignup } from "@/server/login/access";
import { completeSocialSignup } from "@/server/login/oauth-actions";
import { ACCOUNT_DELETE_CONFIRM } from "@/account/delete-rules";
import { deleteAccountAction, loginAction, logoutAction, signupAction } from "@/server/community/actions";
import { loadAccountPage, loadSignupPeople } from "@/server/community/service";
import { loadBannedWordsForEditor } from "@/server/moderation/words";
import { loadSurveyDesk } from "@/server/survey/service";

export const dynamic = "force-dynamic";

function note(ok: string | undefined, count: string | undefined, missed: string | undefined): string {
  if (ok === "church") return "교회를 저장했습니다.";
  if (ok === "removed") return "교회를 지웠습니다.";
  if (ok === "missed") return "교회는 저장했지만, 주소를 지도에서 찾지 못해 핀은 없습니다.";
  if (ok === "banned") return "금지어를 저장했습니다.";
  if (ok === "banned-removed") return "금지어를 지웠습니다.";
  if (ok === "church-follow") return "교회를 구독했습니다.";
  if (ok === "church-current") return "내가 갈 교회를 바꿨습니다.";
  if (ok === "church-left") return "교회 구독을 뺐습니다.";
  if (ok === "gathering") return "모들을 만들었습니다.";
  if (ok === "gathering-follow") return "모들을 구독했습니다.";
  if (ok === "gathering-current") return "내가 갈 모들을 바꿨습니다.";
  if (ok === "gathering-left") return "모들 구독을 뺐습니다.";
  if (ok === "grant") return "수정 권한을 주었습니다.";
  if (ok === "revoke") return "수정 권한을 뺐습니다.";
  if (ok === "steward") return "관리자를 지정했습니다.";
  if (ok === "address") return "내 주소를 저장했습니다.";
  if (ok === "deleted") return "계정을 지웠습니다. 이 이메일로는 다시 들어오지 못합니다.";
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
  searchParams: Promise<{ error?: string; ok?: string; count?: string; missed?: string; tab?: string; year?: string; church?: string; gathering?: string }>;
}) {
  const query = await searchParams;
  const account = await loadAccountPage();
  const pending = account.user ? null : await loadPendingSignup();
  const signupPeople = account.user && showsSignupList(account.role) ? await loadSignupPeople() : null;
  const status = note(query.ok, query.count, query.missed);
  const place = account.user ? await loadPlaceAccount(query.church ?? "", query.gathering ?? "") : null;
  const churchSteward = place?.churches.some((item) => item.steward) ?? false;
  const gatheringSteward = place?.gatherings.some((item) => item.steward) ?? false;
  const desk = account.user ? await loadSurveyDesk() : null;
  const churchManager = account.user ? showsChurchManager({ role: account.role, churchSteward }) : false;
  const gatheringManager = account.user
    ? showsGatheringManager({ role: account.role, gatheringSteward }) || Boolean(desk && !churchManager)
    : false;
  const siteOperator = showsSiteOperator(account.role);
  const year = seasonYear(query.year);
  const tabs: Array<{ id: string; label: string; panel: ReactNode }> = [];
  if (account.user && place) {
    tabs.push({
      id: "places",
      label: "교회·모들",
      panel: <PlaceAccount place={place} part="personal" churchQuery={query.church ?? ""} gatheringQuery={query.gathering ?? ""} />,
    });
  }
  if (account.user && siteOperator) {
    const banned = await loadBannedWordsForEditor();
    tabs.push({
      id: "site",
      label: "사이트운영자",
      panel: (
        <div className="grid gap-4">
          {signupPeople ? <SignupPeople people={signupPeople} /> : null}
          {banned.ok ? <BannedWordSettings words={banned.words.map((item) => item.word).join(", ")} /> : null}
          {place ? <PlaceAccount place={place} part="site" churchQuery={query.church ?? ""} gatheringQuery={query.gathering ?? ""} /> : null}
          <Link href="/account/places" data-testid="operator-places-link" className="w-fit rounded-2xl bg-[#111827] px-4 py-3 font-semibold text-white">
            교회와 모들 전체 수정
          </Link>
          <Link href="/guide-inbox" data-testid="guide-inbox-link" className="w-fit rounded-2xl border border-[#e4d8c8] bg-white px-4 py-3 font-semibold">
            메일로 온 안내 승인
          </Link>
        </div>
      ),
    });
  }
  if (account.user && gatheringManager && place) {
    tabs.push({
      id: "gathering",
      label: "모들 관리자",
      panel: (
        <div className="grid gap-4">
          <PlaceAccount place={place} part="gathering" churchQuery={query.church ?? ""} gatheringQuery={query.gathering ?? ""} />
          {showsPeopleSettings(account.role) ? <GroupWork year={year} /> : null}
          {desk && !churchManager ? <SurveyAccountSettings desk={desk} /> : null}
        </div>
      ),
    });
  }
  if (account.user && churchManager && place) {
    tabs.push({
      id: "church",
      label: "교회 관리자",
      panel: (
        <div className="grid gap-4">
          <PlaceAccount place={place} part="church" churchQuery={query.church ?? ""} gatheringQuery={query.gathering ?? ""} />
          {showsPeopleSettings(account.role) ? (
            <>
              <RosterWork />
              <InviteWork />
              <NewcomerWork />
              <ApprovalWork />
            </>
          ) : null}
          {desk ? <SurveyAccountSettings desk={desk} /> : null}
        </div>
      ),
    });
  }
  const asked = query.tab === "group" ? "gathering" : query.tab === "banned" || query.tab === "sheet" ? "site" : query.tab === "roster" || query.tab === "invite" || query.tab === "newcomer" || query.tab === "approval" || query.tab === "survey" ? "church" : query.tab;
  const current = tabs.find((tab) => tab.id === asked) ?? tabs[0];

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
        <div className="grid gap-8">
          <section data-testid="personal-settings" className="grid w-full gap-4">
            <h2 className="text-lg font-semibold leading-snug">개인설정</h2>
            <p className="font-semibold leading-snug">{account.user.name}</p>
            {showsOwnPickup(account.role) ? <OwnPickupSettings /> : null}
          </section>
          {current ? (
            <div className="grid w-full gap-4" data-testid="account-tabs">
              <nav role="tablist" aria-label="계정 내용" data-testid="account-role-tabs" className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const params = new URLSearchParams({ tab: tab.id });
                  if (query.church) params.set("church", query.church);
                  if (query.gathering) params.set("gathering", query.gathering);
                  if (query.year) params.set("year", query.year);
                  return (
                    <Link
                      key={tab.id}
                      href={`/account?${params}`}
                      role="tab"
                      aria-selected={tab.id === current.id}
                      className={`rounded-full px-3 py-2 text-sm font-semibold ${tab.id === current.id ? "bg-[#111827] text-white" : "bg-[#fffaf3] text-[#475569]"}`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </nav>
              <div role="tabpanel">{current.panel}</div>
            </div>
          ) : null}
          <form action={logoutAction} data-testid="account-logout" className="grid w-full gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <SubmitButton termKey="logout" />
          </form>
          <details data-testid="account-delete" className="w-full">
            <summary className="w-fit cursor-pointer list-none rounded-2xl border border-[#b45309] bg-white px-4 py-3 font-semibold text-[#9a3412] [&::-webkit-details-marker]:hidden">
              계정 삭제
            </summary>
            <div>
              <form action={deleteAccountAction} className="mt-3 grid max-w-xl gap-3">
                <p className="leading-relaxed text-[#5c5148]">
                  이메일, 비밀번호, 전화번호와 내가 쓴 글, 기도, 묵상을 지웁니다. 교회가 적어 둔 안내와 재정 내역은 남습니다. 지운 뒤에는 이 계정으로 다시 들어오지 못합니다.
                </p>
                <label className="grid gap-1">
                  <span className="font-semibold">확인</span>
                  <input
                    name="confirm"
                    required
                    autoComplete="off"
                    data-testid="account-delete-confirm"
                    placeholder={ACCOUNT_DELETE_CONFIRM}
                    className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
                  />
                </label>
                <p className="leading-relaxed text-[#5c5148]">확인 칸에 「{ACCOUNT_DELETE_CONFIRM}」라고 적어 주세요.</p>
                <button
                  type="submit"
                  data-testid="account-delete-submit"
                  className="w-fit rounded-2xl border border-[#b45309] bg-white px-4 py-3 font-semibold text-[#9a3412]"
                >
                  계정을 지우기
                </button>
              </form>
            </div>
          </details>
        </div>
      ) : (
        <div className="grid gap-6">
          {pending ? (
            <form action={completeSocialSignup} id="signup-missing" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <p className="leading-relaxed">가입을 마치려면 비어 있는 칸만 적어 주세요.</p>
              {pending.needGender ? (
                <label className="grid gap-1">
                  <span className="font-semibold">
                    <TermText termKey="field_gender" />
                  </span>
                  <select name="gender" required className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug">
                    <option value="">선택</option>
                    <option value="male">남</option>
                    <option value="female">여</option>
                  </select>
                </label>
              ) : null}
              {pending.needPhone ? <TermField termKey="field_phone" name="phone" type="tel" required autoComplete="tel" /> : null}
              <SubmitButton termKey="signup" />
            </form>
          ) : null}
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
            <label className="grid gap-1">
              <span className="font-semibold">
                <TermText termKey="field_gender" />
              </span>
              <select
                name="gender"
                required
                data-testid="signup-gender"
                className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
              >
                <option value="">선택</option>
                <option value="male">남</option>
                <option value="female">여</option>
              </select>
            </label>
            <TermField termKey="field_phone" name="phone" type="tel" required autoComplete="tel" testId="signup-phone" />
            <SubmitButton termKey="signup" />
          </form>
        </div>
      )}
    </section>
  );
}
