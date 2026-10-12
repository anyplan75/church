import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { updateSlideFields } from "@/lib/actions";
import { COPYRIGHT_NOTE } from "@/lib/checklist";
import { requireScreen } from "@/lib/guard";
import { can } from "@/lib/roles";
import { slidesFor } from "@/lib/slides";
import { readDb } from "@/lib/store";

export const metadata = { title: "슬라이드 · 예배 운영" };

export default async function SlidesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireScreen("screen.slides");
  const { id } = await params;
  const db = readDb();
  const service = db.services.find((item) => item.id === id);
  if (!service) notFound();
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
