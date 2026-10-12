import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { formatKoreanDate, formatTime } from "@/lib/format";
import { readDb } from "@/lib/store";
import { itemAside, preacherName } from "@/lib/worship";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const service = readDb().services.find((item) => item.id === id);
  return { title: service ? `${service.title} 주보 · 예배 운영` : "주보" };
}

export default async function BulletinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = readDb();
  const service = db.services.find((item) => item.id === id);
  if (!service) notFound();
  const sermon = service.items.find((item) => item.kind === "sermon");
  const preacher = preacherName(service, db.people);
  const announcements = service.announcements.filter((announcement) => announcement.text.trim());

  return (
    <div className="page">
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Link href={`/services/${service.id}`} className="btn btn-quiet">
          순서 편집
        </Link>
        <PrintButton />
      </div>
      <article className="bulletin card mx-auto max-w-3xl px-6 py-10 md:px-12">
        <p className="text-center text-sm font-semibold text-gold">{db.settings.churchName}</p>
        <h1 className="mt-3 text-center font-serif text-4xl">{service.title}</h1>
        {sermon?.note ? <p className="mt-4 text-center font-serif text-2xl">{sermon.note}</p> : null}
        <p className="mt-3 text-center text-muted">
          {formatKoreanDate(service.date)} · {formatTime(service.time)} · {service.place}
        </p>
        {preacher || sermon?.scripture ? (
          <p className="mt-2 text-center">
            {[preacher ? `설교 ${preacher}` : "", sermon?.scripture ?? ""].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        <h2 className="mt-10 text-center font-serif text-xl">예배 순서</h2>
        <ol className="mt-4">
          {service.items.map((item, index) => (
            <li key={item.id} className="py-2">
              <div className="leader">
                <span className="shrink-0">
                  {index + 1}. {item.title}
                </span>
                <span className="leader-line" />
                <span className="shrink-0 text-right">{itemAside(item, db.people, db.songs)}</span>
              </div>
              {item.note && item.kind !== "sermon" ? <p className="pl-5 text-sm text-muted">{item.note}</p> : null}
            </li>
          ))}
        </ol>

        {announcements.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-center font-serif text-xl">광고</h2>
            <ul className="mt-4 space-y-2">
              {announcements.map((announcement) => (
                <li key={announcement.id}>{announcement.text}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </div>
  );
}
