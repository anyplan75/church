import Link from "next/link";
import { NotifyButton } from "@/components/notify-button";
import { SubmitButton } from "@/components/submit-button";
import { importBulletin } from "@/lib/actions";
import { CHECKS, checklistProgress, COPYRIGHT_NOTE } from "@/lib/checklist";
import { formatKoreanDate, formatTime } from "@/lib/format";
import { syncReminders } from "@/lib/reminders";
import { updateDb } from "@/lib/store";
import { personName, todayISO, weekServices } from "@/lib/worship";

export const metadata = { title: "예배 준비 · 예배 운영" };

const SAMPLE = `2026년 10월 18일 주일
1부 예배 오전 9:00
장소 교육관
묵도
찬송 28장
사도신경
대표기도 이성실
성경봉독 히브리서 10:23-25
설교 다시 모인 자리에서 김은혜
봉헌
광고
- 새가족 환영회가 있습니다.
찬송 405장
축도`;

export default async function PreparePage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; skipped?: string; lyrics?: string; error?: string; detail?: string }>;
}) {
  const query = await searchParams;
  const db = updateDb((current) => {
    syncReminders(current);
  });
  const today = todayISO();
  const week = weekServices(db.services, today);
  const context = { people: db.people, songs: db.songs, settings: db.settings, reminders: db.reminders };
  const groups = [...new Set(CHECKS.map((item) => item.group))];
  const reminders = db.reminders
    .filter((reminder) => week.some((service) => service.id === reminder.serviceId))
    .slice()
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return (
    <div className="page">
      <p className="text-sm font-semibold text-gold">예배 전</p>
      <h1 className="mt-1 font-serif text-4xl">예배 준비</h1>
      <p className="mt-3 max-w-3xl text-muted">{COPYRIGHT_NOTE}</p>

      <section className="mt-8">
        <h2 className="font-serif text-2xl">예배에 필요한 것</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <article key={group} className="card p-5">
              <h3 className="font-serif text-xl">{group}</h3>
              <ul className="mt-3 space-y-3">
                {CHECKS.filter((item) => item.group === group).map((item) => (
                  <li key={item.id}>
                    <p className="font-medium">
                      {item.label}
                      <span className="ml-2 text-sm text-muted">{item.required ? (item.auto ? "자동 확인" : "직접 확인") : "선택"}</span>
                    </p>
                    <p className="text-sm text-muted">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="card mt-8 p-5">
        <h2 className="font-serif text-2xl">주보 가져오기</h2>
        <p className="mt-2 text-sm text-muted">붙여 넣은 글, 텍스트, 워드(DOCX), 한글(HWPX)을 받습니다. 예전 한글(HWP)은 HWPX로 저장한 뒤 올려 주세요. 한 주에 들어 있는 예배를 모두 준비합니다. 예배 줄 아래에 장소 교육관처럼 적으면 그 장소를 쓰고, 적지 않으면 본당으로 둡니다.</p>
        {query.imported ? (
          <p className="mt-4 text-sm text-pine">
            예배 {query.imported}개를 준비했습니다.
            {query.skipped && query.skipped !== "0" ? ` 진행 중이거나 마친 예배 ${query.skipped}개는 바꾸지 않았습니다.` : ""}
            {query.lyrics && query.lyrics !== "0" ? ` 가사로 보이는 줄 ${query.lyrics}개는 저장하지 않았습니다.` : ""}
          </p>
        ) : null}
        {query.error === "empty" ? <p className="mt-4 text-sm text-wine">주보 내용을 붙여 넣거나 파일을 선택해 주세요.</p> : null}
        {query.error === "none" ? <p className="mt-4 text-sm text-wine">예배 구분을 찾지 못했습니다. 1부 예배, 수요 예배처럼 적어 주세요.</p> : null}
        {query.error === "size" ? <p className="mt-4 text-sm text-wine">파일은 8MB 이하로 올려 주세요.</p> : null}
        {query.error === "file" ? <p className="mt-4 text-sm text-wine">{query.detail || "파일을 읽지 못했습니다."}</p> : null}
        <form action={importBulletin} className="mt-4 space-y-3">
          <label className="field">
            <span>주보 글</span>
            <textarea className="textarea" name="text" rows={14} placeholder={SAMPLE} />
          </label>
          <label className="field">
            <span>파일</span>
            <input className="input" name="file" type="file" accept=".txt,.text,.md,.docx,.hwpx,.hwp,text/plain" />
          </label>
          <SubmitButton>이번 주 예배 준비</SubmitButton>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl">이번 주 예배</h2>
        <div className="mt-4 space-y-3">
          {week.length === 0 ? <p className="text-muted">이번 주 예배가 없습니다. 주보를 가져오거나 예배를 만들어 주세요.</p> : null}
          {week.map((service) => {
            const progress = checklistProgress(service, context);
            return (
              <article key={service.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {service.title} · {formatKoreanDate(service.date)} {formatTime(service.time)}
                  </p>
                  <p className="text-sm text-muted">
                    점검 {progress.done}/{progress.total}
                    {service.source === "bulletin" ? " · 주보" : " · 직접 입력"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/services/${service.id}`} className="btn btn-quiet btn-small">
                    점검
                  </Link>
                  <Link href={`/services/${service.id}/slides`} className="btn btn-quiet btn-small">
                    슬라이드
                  </Link>
                  <Link href={`/services/${service.id}/output`} target="_blank" className="btn btn-quiet btn-small">
                    송출
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">알림</h2>
            <p className="mt-1 text-sm text-muted">예배에 연결된 사람에게 하루 전과 한 시간 전에 일정을 알립니다. 문자 대신 이 화면과 브라우저 알림을 사용합니다.</p>
          </div>
          <NotifyButton />
        </div>
        <ul className="mt-4 space-y-2">
          {reminders.length === 0 ? <li className="text-muted">이번 주에 보낼 알림이 없습니다.</li> : null}
          {reminders.map((reminder) => (
            <li key={reminder.id} className="card px-4 py-3 text-sm">
              <span className="text-muted">{reminder.status === "sent" ? "보냄" : reminder.status === "due" ? "지금" : "예정"} · </span>
              {personName(db.people, reminder.personId)} · {reminder.message}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
