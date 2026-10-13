import { setupAccount } from "@/lib/account-actions";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "처음 계정 · 예배 운영" };

const ERRORS: Record<string, string> = {
  email: "이메일 형식을 확인해 주세요.",
  short: "비밀번호는 8자 이상으로 만들어 주세요.",
  confirm: "비밀번호가 서로 다릅니다.",
};

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;

  return (
    <div className="page max-w-md">
      <p className="text-sm font-semibold text-gold">처음 사용</p>
      <h1 className="mt-1 font-serif text-4xl">계정 만들기</h1>
      <p className="mt-2 text-muted">아직 계정이 없습니다. 이메일과 비밀번호를 만들면 모든 역할을 받습니다. 다음부터는 로그인해야 합니다.</p>
      {query.error ? <p className="mt-4 text-sm text-wine">{ERRORS[query.error] ?? "계정을 만들지 못했습니다."}</p> : null}
      <form action={setupAccount} className="card mt-6 space-y-4 p-5">
        <label className="field">
          <span>이메일</span>
          <input className="input" name="email" type="email" autoComplete="email" maxLength={120} required placeholder="name@church.org" />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={200} required />
        </label>
        <label className="field">
          <span>비밀번호 확인</span>
          <input className="input" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={200} required />
        </label>
        <SubmitButton>계정 만들고 들어가기</SubmitButton>
      </form>
    </div>
  );
}
