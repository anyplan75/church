import { BlockedScreen } from "@/components/blocked-screen";
import { ApprovalWork } from "@/components/account-work";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermHeading } from "@/components/term-heading";
import { loadApprovalPage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadApprovalPage();
  if (!page.ok) return <BlockedScreen />;
  const replyNote = query.ok === "reply_approved" ? "답글을 승인했습니다." : "";
  return (
    <section className="grid gap-4">
      <TermHeading termKey="approval" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {replyNote ? (
        <p role="status" className="rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed">
          {replyNote}
        </p>
      ) : null}
      <ApprovalWork />
    </section>
  );
}
