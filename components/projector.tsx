"use client";

import { useEffect, useState } from "react";
import { readDb, refreshChurchNow } from "@/lib/app-db";
import { liveView, type LiveView } from "@/lib/live-view";
import { cueLines, subscribeCue } from "@/lib/output-cue";
import { twoLines } from "@/lib/simple";
import type { Service, Song } from "@/lib/types";

export function Projector({ initial, mode = "main" }: { initial: LiveView; mode?: "overlay" | "main" }) {
  const [view, setView] = useState(initial);
  const [bundle, setBundle] = useState<{ service: Service | null; songs: Song[] }>({ service: null, songs: [] });
  const [cue, setCue] = useState<string[] | null>(null);

  useEffect(() => subscribeCue(initial.serviceId, setCue), [initial.serviceId]);

  useEffect(() => {
    let stop = false;
    function tick() {
      if (stop) return;
      refreshChurchNow();
      const db = readDb();
      const service = db.services.find((item) => item.id === initial.serviceId) ?? null;
      setBundle({ service, songs: db.songs });
      const next = liveView(db, initial.serviceId);
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
  const stored = cueLines(bundle.service?.outputLines ?? []);
  const bodyLines = cue ?? stored;
  const lines = bodyLines.length > 0 ? [bodyLines[0], bodyLines[1] ?? ""] : twoLines(slide?.heading ?? "", slide?.lines[0] ?? "");
  const style = {
    backgroundColor: view.backgroundColor,
    backgroundImage: view.backgroundUrl ? `url("${view.backgroundUrl}")` : undefined,
    fontFamily: view.fontFamily,
  };
  const captionLines = bodyLines.length > 0 ? bodyLines : [slide?.overlay || lines.filter(Boolean).join(" ")];

  if (mode === "overlay") {
    return (
      <div className="worship-output" style={{ background: "transparent" }} data-output="overlay">
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
    <div className="worship-output" style={style} data-output="main">
      <div className="worship-stage" style={{ justifyContent: "flex-start", paddingTop: `${8 + view.vertical * 14}vh` }}>
        {view.status !== "live" ? <p className="worship-kicker">미리보기</p> : null}
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
