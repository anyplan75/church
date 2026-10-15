"use client";

import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { useChurch, useClientQuery } from "@/components/church-state";
import { importBulletin } from "@/lib/actions";
import { BULLETIN_UPLOAD_BYTES, bulletinAccept, bulletinFormatNote } from "@/lib/extract-text";
import { formatKoreanDate, formatMonthDay, formatTime } from "@/lib/format";
import { bulletinWeeks, serviceText } from "@/lib/simple";
import { sundayOf, todayISO } from "@/lib/worship";

export default function BulletinPage() {
  const { ready, db } = useChurch();
  const query = useClientQuery();
  const [sunday, setSunday] = useState("");
  useEffect(() => {
    if (!query.imported && !query.error) return;
    document.getElementById("bulletin-import")?.scrollIntoView({ block: "start" });
  }, [query.imported, query.error, ready]);
  if (!ready || !db) return null;
  const weeks = bulletinWeeks(db.services);
  const today = todayISO();
  const selected = weeks.find((week) => week.sunday === sunday) ?? weeks.find((week) => week.sunday === sundayOf(today)) ?? weeks[0];

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">주보</h1>
      <p className="mt-2 text-muted">주보를 읽으면 그 주의 예배와 광고만 텍스트로 정리합니다. 가사와 성경 본문은 저장하지 않습니다.</p>

      <section id="bulletin-import" className="card mt-6 p-5">
        <h2 className="font-serif text-2xl">주보 입력</h2>
        <p className="mt-2 text-sm text-muted">{bulletinFormatNote()}</p>
        {query.imported ? (
          <p className="mt-4 text-sm text-pine">
            예배 {query.imported}개를 준비했습니다.
            {query.skipped && query.skipped !== "0" ? ` 진행 중이거나 마친 예배 ${query.skipped}개는 바꾸지 않았습니다.` : ""}
          </p>
        ) : null}
        {query.error === "empty" ? <p className="mt-4 text-sm text-wine">주보 내용을 붙여 넣거나 파일을 선택해 주세요.</p> : null}
        {query.error === "none" ? <p className="mt-4 text-sm text-wine">예배 구분을 찾지 못했습니다.</p> : null}
        {query.error === "size" ? <p className="mt-4 text-sm text-wine">파일은 {BULLETIN_UPLOAD_BYTES / (1024 * 1024)}MB 이하로 올려 주세요.</p> : null}
        {query.error === "file" ? <p className="mt-4 text-sm text-wine">{query.detail || "파일을 읽지 못했습니다."}</p> : null}
        <form action={importBulletin} className="mt-4 space-y-3">
          <label className="field">
            <span>주보 글</span>
            <textarea className="textarea" name="text" rows={8} placeholder="예배 순서와 광고를 붙여 넣습니다." />
          </label>
          <label className="field">
            <span>파일</span>
            <input className="input" name="file" type="file" accept={bulletinAccept()} />
          </label>
          <SubmitButton>주보 읽기</SubmitButton>
        </form>
      </section>

      <section id="bulletin-weeks" className="mt-8">
        <h2 className="font-serif text-2xl">주보의 주</h2>
        {weeks.length === 0 ? <p className="mt-3 text-muted">아직 읽어 둔 주보가 없습니다.</p> : null}
        {weeks.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="주보 주">
            {weeks.map((week) => {
              const active = week.sunday === selected?.sunday;
              return (
                <button
                  key={week.sunday}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? "btn btn-primary btn-small" : "btn btn-quiet btn-small"}
                  onClick={() => setSunday(week.sunday)}
                >
                  {formatMonthDay(week.sunday)} 주
                </button>
              );
            })}
          </div>
        ) : null}
        {selected ? (
          <div className="mt-4 space-y-4" role="tabpanel">
            <p className="text-sm text-muted">{formatKoreanDate(selected.sunday)}부터 토요일까지</p>
            {selected.services.map((service) => (
              <article key={service.id} className="card p-4">
                <h3 className="font-medium">
                  {service.title} · {formatKoreanDate(service.date)} {formatTime(service.time)}
                </h3>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-ink">{serviceText(service, db.songs, db.people) || "예배 순서가 없습니다."}</pre>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
