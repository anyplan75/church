import { ErrorNote, OkNote } from "@/components/form-note";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { reviewApprovalAction } from "@/server/community/actions";
import { loadApprovalPage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadApprovalPage();
  return (
    <section className="grid gap-4">
      <TermHeading termKey="approval" level={1} />
      <p className="leading-relaxed text-[#5c5148]">승인 대기 중에는 정식 구성원 권한이 없습니다.</p>
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <ul className="grid gap-3">
          {page.data.requests.map((request) => (
            <li key={request.id} className="grid gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
              <span className="font-semibold">{request.applicantName}</span>
              <span>{request.applicantContact}</span>
              <span className="text-[#5c5148]">{request.status}</span>
              {request.status === "PENDING" ? (
                <form action={reviewApprovalAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="requestId" value={request.id} />
                  <button
                    type="submit"
                    name="decision"
                    value="APPROVED"
                    className="rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold text-white"
                  >
                    <TermText termKey="approve_member" />
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="REJECTED"
                    className="rounded-2xl border border-[#e4d8c8] bg-white px-4 py-3 font-semibold"
                  >
                    <TermText termKey="reject_member" />
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
