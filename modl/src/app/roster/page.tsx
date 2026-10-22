import { BlockedScreen } from "@/components/blocked-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { RosterWork } from "@/components/account-work";
import { TermHeading } from "@/components/term-heading";
import { loadRosterPage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadRosterPage();
  if (!page.ok) return <BlockedScreen />;

  return (
    <section className="grid gap-4">
      <TermHeading termKey="roster" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <RosterWork />
    </section>
  );
}
