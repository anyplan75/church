import Link from "next/link";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermText } from "@/components/term-text";
import { applyJoinAction } from "@/server/community/actions";
import { loadAccountPage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const account = await loadAccountPage();
  return (
    <section className="grid gap-4">
      <h1 className="page-title text-[clamp(1.6rem,1.2rem+1vw,2.2rem)] leading-tight">
        <TermText termKey="apply_join" />
      </h1>
      <p className="leading-relaxed text-[#5c5148]">
        초대 코드가 맞고 교단이 같아야 신청이 됩니다. 관리자가 승인하기 전에는 정식 구성원이 아닙니다.
      </p>
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {account.user ? (
        <form action={applyJoinAction} id="join-form" className="grid gap-3">
          <TermField termKey="field_name" name="name" required defaultValue={account.user.name} />
          <TermField termKey="field_invite" name="code" required />
          <TermField termKey="field_denomination" name="denomination" required />
          <TermField termKey="field_phone" name="phone" required autoComplete="tel" />
          <SubmitButton termKey="apply_join" />
        </form>
      ) : (
        <p className="leading-relaxed">
          <Link href="/account" className="font-semibold text-[#1d6b45]">
            먼저 계정을 만들어 주세요.
          </Link>
        </p>
      )}
    </section>
  );
}
