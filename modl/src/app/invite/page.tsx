import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { issueInviteAction } from "@/server/community/actions";
import { loadInvitePage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadInvitePage();
  return (
    <section className="grid gap-4">
      <TermHeading termKey="invite" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.community.name}</p>
          <form action={issueInviteAction} id="invite-form" className="grid gap-3">
            <TermField termKey="issue_invite" name="maxUses" type="number" />
            <SubmitButton termKey="issue_invite" />
          </form>
          <ul className="grid gap-2">
            {page.data.codes.map((code) => (
              <li key={code.id} data-testid="invite-code" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                <span className="block font-semibold">{code.code}</span>
                <span className="block text-[#5c5148]">
                  쓴 횟수 {code.useCount}
                  {code.maxUses ? ` / ${code.maxUses}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
