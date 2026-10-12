import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { formatKoreanDate, formatTime } from "@/lib/format";
import { readDb } from "@/lib/store";
import { assignmentProgress, preacherName, splitServices, todayISO } from "@/lib/worship";
import type { Person, Service } from "@/lib/types";

export const metadata = { title: "예배 목록 · 예배 운영" };

export default function ServicesPage() {
  const db = readDb();
  const today = todayISO();
  const { upcoming, past } = splitServices(db.services, today);

  return (
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">예배</h1>
          <p className="mt-2 text-muted">순서를 준비하고, 마친 예배를 다시 볼 수 있습니다.</p>
        </div>
        <Link href="/services/new" className="btn btn-primary">
          예배 만들기
        </Link>
      </div>

      <ServiceSection title="예정" empty="예정된 예배가 없습니다." services={upcoming} people={db.people} today={today} />
      <ServiceSection title="지난 예배" empty="아직 마친 예배가 없습니다." services={past} people={db.people} today={today} />
    </div>
  );
}

function ServiceSection({
  title,
  empty,
  services,
  people,
  today,
}: {
  title: string;
  empty: string;
  services: Service[];
  people: Person[];
  today: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl">{title}</h2>
      {services.length === 0 ? <p className="mt-3 text-muted">{empty}</p> : null}
      <div className="mt-4 grid gap-3">
        {services.map((service) => {
          const progress = assignmentProgress(service);
          const preacher = preacherName(service, people);
          return (
            <Link key={service.id} href={`/services/${service.id}`} className="card block p-5 hover:border-pine/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">
                    {formatKoreanDate(service.date)} · {formatTime(service.time)} · {service.place}
                  </p>
                  <h3 className="mt-1 font-serif text-2xl">{service.title}</h3>
                  <p className="mt-2 text-sm text-muted">
                    {preacher ? `설교 ${preacher}` : "설교자 미정"}
                    {progress.total ? ` · 담당 ${progress.assigned}/${progress.total}` : ""}
                    {service.date < today && service.status !== "done" && service.status !== "live" ? " · 날짜가 지났습니다" : ""}
                  </p>
                </div>
                <StatusBadge status={service.status} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
