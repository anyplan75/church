"use client";

import { useCallback, useEffect, useState } from "react";
import { useChurch } from "@/components/church-state";
import { createModule, joinModule, leaveModule, loadModuleSnapshot } from "@/lib/modules-db";
import type { ModuleSnapshot } from "@/lib/modules";
import { can } from "@/lib/roles";

/**
 * 모들(교회 연결) 관리.
 * 연결되면 실시간 자막·주보 입력을 연결된 교회와 공유하고,
 * 연결을 끊으면 각 교회 자료만 따로 저장합니다.
 */
export function ChurchLinksPanel() {
  const { ready, user, db } = useChurch();
  const [snap, setSnap] = useState<ModuleSnapshot | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const churchId = user?.churchId || "";
  const canManage = Boolean(user && churchId && (user.kind === "platform" || can(user.roles, "mutate.admin")));

  const reload = useCallback(async () => {
    if (!churchId) {
      setSnap(null);
      return;
    }
    const next = await loadModuleSnapshot(churchId);
    setSnap(next);
  }, [churchId]);

  useEffect(() => {
    if (!ready || !churchId) return;
    void reload();
  }, [ready, churchId, reload]);

  if (!ready || !user || !db || !churchId) return null;

  async function run(action: () => Promise<{ ok: true; moduleId?: string } | { ok: false; message: string }>, okText: string) {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(okText);
    setName("");
    setCode("");
    await reload();
  }

  const linked = Boolean(snap?.membership && snap.meta);
  const peers = (snap?.members || []).filter((row) => row.churchId !== churchId);

  return (
    <section className="card mt-6 space-y-4 p-5" id="church-links">
      <h2 className="font-serif text-2xl">교회 연결 (모들)</h2>
      <p className="text-sm text-muted">
        다른 교회와 연결하면 <strong>실시간 자막</strong>과 <strong>주보 입력</strong>을 함께 씁니다. 연결하지 않으면 이 교회 자료만 따로 저장됩니다.
      </p>

      {message ? <p className="text-sm text-pine">{message}</p> : null}
      {error ? <p className="text-sm text-wine">{error}</p> : null}

      {linked && snap?.meta ? (
        <div className="space-y-3 rounded-xl border border-line p-4">
          <p className="font-medium">{snap.meta.name}</p>
          <p className="text-sm text-muted">
            연결 코드: <span className="font-mono text-ink">{snap.meta.id}</span>
          </p>
          <ul className="space-y-1 text-sm">
            {(snap.members || []).map((member) => (
              <li key={member.churchId}>
                {member.name}
                {member.churchId === churchId ? " (이 교회)" : ""}
                {member.churchId === snap.meta?.hostChurchId ? " · 만든 교회" : ""}
              </li>
            ))}
          </ul>
          {peers.length === 0 ? <p className="text-sm text-muted">아직 다른 교회가 없습니다. 연결 코드를 공유해 주세요.</p> : null}
          {canManage ? (
            <button
              type="button"
              className="btn btn-quiet text-wine"
              disabled={busy}
              onClick={() => void run(() => leaveModule(), "연결을 끊었습니다. 이제 이 교회 자료만 따로 저장합니다.")}
            >
              연결 끊기
            </button>
          ) : (
            <p className="text-sm text-muted">연결을 바꾸려면 설정·계정 역할이 필요합니다.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {!canManage ? <p className="text-sm text-muted">연결을 만들거나 참여하려면 설정·계정 역할이 필요합니다.</p> : null}
          {canManage ? (
            <>
              <div className="space-y-3 rounded-xl border border-line p-4">
                <h3 className="font-serif text-lg">새 연결 만들기</h3>
                <label className="field">
                  <span>연결 이름</span>
                  <input
                    className="input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={40}
                    placeholder={`${db.settings.churchName} 연결`}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-quiet"
                  disabled={busy}
                  onClick={() => void run(() => createModule(name), "연결을 만들었습니다. 코드를 다른 교회에 알려 주세요.")}
                >
                  만들기
                </button>
              </div>
              <div className="space-y-3 rounded-xl border border-line p-4">
                <h3 className="font-serif text-lg">코드로 참여</h3>
                <label className="field">
                  <span>연결 코드</span>
                  <input
                    className="input font-mono"
                    value={code}
                    onChange={(event) => setCode(event.target.value.trim())}
                    maxLength={20}
                    placeholder="m…"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-quiet"
                  disabled={busy || !code}
                  onClick={() => void run(() => joinModule(code), "연결에 참여했습니다. 자막·주보가 함께 공유됩니다.")}
                >
                  참여
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
