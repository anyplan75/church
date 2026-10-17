"use client";

import { useEffect, useState } from "react";
import { desktopApi, isDesktopApp, type DesktopPeer } from "@/lib/desktop-api";
import { listOutputPeers, rememberLanHost, subscribeLanStatus } from "@/lib/lan-link";
import { isMobileOperatorApp } from "@/lib/mobile-app";
import { hostEntry } from "@/lib/output-host";

export function OutputTargetField({
  value,
  onChange,
}: {
  value: string;
  onChange: (host: string) => void;
}) {
  const [peers, setPeers] = useState<DesktopPeer[]>([]);
  const [lanStatus, setLanStatus] = useState("idle");
  const desktop = isDesktopApp();
  const mobile = isMobileOperatorApp();
  const problem = hostEntry(value).problem;
  const statusLabel =
    lanStatus === "direct" ? "연결됨" : lanStatus === "connecting" ? "연결 중" : lanStatus === "error" ? "다시 연결 중" : "";

  useEffect(() => subscribeLanStatus(setLanStatus), []);

  useEffect(() => {
    if (!desktop) return;
    const api = desktopApi();
    if (!api) return;
    void api.listPeers().then(setPeers);
    void listOutputPeers().then(setPeers);
    return api.onPeers(setPeers);
  }, [desktop]);

  return (
    <div className="space-y-3">
      <label className="field">
        <span>송출 컴퓨터</span>
        <input
          className="input input-touch"
          name="outputHost"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            const host = hostEntry(event.target.value).host;
            if (host) rememberLanHost(host);
          }}
          inputMode="decimal"
          autoComplete="off"
          placeholder="예: 192.168.0.10"
          maxLength={200}
          aria-label="송출 컴퓨터"
        />
      </label>
      {desktop ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-quiet btn-touch"
              onClick={() => {
                void listOutputPeers().then(setPeers);
              }}
            >
              송출 컴퓨터 찾기
            </button>
            {peers.map((peer) => (
              <button
                key={`${peer.host}:${peer.port}`}
                type="button"
                className="btn btn-quiet btn-touch"
                onClick={() => {
                  onChange(peer.host);
                  rememberLanHost(peer.host);
                }}
              >
                {peer.name === peer.host ? peer.host : `${peer.name} (${peer.host})`}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">
            같은 네트워크의 송출 앱을 고르거나 IP를 한 곳에만 넣습니다. 저장하면 껐다 켜도 다시 붙습니다.
            {statusLabel ? ` · ${statusLabel}` : ""}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {mobile
            ? "송출 Mac/Windows의 IP를 넣습니다. 같은 Wi‑Fi에서 포트 18765로 지금 두 줄만 보냅니다."
            : "송출은 데스크톱 송출 앱으로 받습니다. 예: 192.168.0.10"}
          {statusLabel ? ` · ${statusLabel}` : ""}
        </p>
      )}
      {problem === "url" ? <p className="text-sm text-wine">웹 주소가 아니라 송출 컴퓨터의 IP만 넣어 주세요.</p> : null}
      {problem === "invalid" ? <p className="text-sm text-wine">이 송출 컴퓨터의 IP만 넣어 주세요. 예: 192.168.0.10</p> : null}
    </div>
  );
}
