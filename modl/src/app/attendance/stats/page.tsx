import { TermHeading } from "@/components/term-heading";
import { loadAttendanceStats } from "@/server/attendance/service";
import type { RateBar } from "@/attendance/rules";
import type { TermKey } from "@/theme/dictionary";

export const dynamic = "force-dynamic";

function Bars({ termKey, bars }: { termKey: TermKey; bars: RateBar[] }) {
  return (
    <section className="grid min-w-0 gap-3">
      <TermHeading termKey={termKey} level={2} />
      {bars.length === 0 ? (
        <p className="leading-relaxed">아직 출석 기록이 없습니다.</p>
      ) : (
        <ul className="grid gap-3">
          {bars.map((bar) => (
            <li key={bar.key} data-testid="stats-bar" className="grid gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 leading-snug">
                <span className="break-words">{bar.label}</span>
                <span className="font-semibold">{bar.rate}%</span>
              </div>
              <div className="h-3 rounded-full bg-[#efe4d6]" aria-hidden="true">
                <div className="h-3 rounded-full bg-[#1d6b45]" style={{ width: `${bar.rate}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AttendanceStatsPage() {
  const page = await loadAttendanceStats();
  return (
    <section className="grid min-w-0 gap-6">
      <TermHeading termKey="attendance_stats" level={1} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">
            {page.scope === "community" ? "공동체 전체 출석입니다." : "맡은 모들 식구의 출석입니다."} 사유 결석은 비율에서 뺍니다.
          </p>
          <Bars termKey="stats_week" bars={page.week} />
          <Bars termKey="stats_month" bars={page.month} />
          <Bars termKey="stats_year" bars={page.year} />
        </>
      )}
    </section>
  );
}
