import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermText } from "@/components/term-text";
import { loginAction, logoutAction, signupAction } from "@/server/community/actions";
import { loadAccountPage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const account = await loadAccountPage();

  return (
    <section className="grid gap-6">
      <h1 className="page-title text-[clamp(1.6rem,1.2rem+1vw,2.2rem)] leading-tight">
        <TermText termKey="account" />
      </h1>
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {account.user ? (
        <form action={logoutAction} className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
          <p className="font-semibold leading-snug">{account.user.name}</p>
          {account.pendingCount > 0 ? (
            <p className="leading-relaxed text-[#5c5148]">가입 승인을 기다리는 공동체가 있습니다. 승인이 나기 전에는 정식 일을 할 수 없습니다.</p>
          ) : null}
          <SubmitButton termKey="logout" />
        </form>
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
