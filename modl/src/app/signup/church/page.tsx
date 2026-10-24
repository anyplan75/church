import { redirect } from "next/navigation";
import { ErrorNote } from "@/components/form-note";
import { SignupChurchForm } from "@/components/signup-church-form";
import { loadSignupChurchPage } from "@/server/map/board";

export const dynamic = "force-dynamic";

export default async function SignupChurchPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const page = await loadSignupChurchPage();
  if (!page.signedIn) redirect("/account");
  if (page.alreadyChosen) redirect("/");

  return (
    <section className="grid gap-4" data-testid="signup-church">
      <h1 className="page-title text-[clamp(1.45rem,1.1rem+0.85vw,2rem)] leading-tight">다니는 교회</h1>
      <p className="leading-relaxed text-[#5c5148]">가입이 끝났습니다. 다니는 교회를 아래에 등록합니다.</p>
      <ErrorNote message={query.error} />
      <SignupChurchForm />
    </section>
  );
}
