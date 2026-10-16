"use client";

import { useEffect, useState } from "react";
import { readDb, refreshChurchNow } from "@/lib/app-db";
import { liveView, type LiveView } from "@/lib/live-view";
import { outputHoldText } from "@/lib/output-cue";
import { startViewerLink } from "@/lib/output-link";

export function Projector({ initial, mode = "main" }: { initial: LiveView; mode?: "overlay" | "main" }) {
  const [view, setView] = useState(initial);
  const [cue, setCue] = useState<string[] | null>(null);
  const [link, setLink] = useState("waiting");

  useEffect(
    () =>
      startViewerLink(
        initial.serviceId,
        (lines) => {
          setCue((current) => (sameLines(current, lines) ? current : lines));
          setLink("webrtc");
        },
        (status) => {
          if (status === "retry") setLink((current) => (current === "webrtc" ? current : "retry"));
        },
      ),
    [initial.serviceId],
  );

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
  const hold = lines.length === 0 && link !== "webrtc" ? outputHoldText(link === "retry" ? "retry" : "waiting") : "";
  const style = {
    backgroundColor: view.backgroundColor,
    backgroundImage: view.backgroundUrl ? `url("${view.backgroundUrl}")` : undefined,
    fontFamily: view.fontFamily,
  };

  if (mode === "overlay") {
    return (
      <div className="worship-output" style={{ background: "transparent" }} data-output="overlay" data-link={link} data-output-lines={lines.length > 0 ? String(lines.length) : undefined}>
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

function sameLines(current: string[] | null, lines: string[]): boolean {
  return Boolean(current) && current!.length === lines.length && current!.every((line, index) => line === lines[index]);
}
