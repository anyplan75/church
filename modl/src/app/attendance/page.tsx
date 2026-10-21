import Link from "next/link";
import { BlockedScreen } from "@/components/blocked-screen";
import { DepartmentField } from "@/components/choice-fields";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { createSessionAction } from "@/server/attendance/actions";
import { loadAttendanceHome } from "@/server/attendance/service";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadAttendanceHome();
  if (!page.ok) return <BlockedScreen />;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="attendance" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
          {page.cards.length > 0 ? (
            <div className="grid gap-2">
              <TermHeading termKey="long_term_absentee" level={2} />
              <ul className="grid gap-2">
                {page.cards.map((card) => (
                  <li key={card.memberId} data-testid="absence-card" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                    <p className="break-words font-semibold">{card.name}</p>
                    <p className="text-[#5c5148]">최근 출석 모임에서 사유 없는 결석이 세 번 이어졌습니다.</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {page.canSeeStats ? (
            <Link href="/attendance/stats" className="inline-flex w-fit max-w-full rounded-2xl bg-[#fffaf3] px-4 py-3 font-semibold leading-snug">
              <TermText termKey="attendance_stats" />
            </Link>
          ) : null}
          {page.canCreate ? (
            <form action={createSessionAction} id="session-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <DepartmentField />
              <TermField termKey="field_session_title" name="title" required />
              <TermField termKey="field_session_date" name="sessionDate" type="date" required />
              <SubmitButton termKey="create_session" />
            </form>
          ) : (
            <p className="leading-relaxed text-[#5c5148]">출석 모임은 사역자와 임원만 만듭니다. 구성원은 QR 경로에서 본인 출석을 남깁니다.</p>
          )}
          {page.sessions.length === 0 ? (
            <p className="leading-relaxed">아직 출석 모임이 없습니다.</p>
          ) : (
            <ul className="grid gap-2">
              {page.sessions.map((session) => (
                <li key={session.id}>
                  <Link href={`/attendance/session/${session.id}`} className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                    <span className="text-[#5c5148]">{session.sessionDate}</span>
                    <span className="break-words font-semibold" data-testid="session-title">
                      {session.title}
                    </span>
                    <TermText termKey={session.departmentType === "YOUTH" ? "dept_youth" : "dept_school"} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
    </section>
  );
}
