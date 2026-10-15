"use client";

import { useEffect, useState } from "react";
import { useServiceFolder } from "@/components/service-folder";
import { readDb } from "@/lib/app-db";
import { liveView, type LiveView } from "@/lib/live-view";
import { twoLines } from "@/lib/simple";
import type { Service, Song } from "@/lib/types";

export function Projector({ initial, mode = "main" }: { initial: LiveView; mode?: "overlay" | "main" }) {
  const [view, setView] = useState(initial);
  const [bundle, setBundle] = useState<{ service: Service | null; songs: Song[]; liveSlide: number }>({ service: null, songs: [], liveSlide: 0 });
  const folder = useServiceFolder(bundle.service, bundle.songs);

  useEffect(() => {
    let stop = false;
    function tick() {
      if (stop) return;
      const db = readDb();
      const service = db.services.find((item) => item.id === initial.serviceId) ?? null;
      setBundle({ service, songs: db.songs, liveSlide: service?.liveSlide ?? 0 });
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
  const fill = slide ? folder.fills[slide.itemId] : undefined;
  const chunk = fill && fill.slides.length > 0 ? fill.slides[Math.min(bundle.liveSlide, fill.slides.length - 1)] : "";
  const bodyLines = chunk.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2);
  const lines = bodyLines.length > 0 ? [bodyLines[0], bodyLines[1] ?? ""] : twoLines(slide?.heading ?? "", slide?.lines[0] ?? "");
  const style = {
    backgroundColor: view.backgroundColor,
    backgroundImage: view.backgroundUrl ? `url("${view.backgroundUrl}")` : undefined,
    fontFamily: view.fontFamily,
  };

  const captionLines = bodyLines.length > 0 ? bodyLines : [slide?.overlay || lines.filter(Boolean).join(" ")];

  if (mode === "overlay") {
    return (
      <div className="worship-output" style={{ background: "transparent" }}>
        <div className={`worship-shade layout-${view.overlay}`} style={{ fontFamily: view.overlayFontFamily }}>
          <p>
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
