"use client";

import { useEffect, useState } from "react";
import type { LiveView } from "@/lib/live-view";

export function Projector({ initial }: { initial: LiveView }) {
  const [view, setView] = useState(initial);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const response = await fetch(`/api/services/${initial.serviceId}/live`, { cache: "no-store" });
        if (!response.ok || stop) return;
        setView((await response.json()) as LiveView);
      } catch {
        // 다음 주기에 다시 읽습니다.
      }
    }
    const timer = window.setInterval(() => void tick(), 1000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [initial.serviceId]);

  const slide = view.slide;
  const style = {
    backgroundColor: view.backgroundColor,
    backgroundImage: view.backgroundUrl ? `url("${view.backgroundUrl}")` : undefined,
  };

  return (
    <div className="worship-output" style={style}>
      <div className="worship-stage">
        {view.status !== "live" ? <p className="worship-kicker">미리보기</p> : null}
        {slide ? (
          <>
            <p className="worship-kicker">{slide.kicker}</p>
            <h1 className="worship-heading">{slide.heading}</h1>
            {slide.lines.map((line) => (
              <p key={line} className="worship-line">
                {line}
              </p>
            ))}
            {slide.footer ? <p className="worship-footer">{slide.footer}</p> : null}
          </>
        ) : (
          <h1 className="worship-heading">순서가 없습니다</h1>
        )}
      </div>
      {slide?.overlay ? (
        <div className={`worship-overlay layout-${view.overlay}`}>
          <p>{slide.overlay}</p>
        </div>
      ) : null}
    </div>
  );
}
