import Link from "next/link";
import { AccessScreen } from "@/components/access-screen";
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
  searchParams: Promise<{ error?: string; ok?: string; pick?: string; church?: string; group?: string }>;
}) {
  const query = await searchParams;
  const page = await loadAttendanceHome({ churchId: query.church, groupId: query.group });
  if (!page.ok) return <AccessScreen />;
  const churchQuery = page.selectedChurchId ? `&church=${page.selectedChurchId}` : "";
  const groupQuery = page.selectedGroupId ? `&group=${page.selectedGroupId}` : "";

  return (
    <section className="grid min-w-0 gap-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/attendance?pick=church${churchQuery}${groupQuery}`}
          data-testid="church-attendance"
          className={`rounded-2xl px-4 py-3 font-semibold leading-snug ${query.pick === "church" ? "bg-[#1d6b45] text-white" : "bg-[#fffaf3]"}`}
        >
          교회출석
        </Link>
        <Link
          href={`/attendance?pick=group${churchQuery}${groupQuery}`}
          data-testid="group-attendance"
          className={`rounded-2xl px-4 py-3 font-semibold leading-snug ${query.pick === "group" ? "bg-[#1d6b45] text-white" : "bg-[#fffaf3]"}`}
        >
          모들출석
        </Link>
      </div>
      {query.pick === "church" ? (
        <ul className="grid gap-2" data-testid="church-attendance-list">
          {page.churches.length === 0 ? <li className="leading-relaxed">속한 교회가 없습니다.</li> : null}
          {page.churches.map((church) => (
            <li key={church.id}>
              <Link
                href={`/attendance?pick=church&church=${church.id}`}
                data-testid="attendance-church"
                aria-current={page.selectedChurchId === church.id ? "true" : undefined}
                className={`block rounded-2xl px-4 py-3 font-semibold leading-snug ${page.selectedChurchId === church.id ? "bg-[#1d6b45] text-white" : "bg-[#fffaf3]"}`}
              >
                {church.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {query.pick === "group" ? (
        <ul className="grid gap-2" data-testid="group-attendance-list">
          {page.groups.length === 0 ? <li className="leading-relaxed">속한 모들이 없습니다.</li> : null}
          {page.groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/attendance?pick=group&group=${group.id}&church=${group.communityId}`}
                data-testid="attendance-group"
                aria-current={page.selectedGroupId === group.id ? "true" : undefined}
                className={`block rounded-2xl px-4 py-3 font-semibold leading-snug ${page.selectedGroupId === group.id ? "bg-[#1d6b45] text-white" : "bg-[#fffaf3]"}`}
              >
                {group.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <section className="grid gap-2" data-testid="my-attendance">
        <h2 className="text-lg font-semibold leading-snug">나의 출석현황</h2>
        {page.mine.length === 0 ? (
          <p className="leading-relaxed">아직 출석 기록이 없습니다.</p>
        ) : (
          <ul className="grid gap-2">
            {page.mine.map((row) => (
              <li key={row.id} className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                <span className="text-[#5c5148]">{row.sessionDate}</span>
                <span className="break-words font-semibold">{row.title}</span>
                <span>{row.statusLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        <Link href="/attendance/stats" data-testid="attendance-rate" className="rounded-2xl bg-[#fffaf3] px-4 py-3 font-semibold leading-snug">
          출석률 {page.rate}%
        </Link>
        <Link href="/group" data-testid="make-group" className="rounded-2xl bg-[#fffaf3] px-4 py-3 font-semibold leading-snug">
          모들 만들기
        </Link>
      </div>
      <section className="grid gap-2 rounded-3xl bg-[#fffaf3] px-4 py-4" data-testid="attendance-bulletin">
        <h2 className="font-semibold leading-snug">주보</h2>
        {page.selectedChurchId ? (
          <>
            {page.bulletins.length === 0 ? (
              <p className="leading-relaxed">아직 주보가 없습니다.</p>
            ) : (
              <ul className="grid gap-2">
                {page.bulletins.map((bulletin) => (
                  <li key={bulletin.id}>
                    <Link href={`/bulletin/${bulletin.id}`} className="grid gap-1 leading-snug">
                      <span className="text-[#5c5148]">
                        {[bulletin.worshipDate, bulletin.serviceLabel, bulletin.serviceTime].filter(Boolean).join(" · ")}
                      </span>
                      <span className="break-words font-semibold">{bulletin.sermonTitle || bulletin.serviceLabel || "주보"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/worship?church=${page.selectedChurchId}`}
              data-testid="go-worship"
              className="inline-flex w-fit rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold leading-snug text-white"
            >
              예배 드리기
            </Link>
          </>
        ) : (
          <p className="leading-relaxed">교회를 선택하라</p>
        )}
      </section>
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
    </section>
  );
}
