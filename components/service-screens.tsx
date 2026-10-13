"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { LiveConsole } from "@/components/live-console";
import { PrintButton } from "@/components/print-button";
import { Projector } from "@/components/projector";
import { ServiceEditor } from "@/components/service-editor";
import { SubmitButton } from "@/components/submit-button";
import { useChurch } from "@/components/church-state";
import { updateSlideFields } from "@/lib/actions";
import { updateDb } from "@/lib/app-db";
import { COPYRIGHT_NOTE } from "@/lib/checklist";
import { formatKoreanDate, formatTime } from "@/lib/format";
import { liveView } from "@/lib/live-view";
import { can } from "@/lib/roles";
import { syncReminders } from "@/lib/reminders";
import { slidesFor } from "@/lib/slides";
import { itemAside, preacherName } from "@/lib/worship";

function useServiceId(id?: string) {
  const params = useParams<{ id?: string }>();
  return id || params?.id || "";
}

export function ServiceEditorScreen({ id }: { id?: string }) {
  const serviceId = useServiceId(id);
  const { ready, user, db } = useChurch();
  useEffect(() => {
    if (!ready) return;
    updateDb((current) => {
      syncReminders(current);
    });
  }, [ready, serviceId]);
  if (!ready || !user || !db) return null;
  const service = db.services.find((item) => item.id === serviceId);
  if (!service) return <Missing />;
  return (
    <ServiceEditor
      key={service.id}
      service={service}
      people={db.people}
      songs={db.songs}
      settings={db.settings}
      reminders={db.reminders}
      access={{
        live: can(user.roles, "screen.live"),
        output: can(user.roles, "screen.output"),
        bulletin: can(user.roles, "screen.bulletin"),
      }}
    />
  );
}

export function LiveScreen({ id }: { id?: string }) {
  const serviceId = useServiceId(id);
  const { ready, user, db } = useChurch();
  if (!ready || !user || !db) return null;
  const service = db.services.find((item) => item.id === serviceId);
  if (!service) return <Missing />;
  return (
    <LiveConsole
      service={service}
      people={db.people}
      songs={db.songs}
      churchName={db.settings.churchName}
      access={{
        output: can(user.roles, "screen.output"),
        bulletin: can(user.roles, "screen.bulletin"),
        editor: can(user.roles, "screen.editor"),
      }}
    />
  );
}

export function OutputScreen({ id }: { id?: string }) {
  const serviceId = useServiceId(id);
  const { ready, db } = useChurch();
  if (!ready || !db) return null;
  const view = liveView(db, serviceId);
  if (!view) return <Missing />;
  return <Projector initial={view} />;
}

export function BulletinScreen({ id }: { id?: string }) {
  const serviceId = useServiceId(id);
  const { ready, user, db } = useChurch();
  if (!ready || !user || !db) return null;
  const service = db.services.find((item) => item.id === serviceId);
  if (!service) return <Missing />;
  const sermon = service.items.find((item) => item.kind === "sermon");
  const preacher = preacherName(service, db.people);
  const announcements = service.announcements.filter((announcement) => announcement.text.trim());
  return (
    <div className="page">
      <div className="no-print mb-4 flex flex-wrap gap-2">
        {can(user.roles, "screen.editor") ? (
          <Link href={`/services/${service.id}`} className="btn btn-quiet">
            순서 편집
          </Link>
        ) : (
          <Link href="/services" className="btn btn-quiet">
            예배 목록
          </Link>
        )}
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
          <p className="mt-2 text-center">{[preacher ? `설교 ${preacher}` : "", sermon?.scripture ?? ""].filter(Boolean).join(" · ")}</p>
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

export function SlidesScreen({ id }: { id?: string }) {
  const serviceId = useServiceId(id);
  const { ready, user, db } = useChurch();
  if (!ready || !user || !db) return null;
  const service = db.services.find((item) => item.id === serviceId);
  if (!service) return <Missing />;
  const slides = slidesFor(service, db.people, db.songs);
  return (
    <div className="page">
      <Link href={can(user.roles, "screen.editor") ? `/services/${service.id}` : "/services"} className="text-sm text-muted">
        {can(user.roles, "screen.editor") ? "예배 순서로" : "예배 목록"}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">송출 슬라이드</h1>
          <p className="mt-2 text-muted">{service.title}</p>
        </div>
        <Link href={`/services/${service.id}/output`} target="_blank" className="btn btn-primary">
          송출 화면
        </Link>
      </div>
      <p className="mt-4 max-w-3xl text-sm text-muted">{COPYRIGHT_NOTE}</p>
      <div className="mt-6 space-y-4">
        {slides.map((slide, index) => {
          const item = service.items[index];
          if (!item) return null;
          const scripture = item.kind === "scripture" || item.kind === "sermon";
          return (
            <article key={slide.itemId} className="card grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl p-6 text-[#f7f3ea]" style={{ background: db.settings.backgroundColor || "#1b3a32" }}>
                <p className="text-sm opacity-80">{slide.kicker}</p>
                <h2 className="mt-3 font-serif text-4xl leading-tight">{slide.heading}</h2>
                {slide.lines.map((line) => (
                  <p key={line} className="mt-3 text-lg">
                    {line}
                  </p>
                ))}
                {slide.footer ? <p className="mt-4 text-sm opacity-80">{slide.footer}</p> : null}
                <p className="mt-6 border-t border-white/20 pt-3 text-sm">자막 · {slide.overlay}</p>
              </div>
              <form action={updateSlideFields} className="space-y-3">
                <input type="hidden" name="serviceId" value={service.id} />
                <input type="hidden" name="itemId" value={item.id} />
                <label className="field">
                  <span>화면에 한 줄로 낼 말 (가사 금지)</span>
                  <input className="input" name="screenCue" defaultValue={item.screenCue} maxLength={80} />
                </label>
                {scripture ? (
                  <>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="scriptureLicensed" defaultChecked={item.scriptureLicensed} className="mt-1" />
                      <span>사용 가능한 번역을 직접 붙여 넣었습니다</span>
                    </label>
                    <label className="field">
                      <span>화면에 낼 본문</span>
                      <textarea className="textarea" name="scriptureText" defaultValue={item.scriptureText} maxLength={400} />
                    </label>
                  </>
                ) : null}
                <SubmitButton className="btn btn-quiet">이 순서 저장</SubmitButton>
              </form>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Missing() {
  return (
    <div className="page">
      <h1 className="font-serif text-4xl">예배를 찾을 수 없습니다</h1>
      <Link href="/" className="btn btn-primary mt-6">
        이번 주
      </Link>
    </div>
  );
}
