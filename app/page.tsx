import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { formatKoreanDate, formatMonthDay, formatTime, formatWeekday, relativeDay } from "@/lib/format";
import { requireScreen } from "@/lib/guard";
import { can, primaryServiceHref, serviceDestinations } from "@/lib/roles";
import { readDb } from "@/lib/store";
import { addDays, clampLiveIndex, mondayOf, nextService, preacherName, todayISO, weekServices } from "@/lib/worship";

export default async function HomePage() {
  const user = await requireScreen("screen.week");
  const prepare = can(user.roles, "screen.prepare");
  const create = can(user.roles, "screen.new");
  const editor = can(user.roles, "screen.editor");
  const liveScreen = can(user.roles, "screen.live");
  const bulletin = can(user.roles, "screen.bulletin");
  const output = can(user.roles, "screen.output");
  const db = readDb();
  const todayText = todayISO();
  const start = mondayOf(todayText);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const week = weekServices(db.services, todayText);
  const next = nextService(db.services, todayText);
  const live = next?.status === "live";
  const current = next && live ? next.items[clampLiveIndex(next.liveIndex, next.items.length)] : undefined;

  return (
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gold">이번 주</p>
          <h1 className="mt-1 font-serif text-4xl">{formatKoreanDate(todayText)}</h1>
          <p className="mt-2 text-muted">
            {formatMonthDay(start)} – {formatMonthDay(days[6])} · 예배 {week.length}번
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {prepare ? (
            <Link href="/prepare" className="btn btn-quiet">
              예배 준비
            </Link>
          ) : null}
          {create ? (
            <Link href="/services/new" className="btn btn-primary">
              예배 만들기
            </Link>
          ) : null}
        </div>
      </div>

      {next ? (
        <section className={live ? "card card-live mt-8 p-6 md:p-8" : "card mt-8 p-6 md:p-8"}>
          <p className={live ? "text-sm text-[#d9d0c2]" : "text-sm text-gold"}>{live ? "지금 진행 중" : "다음 예배"}</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-4xl">{next.title}</h2>
              <p className={`mt-3 ${live ? "text-[#d9d0c2]" : "text-muted"}`}>
                {formatKoreanDate(next.date)} {relativeDay(next.date, todayText) ? `· ${relativeDay(next.date, todayText)}` : ""} · {formatTime(next.time)} · {next.place}
              </p>
              {preacherName(next, db.people) ? (
                <p className={`mt-1 ${live ? "text-[#f3e6cf]" : "text-ink"}`}>설교 {preacherName(next, db.people)}</p>
              ) : null}
              {current ? <p className="mt-4 text-xl">지금 순서 · {current.title}</p> : null}
            </div>
            <StatusBadge status={next.status} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {liveScreen ? (
              <Link href={`/services/${next.id}/live`} className={live ? "btn btn-light" : "btn btn-primary"}>
                진행 화면
              </Link>
            ) : null}
            {editor ? (
              <Link href={`/services/${next.id}`} className={live ? "btn btn-on-dark" : "btn btn-quiet"}>
                순서 편집
              </Link>
            ) : null}
            {output ? (
              <Link href={`/services/${next.id}/output`} target="_blank" className={live ? "btn btn-on-dark" : "btn btn-quiet"}>
                송출 화면
              </Link>
            ) : null}
            {bulletin ? (
              <Link href={`/services/${next.id}/bulletin`} className={live ? "btn btn-on-dark" : "btn btn-quiet"}>
                주보
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="card mt-8 px-6 py-10">
          <h2 className="font-serif text-3xl">예정된 예배가 없습니다</h2>
          <p className="mt-2 text-muted">순서를 만들고 담당을 정한 뒤, 예배 중에 진행 화면으로 넘기면 됩니다.</p>
          {create ? (
            <Link href="/services/new" className="btn btn-primary mt-5">
              첫 예배 만들기
            </Link>
          ) : null}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-2xl">일주일</h2>
        <div className="mt-3">
          {days.map((day) => {
            const services = week.filter((service) => service.date === day);
            return (
              <div key={day} className={day === todayText ? "day day-today" : "day"}>
                <div className="day-meta">
                  <div>
                    <p className="text-sm text-muted">{formatWeekday(day)}</p>
                    <p className="font-serif text-3xl leading-none">{Number(day.slice(8))}</p>
                  </div>
                  {create ? (
                    <Link href={`/services/new?date=${day}`} className="btn btn-quiet btn-small day-add-mobile">
                      추가
                    </Link>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  {services.length === 0 ? <p className="text-muted">예배 없음</p> : null}
                  <div className="space-y-2">
                    {services.map((service) => {
                      const links = serviceDestinations(service.id, user.roles);
                      const primary = primaryServiceHref(service.id, user.roles);
                      const extras = editor ? [] : links.slice(1);
                      const body = (
                        <div className="service-line">
                          <div>
                            <p className="font-medium">
                              {formatTime(service.time)} {service.title}
                            </p>
                            <p className="text-sm text-muted">
                              {service.place}
                              {preacherName(service, db.people) ? ` · 설교 ${preacherName(service, db.people)}` : ""}
                            </p>
                          </div>
                          <StatusBadge status={service.status} />
                        </div>
                      );
                      if (extras.length === 0) {
                        return (
                          <Link key={service.id} href={primary} className="block rounded-xl px-3 py-2 hover:bg-white">
                            {body}
                          </Link>
                        );
                      }
                      return (
                        <div key={service.id} className="rounded-xl px-3 py-2">
                          <Link href={primary} className="block hover:bg-white">
                            {body}
                          </Link>
                          <p className="mt-1 flex flex-wrap gap-2 px-0 text-sm">
                            {extras.map((link) => (
                              <Link key={link.href} href={link.href} className="text-pine">
                                {link.label}
                              </Link>
                            ))}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {create ? (
                  <Link href={`/services/new?date=${day}`} className="btn btn-quiet btn-small day-add-desktop">
                    추가
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
