import Link from "next/link";
import { AccessScreen } from "@/components/access-screen";
import { GUIDE_INTAKE_ADDRESS, GUIDE_MAILBOX } from "@/guide/mailbox";
import { approveGuideAction, pullGuideMailAction, rejectGuideAction } from "@/server/guide/actions";
import { loadGuideDesk } from "@/server/guide/inbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function statusLine(ok: string | undefined, count: string | undefined): string {
  if (ok === "mail") {
    const added = count && /^\d+$/.test(count) ? Number(count) : 0;
    return added > 0 ? `메일 ${added}통을 승인 대기로 올렸습니다.` : "새 안내 메일이 없습니다.";
  }
  if (ok === "approved") return "승인하여 안내에 등록했습니다.";
  if (ok === "rejected") return "거절했습니다. 등록되지 않았습니다.";
  return "";
}

const STATUS_LABEL = {
  pending: "승인 대기",
  approved: "등록됨",
  rejected: "등록하지 않음",
} as const;

export default async function GuideInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; count?: string }>;
}) {
  const query = await searchParams;
  const desk = await loadGuideDesk();
  if (!desk) return <AccessScreen />;
  const status = statusLine(query.ok, query.count);
  const pending = desk.cards.filter((card) => card.status === "pending");
  const settled = desk.cards.filter((card) => card.status !== "pending");

  return (
    <section className="grid gap-4" data-testid="guide-approval">
      <h1 className="text-2xl font-semibold leading-snug">안내 승인</h1>
      <p className="leading-relaxed text-[#5c5148]">
        {GUIDE_INTAKE_ADDRESS} 으로 온 주보와 안내는 승인 후에만 등록됩니다. 거절하면 등록되지 않습니다. {GUIDE_INTAKE_ADDRESS} 으로 온 메일은 {GUIDE_MAILBOX} 으로 전달되어야 읽힙니다.
      </p>
      {query.error ? <p className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">{query.error}</p> : null}
      {status ? (
        <p role="status" className="rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed">
          {status}
        </p>
      ) : null}
      {desk.operator ? (
        <form action={pullGuideMailAction}>
          <button type="submit" className="rounded-2xl bg-[#111827] px-4 py-3 font-semibold text-white" data-testid="guide-mail-pull">
            메일함 확인
          </button>
        </form>
      ) : null}
      {desk.cards.length === 0 ? <p className="leading-relaxed">승인 대기 안내가 없습니다.</p> : null}
      {[...pending, ...settled].map((card) => (
        <article
          key={card.id}
          data-testid="guide-draft"
          data-status={card.status}
          className={`grid gap-3 rounded-3xl px-4 py-4 ${card.status === "approved" ? "bg-[#ecfdf3]" : card.status === "rejected" ? "bg-[#f4f4f5]" : "bg-[#fff6e8]"}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{STATUS_LABEL[card.status]}</span>
            <h2 className="text-lg font-semibold leading-snug">{card.subject || "(제목 없음)"}</h2>
          </div>
          <p className="leading-relaxed text-[#5c5148]">
            {[card.fromName, card.fromEmail, card.fileName, card.receivedLabel].filter(Boolean).join(" · ")}
          </p>
          {card.unmatched ? (
            <p className="leading-relaxed" data-testid="guide-unmatched">
              어느 교회·모들인지 못 맞췄습니다. 운영자만 승인할 수 있습니다.
            </p>
          ) : (
            <p className="leading-relaxed">{card.placeLabel}</p>
          )}
          {card.status === "pending" ? (
            <p className="leading-relaxed">아직 등록되지 않았습니다. 승인하면 등록되고, 거절하면 등록되지 않습니다.</p>
          ) : null}
          {card.status === "approved" ? <p className="font-semibold leading-relaxed">승인되어 안내에 등록되었습니다.</p> : null}
          {card.status === "rejected" ? <p className="leading-relaxed">거절되어 등록되지 않았습니다.</p> : null}
          {card.note ? <p className="leading-relaxed">{card.note}</p> : null}
          {card.services.length > 0 ? (
            <ul className="grid gap-2">
              {card.services.map((service) => (
                <li key={`${service.label}-${service.worshipDate}-${service.time}`} data-testid="guide-service" data-label={service.label} className="leading-snug">
                  <span className="font-semibold">{[service.label, service.time, service.worshipDate].filter(Boolean).join(" · ")}</span>
                  {service.sermonTitle ? <span>{` 설교 ${service.sermonTitle}`}</span> : null}
                  {service.scriptureText ? <span>{` 본문 ${service.scriptureText}`}</span> : null}
                  {service.preacher ? <span>{` 설교자 ${service.preacher}`}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {card.extraCount > 0 ? <p className="leading-relaxed text-[#5c5148]">다른 예배 {card.extraCount}건이 더 있습니다.</p> : null}
          {card.news ? <p className="leading-relaxed">광고 {card.news.slice(0, 180)}</p> : null}
          {card.bulletinHref ? (
            <Link href={card.bulletinHref} className="w-fit font-semibold underline">
              등록된 안내 보기
            </Link>
          ) : null}
          {card.status === "pending" ? (
            <div className="flex flex-wrap items-end gap-2">
              <form action={approveGuideAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={card.id} />
                {card.unmatched && desk.operator ? (
                  <label className="grid gap-1 text-sm">
                    등록할 교회·모들
                    <select name="placeRef" required className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2">
                      <option value="">고르기</option>
                      {desk.places.map((place) => (
                        <option key={place.value} value={place.value}>
                          {place.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <button type="submit" className="rounded-2xl bg-[#111827] px-4 py-3 font-semibold text-white" data-testid="guide-approve">
                  승인
                </button>
              </form>
              <form action={rejectGuideAction}>
                <input type="hidden" name="id" value={card.id} />
                <button type="submit" className="rounded-2xl border border-[#e4d8c8] bg-white px-4 py-3 font-semibold" data-testid="guide-reject">
                  거절
                </button>
              </form>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
