"use client";

import { useEffect, useState, useTransition } from "react";
import { logout } from "@/lib/account-actions";
import { useChurch, useClientQuery } from "@/components/church-state";
import {
  memberViewsFromDb,
  pickReasonLabel,
} from "@/lib/member-bulletin";
import { canManagePrayers, prayerStatusLabel, type PrayerRequest, type PrayerStatus } from "@/lib/prayer-requests";
import { loadPrayerRequests, submitPrayerRequest, updatePrayerStatus } from "@/lib/prayer-db";
import { can } from "@/lib/roles";

type Tab = "bulletin" | "lyrics" | "info" | "prayer" | "inbox";

const TABS: { id: Tab; label: string }[] = [
  { id: "bulletin", label: "주보" },
  { id: "lyrics", label: "가사" },
  { id: "info", label: "예배정보" },
  { id: "prayer", label: "기도" },
];

export function MemberApp({ initialTab = "bulletin" }: { initialTab?: Tab }) {
  const { ready, user, db } = useChurch();
  const query = useClientQuery();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [serviceId, setServiceId] = useState("");
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [prayerText, setPrayerText] = useState("");
  const [prayerName, setPrayerName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedFromQuery = typeof query.service === "string" ? query.service : "";
  const effectiveId = serviceId || selectedFromQuery;
  const views = db ? memberViewsFromDb(db, effectiveId) : null;
  const pastor = user ? canManagePrayers(user.roles) : false;
  const tabs = pastor ? [...TABS, { id: "inbox" as const, label: "받은기도" }] : TABS;

  useEffect(() => {
    if (initialTab === "inbox" && !pastor) setTab("prayer");
    else setTab(initialTab);
  }, [initialTab, pastor]);

  useEffect(() => {
    if (!ready || !user?.churchId) return;
    let cancelled = false;
    void loadPrayerRequests()
      .then((rows) => {
        if (!cancelled) setPrayers(rows);
      })
      .catch(() => {
        if (!cancelled) setPrayers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, user?.id, user?.churchId]);

  if (!ready || !user) return null;
  if (!db) {
    return (
      <div className="member-shell">
        <p className="text-muted">교회 자료를 불러오는 중입니다.</p>
      </div>
    );
  }

  const pick = views?.pick;
  const bulletin = views?.bulletin;
  const lyrics = views?.lyrics ?? [];
  const info = views?.info;
  const options = views?.options ?? [];

  function refreshPrayers() {
    startTransition(async () => {
      try {
        setPrayers(await loadPrayerRequests());
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "기도제목을 불러오지 못했습니다.");
      }
    });
  }

  function sendPrayer() {
    if (!pick) {
      setError("예배를 먼저 골라 주세요.");
      return;
    }
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const row = await submitPrayerRequest({
          text: prayerText,
          authorName: prayerName,
          serviceId: pick.service.id,
          serviceTitle: pick.service.title,
        });
        setPrayerText("");
        setMessage("목회자에게 기도제목을 보냈습니다.");
        setPrayers((prev) => [row, ...prev.filter((item) => item.id !== row.id)]);
        if (pastor) setTab("inbox");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "보내지 못했습니다.");
      }
    });
  }

  function setStatus(id: string, status: PrayerStatus) {
    startTransition(async () => {
      try {
        const row = await updatePrayerStatus(id, status);
        setPrayers((prev) => prev.map((item) => (item.id === row.id ? row : item)));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "상태를 바꾸지 못했습니다.");
      }
    });
  }

  return (
    <div className="member-shell">
      <header className="member-hero">
        <div className="member-hero-glow" aria-hidden />
        <p className="member-brand">은혜로운 예배</p>
        <h1 className="member-title">{db.settings.churchName || "우리 교회"}</h1>
        <p className="member-lede">오늘의 주보와 가사, 예배에 필요한 안내를 모았습니다.</p>
        {pick ? (
          <p className="member-chip">
            {pickReasonLabel(pick.reason)} · {pick.service.title}
          </p>
        ) : (
          <p className="member-chip">등록된 예배가 없습니다</p>
        )}
        <div className="member-hero-actions">
          {options.length > 1 ? (
            <label className="member-select">
              <span className="sr-only">예배 선택</span>
              <select
                value={pick?.service.id || ""}
                onChange={(event) => setServiceId(event.target.value)}
              >
                {options.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.date} {service.time} · {service.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" className="member-link" onClick={() => void logout().catch(() => undefined)}>
            나가기
          </button>
        </div>
      </header>

      <nav className="member-tabs" aria-label="성도 메뉴">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "is-on" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {message ? <p className="member-ok">{message}</p> : null}
      {error ? <p className="member-err">{error}</p> : null}

      <main className="member-main">
        {!pick || !bulletin ? (
          <p className="text-muted">아직 볼 예배가 없습니다. 운영자가 예배를 준비하면 여기에 주보가 열립니다.</p>
        ) : null}

        {tab === "bulletin" && bulletin ? (
          <article className="member-bulletin animate-in">
            <p className="member-kicker">{bulletin.churchName}</p>
            <h2>{bulletin.title}</h2>
            {bulletin.sermonTitle ? <p className="member-sermon">{bulletin.sermonTitle}</p> : null}
            <p className="member-meta">
              {bulletin.dateLabel} · {bulletin.timeLabel} · {bulletin.place}
            </p>
            {bulletin.preacher || bulletin.scripture ? (
              <p className="member-meta">
                {[bulletin.preacher ? `설교 ${bulletin.preacher}` : "", bulletin.scripture].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <h3>예배 순서</h3>
            <ol>
              {bulletin.order.map((item, index) => (
                <li key={item.id}>
                  <div className="member-order-row">
                    <span>
                      {index + 1}. {item.title}
                    </span>
                    <span className="member-aside">{item.aside}</span>
                  </div>
                  {item.note ? <p className="member-note">{item.note}</p> : null}
                </li>
              ))}
            </ol>
            {bulletin.notices.length > 0 ? (
              <section className="member-notices">
                <h3>광고</h3>
                <ul>
                  {bulletin.notices.map((notice) => (
                    <li key={notice.id}>{notice.text}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>
        ) : null}

        {tab === "lyrics" && pick ? (
          <section className="member-lyrics animate-in">
            <h2>가사 · 화면 문구</h2>
            <p className="member-hint">허가된 찬양만 가사가 보입니다. 그 외는 제목만 표시합니다.</p>
            <div className="member-lyric-list">
              {lyrics.map((line) => (
                <article key={line.itemId} className={line.isSong ? "is-song" : undefined}>
                  <p className="member-kicker">{line.kicker}</p>
                  <h3>{line.heading}</h3>
                  {line.lines.map((text) => (
                    <p key={text} className="member-lyric-line">
                      {text}
                    </p>
                  ))}
                  {line.footer ? <p className="member-aside">{line.footer}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "info" && info ? (
          <section className="member-info animate-in">
            <h2>예배에 필요한 정보</h2>
            <dl className="member-dl">
              <div>
                <dt>예배</dt>
                <dd>{info.title}</dd>
              </div>
              <div>
                <dt>일시</dt>
                <dd>
                  {info.dateLabel} {info.timeLabel}
                </dd>
              </div>
              <div>
                <dt>장소</dt>
                <dd>{info.place}</dd>
              </div>
              {info.preacher ? (
                <div>
                  <dt>설교</dt>
                  <dd>{info.preacher}</dd>
                </div>
              ) : null}
              {info.currentTitle && pick.service.status === "live" ? (
                <div>
                  <dt>지금 순서</dt>
                  <dd>{info.currentTitle}</dd>
                </div>
              ) : null}
              <div>
                <dt>교회</dt>
                <dd>{info.churchName}</dd>
              </div>
            </dl>
            {info.notices.length > 0 ? (
              <div className="member-notices">
                <h3>주보 광고</h3>
                <ul>
                  {info.notices.map((notice) => (
                    <li key={notice.id}>{notice.text}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="member-hint">등록된 광고가 없습니다.</p>
            )}
            {can(user.roles, "screen.prayers") ? (
              <p className="member-hint mt-4">
                목회자·운영자는 상단 <strong>받은기도</strong> 또는 메뉴의 <strong>기도함</strong>에서 성도 기도제목을 확인합니다.
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === "prayer" ? (
          <section className="member-prayer animate-in">
            <h2>기도제목 보내기</h2>
            <p className="member-hint">작성한 내용만 목회자·운영자 계정에 전달됩니다. 다른 성도에게는 보이지 않습니다.</p>
            <label className="field">
              <span>이름 (선택)</span>
              <input className="input" value={prayerName} maxLength={40} onChange={(event) => setPrayerName(event.target.value)} placeholder="이름 또는 호칭" />
            </label>
            <label className="field mt-3">
              <span>기도제목</span>
              <textarea
                className="textarea"
                value={prayerText}
                maxLength={800}
                onChange={(event) => setPrayerText(event.target.value)}
                placeholder="함께 기도해 주세요."
              />
            </label>
            <button type="button" className="btn btn-primary mt-4 w-full" disabled={pending} onClick={sendPrayer}>
              {pending ? "보내는 중…" : "목회자에게 보내기"}
            </button>
            <div className="member-mine mt-8">
              <div className="flex items-center justify-between gap-2">
                <h3>내가 보낸 기도</h3>
                <button type="button" className="member-link" onClick={refreshPrayers}>
                  새로고침
                </button>
              </div>
              {prayers.filter((row) => row.authorUid === user.id).length === 0 ? (
                <p className="member-hint">아직 보낸 기도제목이 없습니다.</p>
              ) : (
                <ul className="member-prayer-list">
                  {prayers
                    .filter((row) => row.authorUid === user.id)
                    .map((row) => (
                      <li key={row.id}>
                        <p>{row.text}</p>
                        <p className="member-aside">
                          {prayerStatusLabel(row.status)}
                          {row.serviceTitle ? ` · ${row.serviceTitle}` : ""}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </section>
        ) : null}

        {tab === "inbox" && pastor ? (
          <section className="member-inbox animate-in">
            <h2>받은 기도제목</h2>
            <p className="member-hint">성도가 보낸 기도입니다. 확인·기도함으로 상태를 남길 수 있습니다.</p>
            <button type="button" className="member-link mb-4" onClick={refreshPrayers}>
              목록 새로고침
            </button>
            {prayers.length === 0 ? (
              <p className="member-hint">아직 받은 기도제목이 없습니다.</p>
            ) : (
              <ul className="member-prayer-list">
                {prayers.map((row) => (
                  <li key={row.id}>
                    <p className="font-medium">{row.authorName || row.authorEmail || "성도"}</p>
                    <p className="mt-1">{row.text}</p>
                    <p className="member-aside">
                      {prayerStatusLabel(row.status)}
                      {row.serviceTitle ? ` · ${row.serviceTitle}` : ""}
                    </p>
                    <div className="member-inbox-actions">
                      <button type="button" disabled={pending} onClick={() => setStatus(row.id, "read")}>
                        확인함
                      </button>
                      <button type="button" disabled={pending} onClick={() => setStatus(row.id, "prayed")}>
                        기도함
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
