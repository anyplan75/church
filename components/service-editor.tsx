"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addRosterPerson, copyServiceNextWeek, deleteService, saveService } from "@/lib/actions";
import { START_BLOCKED, settingsReady } from "@/lib/simple";
import { ITEM_KINDS, SERVICE_TYPES, type ItemKind, type Person, type Reminder, type Service, type Settings, type Song } from "@/lib/types";
import { assignmentProgress, createItem, kindLabel, reorder, songOptionLabel, templateItems } from "@/lib/worship";
import { StatusBadge } from "./status-badge";

type SaveResult = { ok: true } | { ok: false; message: string };

export function ServiceEditor({
  service,
  people,
  songs,
  settings,
  reminders,
  access,
}: {
  service: Service;
  people: Person[];
  songs: Song[];
  settings: Settings;
  reminders: Reminder[];
  access: { live: boolean; output: boolean; bulletin: boolean };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(service);
  const [addedPeople, setAddedPeople] = useState<Person[]>([]);
  const [addingId, setAddingId] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveMessage, setSaveMessage] = useState("");
  const [startError, setStartError] = useState("");
  const draftRef = useRef(draft);
  const dirty = useRef(false);
  const version = useRef(0);
  const timer = useRef<number | null>(null);
  const queue = useRef(Promise.resolve());
  draftRef.current = draft;

  function enqueue(snapshot: Service, snapshotVersion: number): Promise<SaveResult> {
    setSaveState("saving");
    const job = queue.current.then(() => saveService(snapshot));
    queue.current = job.then(
      () => undefined,
      () => undefined,
    );
    return job.then((result) => {
      if (!result.ok) {
        dirty.current = true;
        setSaveState("error");
        setSaveMessage(result.message);
        return result;
      }
      if (snapshotVersion === version.current) dirty.current = false;
      setSaveState("saved");
      setSaveMessage("");
      return result;
    });
  }

  useEffect(() => {
    if (!dirty.current) return;
    const snapshotVersion = version.current;
    timer.current = window.setTimeout(() => {
      void enqueue(draftRef.current, snapshotVersion);
    }, 400);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [draft]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (dirty.current) {
        const snapshot = draftRef.current;
        queue.current = queue.current
          .then(() => saveService(snapshot))
          .then(
            () => undefined,
            () => undefined,
          );
      }
    };
  }, []);

  function update(recipe: (current: Service) => Service) {
    version.current += 1;
    dirty.current = true;
    setDraft(recipe);
  }

  async function flush(next: Service) {
    if (timer.current) window.clearTimeout(timer.current);
    version.current += 1;
    const snapshotVersion = version.current;
    dirty.current = false;
    setDraft(next);
    return enqueue(next, snapshotVersion);
  }

  const progress = assignmentProgress(draft);
  const missing = progress.total - progress.assigned;
  const saveLabel = saveState === "saving" ? "저장 중" : saveState === "error" ? saveMessage || "저장하지 못했습니다" : "저장됨";

  const unlocked = settingsReady(settings);
  void reminders;

  async function beginLive() {
    const current = draftRef.current;
    if (current.items.length === 0) return;
    if (!unlocked) {
      setStartError(START_BLOCKED);
      return;
    }
    setStartError("");
    const next: Service = {
      ...current,
      status: "live",
      liveIndex: 0,
      startedAt: new Date().toISOString(),
    };
    const result = await flush(next);
    if (result.ok) router.push(`/services/${next.id}/live`);
    else setStartError(result.message);
  }

  async function openLive() {
    const result = await flush(draftRef.current);
    if (result.ok) router.push(`/services/${draft.id}/live`);
  }

  async function markReady() {
    await flush({ ...draftRef.current, status: "ready", startedAt: null });
  }

  async function copyNext() {
    const result = await flush(draftRef.current);
    if (result.ok) await copyServiceNextWeek(draft.id);
  }

  async function remove() {
    if (!window.confirm("이 예배를 삭제할까요? 순서와 광고도 함께 지워집니다.")) return;
    if (timer.current) window.clearTimeout(timer.current);
    dirty.current = false;
    await deleteService(draft.id);
  }

  function patchItem(id: string, patch: Partial<Service["items"][number]>) {
    update((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  const roster = people.concat(addedPeople.filter((person) => !people.some((entry) => entry.id === person.id)));

  async function linkPendingPerson(itemId: string, pendingName: string) {
    setAddingId(itemId);
    const result = await addRosterPerson(pendingName);
    if (!result.ok) {
      setAddingId("");
      setSaveState("error");
      setSaveMessage(result.message);
      return;
    }
    setAddedPeople((current) =>
      current.some((person) => person.id === result.id)
        ? current
        : [...current, { id: result.id, name: result.name, roles: [], phone: "", active: true, membership: "member", attendanceConsent: false }],
    );
    const current = draftRef.current;
    const items = current.items.map((item) => (item.id === itemId ? { ...item, personId: result.id, pendingName: "" } : item));
    const linked = items.find((item) => item.id === itemId);
    const next: Service = {
      ...current,
      preacherId: linked?.kind === "sermon" && !current.preacherId ? result.id : current.preacherId,
      items,
    };
    await flush(next);
    setAddingId("");
    router.refresh();
  }

  return (
    <div className="page">
      <Link href="/services" className="text-sm text-muted">
        예배 목록
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            className="input-title"
            aria-label="예배 이름"
            value={draft.title}
            maxLength={80}
            onChange={(event) => update((current) => ({ ...current, title: event.target.value }))}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={draft.status} />
            <span className={saveState === "error" ? "text-sm text-wine" : "text-sm text-muted"}>{saveLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {access.bulletin ? (
            <Link href={`/services/${draft.id}/bulletin`} className="btn btn-quiet">
              주보
            </Link>
          ) : null}
          {access.output ? (
            <Link href={`/services/${draft.id}/slides`} className="btn btn-quiet">
              슬라이드
            </Link>
          ) : null}
          {access.output ? (
            <Link href={`/services/${draft.id}/output`} target="_blank" className="btn btn-quiet">
              송출 화면
            </Link>
          ) : null}
          {draft.status === "planning" ? (
            <button type="button" className="btn btn-quiet" onClick={() => void markReady()}>
              준비 완료
            </button>
          ) : null}
          {access.live && draft.status === "live" ? (
            <button type="button" className="btn btn-primary" onClick={() => void openLive()}>
              진행 화면
            </button>
          ) : null}
          {access.live && draft.status !== "live" && draft.status !== "done" ? (
            <button type="button" className="btn btn-primary" onClick={() => void beginLive()} disabled={draft.items.length === 0 || !unlocked}>
              예배 시작
            </button>
          ) : null}
          {access.live && draft.status === "done" ? (
            <button type="button" className="btn btn-quiet" onClick={() => void openLive()}>
              진행 기록
            </button>
          ) : null}
          <button type="button" className="btn btn-quiet" onClick={() => void copyNext()}>
            다음 주로 복사
          </button>
        </div>
      </div>
      {unlocked ? null : <p className="mt-4 text-sm text-wine">{START_BLOCKED}</p>}
      <label className="field mt-4 max-w-sm">
        <span>담당 그룹</span>
        <select
          className="select"
          value={draft.groupId ?? ""}
          onChange={(event) => update((current) => ({ ...current, groupId: event.target.value || null }))}
        >
          <option value="">그룹 없음</option>
          {(settings.groups ?? []).map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      {startError ? <p className="mt-4 text-sm text-wine">{startError}</p> : null}

      <div className="mt-6 grid gap-3 md:grid-cols-5">
        <label className="field">
          <span>날짜</span>
          <input className="input" type="date" value={draft.date} onChange={(event) => update((current) => ({ ...current, date: event.target.value }))} />
        </label>
        <label className="field">
          <span>시간</span>
          <input className="input" type="time" value={draft.time} onChange={(event) => update((current) => ({ ...current, time: event.target.value }))} />
        </label>
        <label className="field">
          <span>종류</span>
          <select className="select" value={draft.type} onChange={(event) => update((current) => ({ ...current, type: event.target.value as Service["type"] }))}>
            {SERVICE_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>장소</span>
          <input className="input" value={draft.place} maxLength={40} onChange={(event) => update((current) => ({ ...current, place: event.target.value }))} />
        </label>
        <label className="field">
          <span>설교자</span>
          <select
            className="select"
            value={draft.preacherId ?? ""}
            onChange={(event) => update((current) => ({ ...current, preacherId: event.target.value || null }))}
          >
            <option value="">없음</option>
            {selectablePeople(roster, draft.preacherId).map((person) => (
              <option key={person.id} value={person.id}>
                {personLabel(person)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {missing > 0 ? (
        <p className="mt-4 rounded-2xl bg-[#f8e4e6] px-4 py-3 text-sm text-wine">담당자가 비어 있는 순서가 {missing}개 있습니다.</p>
      ) : null}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">예배 순서</h2>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => update((current) => ({ ...current, items: [...current.items, createItem("hymn")] }))}>
            순서 추가
          </button>
        </div>
        {draft.items.length === 0 ? (
          <div className="card mt-4 px-5 py-8 text-center">
            <p className="text-muted">아직 순서가 없습니다.</p>
            <button
              type="button"
              className="btn btn-primary mt-4"
              onClick={() =>
                update((current) => ({
                  ...current,
                  items: templateItems(current.type).map((item) => ({ ...item, id: crypto.randomUUID() })),
                }))
              }
            >
              기본 순서 넣기
            </button>
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {draft.items.map((item, index) => (
              <li key={item.id} className="card p-4">
                <div className="grid gap-2 md:grid-cols-[4.5rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="field">
                    <span>{index + 1}</span>
                    <select
                      className="select"
                      aria-label={`${index + 1}번 구분`}
                      value={item.kind}
                      onChange={(event) => {
                        const kind = event.target.value as ItemKind;
                        patchItem(item.id, {
                          kind,
                          title: item.title === kindLabel(item.kind) ? kindLabel(kind) : item.title,
                        });
                      }}
                    >
                      {ITEM_KINDS.map((kind) => (
                        <option key={kind.id} value={kind.id}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>순서</span>
                    <input className="input" value={item.title} maxLength={80} onChange={(event) => patchItem(item.id, { title: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>담당</span>
                    <select
                      className="select"
                      value={item.personId ?? ""}
                      onChange={(event) => {
                        const personId = event.target.value || null;
                        patchItem(item.id, { personId, pendingName: personId ? "" : item.pendingName });
                      }}
                    >
                      <option value="">없음</option>
                      {selectablePeople(roster, item.personId).map((person) => (
                        <option key={person.id} value={person.id}>
                          {personLabel(person)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>찬양</span>
                    <select className="select" value={item.songId ?? ""} onChange={(event) => patchItem(item.id, { songId: event.target.value || null })}>
                      <option value="">없음</option>
                      {songs.map((song) => (
                        <option key={song.id} value={song.id}>
                          {songOptionLabel(song)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end gap-1">
                    <button type="button" className="btn btn-quiet btn-small" disabled={index === 0} onClick={() => update((current) => ({ ...current, items: reorder(current.items, item.id, -1) }))}>
                      위로
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet btn-small"
                      disabled={index === draft.items.length - 1}
                      onClick={() => update((current) => ({ ...current, items: reorder(current.items, item.id, 1) }))}
                    >
                      아래로
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet btn-small"
                      onClick={() => update((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))}
                    >
                      삭제
                    </button>
                  </div>
                </div>
                {item.pendingName && !item.personId ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-wine">{item.pendingName} 님은 명단에 없습니다.</p>
                    <button type="button" className="btn btn-quiet btn-small" disabled={addingId === item.id} onClick={() => void linkPendingPerson(item.id, item.pendingName)}>
                      {addingId === item.id ? "추가 중" : "명단에 추가"}
                    </button>
                  </div>
                ) : null}
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {item.kind === "scripture" || item.kind === "sermon" || item.scripture ? (
                    <label className="field">
                      <span>성경</span>
                      <input
                        className="input"
                        value={item.scripture}
                        maxLength={120}
                        placeholder="요한복음 3:16"
                        onChange={(event) => patchItem(item.id, { scripture: event.target.value })}
                      />
                    </label>
                  ) : null}
                  <label className="field">
                    <span>메모</span>
                    <input className="input" value={item.note} maxLength={300} placeholder="설교 제목, 반주, 성가 곡명" onChange={(event) => patchItem(item.id, { note: event.target.value })} />
                  </label>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">광고</h2>
            <button
              type="button"
              className="btn btn-quiet btn-small"
              onClick={() => update((current) => ({ ...current, announcements: [...current.announcements, { id: crypto.randomUUID(), text: "" }] }))}
            >
              광고 추가
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {draft.announcements.length === 0 ? <p className="text-sm text-muted">주보에 실을 광고가 없습니다.</p> : null}
            {draft.announcements.map((announcement, index) => (
              <div key={announcement.id} className="flex gap-2">
                <label className="field flex-1">
                  <span className="sr-only">{index + 1}번 광고</span>
                  <input
                    className="input"
                    value={announcement.text}
                    maxLength={500}
                    onChange={(event) =>
                      update((current) => ({
                        ...current,
                        announcements: current.announcements.map((entry) => (entry.id === announcement.id ? { ...entry, text: event.target.value } : entry)),
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-quiet btn-small self-end"
                  onClick={() => update((current) => ({ ...current, announcements: current.announcements.filter((entry) => entry.id !== announcement.id) }))}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
        <label className="card field p-5">
          <span className="font-serif text-2xl text-ink">운영 메모</span>
          <textarea className="textarea mt-4" value={draft.notes} maxLength={2000} placeholder="인도자만 보는 메모입니다. 주보에는 나오지 않습니다." onChange={(event) => update((current) => ({ ...current, notes: event.target.value }))} />
        </label>
      </section>

      {draft.status !== "live" ? (
        <div className="mt-8">
          <button type="button" className="btn btn-quiet text-wine" onClick={() => void remove()}>
            예배 삭제
          </button>
        </div>
      ) : null}
    </div>
  );
}

function selectablePeople(people: Person[], selected: string | null) {
  return people.filter((person) => person.active || person.id === selected);
}

function personLabel(person: Person) {
  return person.roles[0] ? `${person.name} · ${person.roles[0]}` : person.name;
}
