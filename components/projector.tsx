"use client";

import { useEffect, useState } from "react";
import { readDb } from "@/lib/app-db";
import { liveView, type LiveView } from "@/lib/live-view";
import { twoLines } from "@/lib/simple";

export function Projector({ initial, mode = "main" }: { initial: LiveView; mode?: "overlay" | "main" }) {
  const [view, setView] = useState(initial);

  useEffect(() => {
    let stop = false;
    async function tick() {
      if (stop) return;
      const next = liveView(readDb(), initial.serviceId);
      if (next) setView(next);
    }
    const timer = window.setInterval(() => void tick(), 1000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [initial.serviceId]);

  const slide = view.slide;
  const lines = twoLines(slide?.heading ?? "", slide?.lines[0] ?? "");
  const style = {
    backgroundColor: view.backgroundColor,
    backgroundImage: view.backgroundUrl ? `url("${view.backgroundUrl}")` : undefined,
    fontFamily: view.fontFamily,
  };

  const caption = slide?.overlay || lines.filter(Boolean).join(" ");

  if (mode === "overlay") {
    return (
      <div className="worship-output" style={{ background: "transparent" }}>
        <div className={`worship-shade layout-${view.overlay}`} style={{ fontFamily: view.overlayFontFamily }}>
          <p>{caption || "자막"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="worship-output" style={style}>
      <div className="worship-stage" style={{ justifyContent: "flex-start", paddingTop: `${8 + view.vertical * 14}vh` }}>
        {view.status !== "live" ? <p className="worship-kicker">미리보기</p> : null}
        {slide ? (
          <>
            <p className="worship-kicker">{slide.kicker}</p>
            <h1 className="worship-heading">{lines[0]}</h1>
            {lines[1] ? <p className="worship-line">{lines[1]}</p> : null}
          </>
        ) : (
          <h1 className="worship-heading">순서가 없습니다</h1>
        )}
      </div>
    </div>
  );
}
