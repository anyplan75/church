"use client";

import { useEffect, useState } from "react";
import { readDb, refreshChurchNow } from "@/lib/app-db";
import { liveView, type LiveView } from "@/lib/live-view";
import { outputHoldText } from "@/lib/output-cue";
import { detectPrivateAddress, saveThisComputer, thisComputer } from "@/lib/output-host";
import { startViewerLink } from "@/lib/output-link";

export function Projector({ initial, mode = "main" }: { initial: LiveView; mode?: "overlay" | "main" | "" }) {
  const [view, setView] = useState(initial);
  const [cue, setCue] = useState<string[] | null>(null);
  const [link, setLink] = useState("waiting");
  const shown = mode === "overlay" ? "overlay" : "main";

  useEffect(() => {
    if (mode !== "overlay" && mode !== "main") return;
    return startViewerLink(
      initial.serviceId,
      mode,
      (lines) => {
        setCue((current) => (sameLines(current, lines) ? current : lines));
        setLink("direct");
      },
      (status) => {
        if (status === "retry") setLink((current) => (current === "direct" ? current : "retry"));
      },
    );
  }, [initial.serviceId, mode]);

  useEffect(() => {
    let stop = false;
    function tick() {
      if (stop) return;
      refreshChurchNow();
      const next = liveView(readDb(), initial.serviceId);
      if (next) setView(next);
    }
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [initial.serviceId]);

  const lines = cue ?? [];
  const hold = lines.length === 0 && link !== "direct" ? outputHoldText(link === "retry" ? "retry" : "waiting") : "";
  const style = {
    backgroundColor: view.backgroundColor,
    backgroundImage: view.backgroundUrl ? `url("${view.backgroundUrl}")` : undefined,
    fontFamily: view.fontFamily,
  };

  if (shown === "overlay") {
    return (
      <div className="worship-output" style={{ background: "transparent" }} data-output="overlay" data-link={link} data-output-lines={lines.length > 0 ? String(lines.length) : undefined}>
        <ThisComputer />
        <div className={`worship-shade layout-${view.overlay}`} style={{ fontFamily: view.overlayFontFamily }}>
          {lines.length > 0 ? (
            <>
              <p className="worship-pair" data-output-line="1">{lines[0]}</p>
              {lines[1] ? <p className="worship-pair" data-output-line="2">{lines[1]}</p> : null}
            </>
          ) : hold ? (
            <p data-output-hold>{hold}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="worship-output" style={style} data-output="main" data-link={link} data-output-lines={lines.length > 0 ? String(lines.length) : undefined}>
      <ThisComputer />
      <div className="worship-stage" style={{ justifyContent: "flex-start", paddingTop: `${8 + view.vertical * 14}vh` }}>
        {lines.length > 0 ? (
          <>
            <p className="worship-pair" data-output-line="1">{lines[0]}</p>
            {lines[1] ? <p className="worship-pair" data-output-line="2">{lines[1]}</p> : null}
          </>
        ) : hold ? (
          <p className="worship-kicker" data-output-hold>{hold}</p>
        ) : null}
      </div>
    </div>
  );
}

const OUTPUT_IP_EXAMPLE = "192.168.0.10";
const OUTPUT_IP_PROMPT = "이 컴퓨터의 192.168 주소를 입력";

function ThisComputer() {
  const [host, setHost] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = thisComputer();
    if (stored) {
      setHost(stored);
      setDraft(stored);
      setReady(true);
      return;
    }
    let stop = false;
    void detectPrivateAddress().then((found) => {
      if (stop) return;
      if (found) {
        saveThisComputer(found);
        setHost(found);
        setDraft(found);
      } else setEditing(true);
      setReady(true);
    });
    return () => {
      stop = true;
    };
  }, []);

  if (!ready) {
    return (
      <p className="output-address">
        <span>이 송출 컴퓨터의 IP</span>
        <span>{OUTPUT_IP_PROMPT}</span>
        <span className="output-address-example">예: {OUTPUT_IP_EXAMPLE}</span>
      </p>
    );
  }
  if (host && !editing) {
    return (
      <p className="output-address" data-output-ip={host} onClick={() => setEditing(true)}>
        <span>이 송출 컴퓨터의 IP</span>
        <span>{host}</span>
        <span className="output-address-example">예: {OUTPUT_IP_EXAMPLE}</span>
      </p>
    );
  }
  return (
    <label className="output-address" data-output-ip={host || undefined}>
      <span>이 송출 컴퓨터의 IP</span>
      <input
        value={draft}
        inputMode="decimal"
        autoComplete="off"
        aria-label="이 송출 컴퓨터의 IP"
        placeholder={OUTPUT_IP_PROMPT}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commitAddress(draft, setHost, setDraft, setEditing)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          commitAddress(draft, setHost, setDraft, setEditing);
        }}
      />
      <span className="output-address-example">예: {OUTPUT_IP_EXAMPLE}</span>
    </label>
  );
}

function commitAddress(draft: string, setHost: (value: string) => void, setDraft: (value: string) => void, setEditing: (value: boolean) => void) {
  const saved = saveThisComputer(draft.trim());
  if (!saved) return;
  setHost(saved);
  setDraft(saved);
  setEditing(false);
}

function sameLines(current: string[] | null, lines: string[]): boolean {
  return Boolean(current) && current!.length === lines.length && current!.every((line, index) => line === lines[index]);
}
