import { AccessScreen } from "@/components/access-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { InviteWork } from "@/components/account-work";
import { TermHeading } from "@/components/term-heading";
import { loadInvitePage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadInvitePage();
  if (!page.ok) return <AccessScreen />;
  return (
    <section className="grid gap-4">
      <TermHeading termKey="invite" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <InviteWork />
    </section>
  );
}
