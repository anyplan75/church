import Link from "next/link";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { markAttendanceAction } from "@/server/attendance/actions";
import { loadSession } from "@/server/attendance/service";
import type { TermKey } from "@/theme/dictionary";

export const dynamic = "force-dynamic";

const STATUS_TERM = {
  PRESENT: "mark_present",
  LATE: "mark_late",
  ABSENT: "mark_absent",
  EXCUSED: "mark_excused",
} as const;

function StatusLabel({ status }: { status: keyof typeof STATUS_TERM | null }) {
  if (!status) return <span className="text-[#5c5148]">아직 기록 없음</span>;
  return <TermText termKey={STATUS_TERM[status]} />;
}

export default async function AttendanceSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = await loadSession(id);

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="attendance" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="break-words text-[clamp(1.15rem,1rem+0.4vw,1.4rem)] font-semibold leading-snug">{page.session.title}</p>
          <p className="leading-relaxed text-[#5c5148]">
            {page.session.sessionDate} · <TermText termKey={page.session.departmentType === "YOUTH" ? "dept_youth" : "dept_school"} />
          </p>
          <p className="break-all leading-relaxed" data-testid="qr-path">
            <Link href={page.session.qrPath} className="font-semibold text-[#1d6b45]">
              {page.session.qrPath}
            </Link>
          </p>
          {!page.showRoll ? (
            <p className="leading-relaxed">본인 출석은 위 QR 경로에서 남깁니다. 다른 식구의 출석은 테우리, 임원, 사역자가 고칩니다.</p>
          ) : (
            <ul className="grid gap-3">
              {page.rows.map((row) => (
                <li key={row.memberId} data-testid="member-row" data-member-name={row.name} className="grid gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3">
                  <p className="break-words font-semibold leading-snug">{row.name}</p>
                  <p className="leading-snug">
                    <StatusLabel status={row.status} />
                  </p>
                  {row.canEdit ? (
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(STATUS_TERM) as Array<keyof typeof STATUS_TERM>).map((status) => (
                        <form key={status} action={markAttendanceAction}>
                          <input type="hidden" name="sessionId" value={page.session.id} />
                          <input type="hidden" name="memberId" value={row.memberId} />
                          <input type="hidden" name="status" value={status} />
                          <SubmitButton termKey={STATUS_TERM[status] as TermKey} testId={`mark-${status}`} />
                        </form>
                      ))}
                    </div>
                  ) : (
                    <p className="leading-relaxed text-[#5c5148]">다른 모들 식구라 이 화면에서 고치지 않습니다.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
