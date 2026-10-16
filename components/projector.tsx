"use client";

import { useEffect, useState } from "react";
import { readDb, refreshChurchNow } from "@/lib/app-db";
import { liveView, type LiveView } from "@/lib/live-view";
import { subscribeCue } from "@/lib/output-cue";
import { startViewerLink } from "@/lib/output-link";
import { twoLines } from "@/lib/simple";

export function Projector({ initial, mode = "main" }: { initial: LiveView; mode?: "overlay" | "main" }) {
  const [view, setView] = useState(initial);
  const [cue, setCue] = useState<string[] | null>(null);
  const [via, setVia] = useState("held");

  useEffect(() => subscribeCue(initial.serviceId, setCue), [initial.serviceId]);
  useEffect(
    () =>
      startViewerLink(initial.serviceId, (lines) => {
        setCue(lines);
        setVia("webrtc");
      }),
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

  const slide = view.slide;
  const bodyLines = cue && cue.length > 0 ? cue : [];
  const lines = bodyLines.length > 0 ? [bodyLines[0], bodyLines[1] ?? ""] : twoLines(slide?.heading ?? "", slide?.lines[0] ?? "");
  const style = {
    backgroundColor: view.backgroundColor,
    backgroundImage: view.backgroundUrl ? `url("${view.backgroundUrl}")` : undefined,
    fontFamily: view.fontFamily,
  };
  const captionLines = bodyLines.length > 0 ? bodyLines : [slide?.overlay || lines.filter(Boolean).join(" ")];

  if (mode === "overlay") {
    return (
      <div className="worship-output" style={{ background: "transparent" }} data-output="overlay" data-link={via}>
        <div className={`worship-shade layout-${view.overlay}`} style={{ fontFamily: view.overlayFontFamily }}>
          <p data-output-lines={bodyLines.length > 0 ? String(bodyLines.length) : undefined}>
            {captionLines[0] || "자막"}
            {captionLines[1] ? (
              <>
                <br />
                {captionLines[1]}
              </>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="worship-output" style={style} data-output="main" data-link={via}>
      <div className="worship-stage" style={{ justifyContent: "flex-start", paddingTop: `${8 + view.vertical * 14}vh` }}>
        {slide || bodyLines.length > 0 ? (
          bodyLines.length > 0 ? (
            <>
              <p className="worship-pair" data-output-line="1">{bodyLines[0]}</p>
              {bodyLines[1] ? <p className="worship-pair" data-output-line="2">{bodyLines[1]}</p> : null}
            </>
          ) : (
            <>
              <p className="worship-kicker">{slide?.kicker}</p>
              <h1 className="worship-heading">{lines[0]}</h1>
              {lines[1] ? <p className="worship-line">{lines[1]}</p> : null}
            </>
          )
        ) : (
          <h1 className="worship-heading">순서가 없습니다</h1>
        )}
      </div>
    </div>
  );
}
