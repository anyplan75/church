"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { logout } from "@/lib/account-actions";
import { useChurch, useClientQuery } from "@/components/church-state";
import {
  captionModeHint,
  memberViewsFromDb,
  pickReasonLabel,
  serviceOptionLabel,
} from "@/lib/member-bulletin";
import { canSeePastorInbox, prayerStatusLabel, type PrayerRequest, type PrayerStatus } from "@/lib/prayer-requests";
import { loadPrayerRequests, submitPrayerRequest, updatePrayerStatus } from "@/lib/prayer-db";
import { can } from "@/lib/roles";

type MemberTab = "info" | "live" | "ads" | "prayer";
type Tab = MemberTab | "inbox";

const TABS: { id: MemberTab; label: string }[] = [
  { id: "info", label: "예배정보" },
  { id: "live", label: "예배자막" },
  { id: "ads", label: "광고" },
  { id: "prayer", label: "기도" },
];

export function MemberApp({ initialTab = "info" }: { initialTab?: Tab }) {
  const { ready, user, db } = useChurch();
  const query = useClientQuery();
  const pastorOnlyInbox = initialTab === "inbox";
  const [tab, setTab] = useState<Tab>(pastorOnlyInbox ? "inbox" : initialTab);
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
  const assignedPastorUid = db?.settings.pastorUid || "";
  const assignedPastorName = db?.settings.pastorName || "";
  const pastor = user
    ? assignedPastorUid
      ? assignedPastorUid === user.id
      : can(user.roles, "screen.prayers")
    : false;
  const inbox = user
    ? prayers.filter((row) => canSeePastorInbox(user, row, assignedPastorUid))
    : [];

  useEffect(() => {
    setTab(pastorOnlyInbox ? "inbox" : initialTab);
  }, [initialTab, pastorOnlyInbox]);

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

  // null 만 반환하면 성도 앱이 빈 화면으로 보입니다. 안내 문구를 남깁니다.
  if (!ready) {
    return (
      <div className="member-shell">
        <p className="text-muted">불러오는 중</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="member-shell">
        <p className="text-muted">로그인으로 이동 중</p>
      </div>
    );
  }
  if (!db) {
    return (
      <div className="member-shell">
        <p className="text-muted">교회 자료를 불러오는 중입니다.</p>
      </div>
    );
  }

  const pick = views?.pick;
  const info = views?.info;
  const notices = views?.notices ?? [];
  const caption = views?.caption;
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
        setMessage(
          assignedPastorName
            ? `${assignedPastorName} 목사님께 기도제목을 보냈습니다.`
            : "담당 목사님께 기도제목을 보냈습니다.",
        );
        setPrayers((prev) => [row, ...prev.filter((item) => item.id !== row.id)]);
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

  /** 담당 목사 전용 `/prayers` — 성도 탭에는 넣지 않습니다. */
  if (pastorOnlyInbox) {
    return (
      <div className="member-shell">
        <header className="member-hero">
          <div className="member-hero-glow" aria-hidden />
          <h1 className="member-brand">{db.settings.churchName || "우리 교회"}</h1>
          <p className="member-lede">담당 목사님 기도함입니다. 성도가 보낸 기도제목을 확인하고 상태를 남깁니다.</p>
          <div className="member-hero-actions">
            <Link href="/member/" className="member-link">
              성도 화면
            </Link>
            <button type="button" className="member-link" onClick={() => void logout().catch(() => undefined)}>
              나가기
            </button>
          </div>
        </header>
        {error ? <p className="member-err">{error}</p> : null}
        <main className="member-main">
          {!pastor ? (
            <p className="member-hint">
              이 화면은 설정에서 지정한 담당 목사 계정만 볼 수 있습니다.
              {assignedPastorName ? ` (현재 담당: ${assignedPastorName})` : ""}
            </p>
          ) : (
            <section className="member-inbox animate-in">
              <h2>받은 기도제목</h2>
              <p className="member-hint">나에게 온 기도제목입니다. 확인·기도함으로 상태를 남길 수 있습니다.</p>
              <button type="button" className="member-link mb-4" onClick={refreshPrayers}>
                목록 새로고침
              </button>
              {inbox.length === 0 ? (
                <p className="member-hint">아직 받은 기도제목이 없습니다.</p>
              ) : (
                <ul className="member-prayer-list">
                  {inbox.map((row) => (
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
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="member-shell">
      <header className="member-hero">
        <div className="member-hero-glow" aria-hidden />
        <h1 className="member-brand">{db.settings.churchName || "우리 교회"}</h1>
        <p className="member-lede">선택한 예배의 정보·광고와 예배 중 자막, 기도제목 보내기를 모았습니다.</p>
        {pick ? (
          <p className="member-chip">
            {pickReasonLabel(pick.reason)} · {pick.service.title}
          </p>
        ) : (
          <p className="member-chip">등록된 예배가 없습니다</p>
        )}
        <div className="member-hero-actions">
          {options.length > 0 ? (
            <label className="member-select">
              <span className="sr-only">예배 선택</span>
              <select
                value={pick?.service.id || ""}
                onChange={(event) => setServiceId(event.target.value)}
              >
                {options.map((service) => (
                  <option key={service.id} value={service.id}>
                    {serviceOptionLabel(service)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {can(user.roles, "screen.community") ? (
            <Link href="/community/" className="member-link">
              커뮤니티
            </Link>
          ) : null}
          {pastor ? (
            <Link href="/prayers/" className="member-link">
              기도함
            </Link>
          ) : null}
          <button type="button" className="member-link" onClick={() => void logout().catch(() => undefined)}>
            나가기
          </button>
        </div>
      </header>

      <nav className="member-tabs" aria-label="성도 메뉴">
        {TABS.map((item) => (
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
        {!pick ? (
          <p className="text-muted">아직 볼 예배가 없습니다. 운영자가 예배를 준비하면 여기에 예배 정보가 열립니다.</p>
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
              {info.currentTitle && pick?.service.status === "live" ? (
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
            {pastor ? (
              <p className="member-hint mt-4">
                담당 목사님 기도함은 <Link href="/prayers/">/prayers</Link> 에서 엽니다.
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === "ads" && pick ? (
          <section className="member-ads animate-in">
            <h2>광고</h2>
            <p className="member-hint">
              {pick.service.title} 주보에 올라온 광고입니다. 다른 예배(청소년부·청년부 등)는 위에서 고르면 바뀝니다.
            </p>
            {notices.length > 0 ? (
              <ul className="member-ads-list">
                {notices.map((notice, index) => (
                  <li key={notice.id}>
                    <span className="member-ads-index">{index + 1}</span>
                    <p>{notice.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="member-hint">등록된 광고가 없습니다.</p>
            )}
          </section>
        ) : null}

        {tab === "live" && pick && caption ? (
          <section className={`member-live animate-in is-${caption.mode}`}>
            <p className="member-live-kicker">
              {caption.live ? "예배 중" : "예배 전"} · {captionModeHint(caption.mode)}
            </p>
            <p className="member-live-order">
              {caption.orderTotal > 0
                ? `${caption.orderIndex + 1}/${caption.orderTotal} · ${caption.orderTitle || caption.heading}`
                : pick.service.title}
            </p>
            <h2 className="member-live-heading">{caption.heading}</h2>
            <div className="member-live-lines" aria-live="polite">
              {caption.lines.length > 0 ? (
                caption.lines.map((line) => (
                  <p key={line} className="member-live-line">
                    {line}
                  </p>
                ))
              ) : (
                <p className="member-live-empty">
                  {caption.mode === "praise"
                    ? "허가된 가사나 조작 화면의 활성 문구가 아직 없습니다."
                    : caption.mode === "word"
                      ? "본문·설교 문구가 아직 없습니다."
                      : "지금 순서의 자막이 준비되면 여기에 크게 보입니다."}
                </p>
              )}
            </div>
            {caption.footer ? <p className="member-live-footer">{caption.footer}</p> : null}
            <p className="member-hint member-live-hint">
              조작 리모컨·진행 화면의 현재 순서(`liveIndex`)와 활성 줄(`outputLines`)을 따라갑니다.
            </p>
          </section>
        ) : null}

        {tab === "prayer" ? (
          <section className="member-prayer animate-in">
            <h2>기도제목 보내기</h2>
            <p className="member-hint">
              {assignedPastorUid
                ? `담당 목사님${assignedPastorName ? ` (${assignedPastorName})` : ""}에게만 전달됩니다. 다른 성도에게는 보이지 않습니다.`
                : "담당 목사님이 아직 정해지지 않았습니다. 교회 설정에서 담당 목사를 지정한 뒤 보내 주세요."}
            </p>
            {pick ? (
              <p className="member-aside mb-3">연결 예배: {pick.service.title}</p>
            ) : null}
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
            <button type="button" className="btn btn-primary mt-4 w-full" disabled={pending || !assignedPastorUid} onClick={sendPrayer}>
              {pending ? "보내는 중…" : "담당 목사님께 보내기"}
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
      </main>
    </div>
  );
}
