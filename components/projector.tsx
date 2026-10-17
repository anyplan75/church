"use client";

import { useEffect, useState } from "react";
import { readDb, refreshChurchNow } from "@/lib/app-db";
import { desktopApi, isDesktopApp } from "@/lib/desktop-api";
import { liveView, type LiveView } from "@/lib/live-view";
import { outputHoldText, type OutputLinkStatus } from "@/lib/output-cue";
import { lineFontSize } from "@/lib/simple";
import { startViewerLink } from "@/lib/output-link";

export function Projector({ initial, mode = "main" }: { initial: LiveView; mode?: "overlay" | "main" | "" }) {
  const [view, setView] = useState(initial);
  const [cue, setCue] = useState<string[] | null>(null);
  const [link, setLink] = useState<OutputLinkStatus>("waiting");
  const shown = mode === "overlay" ? "overlay" : "main";

  useEffect(() => {
    if (mode !== "overlay" && mode !== "main") return;
    const api = desktopApi();
    if (api) {
      setLink("waiting");
      return api.onLines((payload) => {
        setCue((current) => (sameLines(current, payload.lines) ? current : payload.lines));
        setLink("direct");
      });
    }
    if (isDesktopApp()) return;
    return startViewerLink(
      initial.serviceId,
      mode,
      (lines) => {
        setCue((current) => (sameLines(current, lines) ? current : lines));
        setLink("direct");
      },
      (status) => setLink(status),
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
  const hold = lines.length === 0 ? outputHoldText(link) : "";
  const style = {
    backgroundColor: view.backgroundColor,
    backgroundImage: view.backgroundUrl ? `url("${view.backgroundUrl}")` : undefined,
    fontFamily: view.fontFamily,
  };

  if (shown === "overlay") {
    return (
      <div className="worship-output" style={{ background: "transparent" }} data-output="overlay" data-caption-size={view.overlayFontSize} data-link={link} data-output-lines={lines.length > 0 ? String(lines.length) : undefined}>
        <div className={`worship-shade layout-${view.overlay}`} style={{ fontFamily: view.overlayFontFamily }}>
          {lines.length > 0 ? <CaptionLines lines={lines} size={view.overlayFontSize} /> : hold ? <p data-output-hold>{hold}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="worship-output" style={style} data-output="main" data-caption-size={view.mainFontSize} data-link={link} data-output-lines={lines.length > 0 ? String(lines.length) : undefined}>
      <div className="worship-stage" style={{ justifyContent: "flex-start", paddingTop: `${8 + view.vertical * 14}vh` }}>
        {lines.length > 0 ? <CaptionLines lines={lines} size={view.mainFontSize} /> : hold ? <p className="worship-kicker" data-output-hold>{hold}</p> : null}
      </div>
    </div>
  );
}

function CaptionLines({ lines, size }: { lines: string[]; size: number }) {
  const fontSize = `${lineFontSize(size, lines.join("\n"))}px`;
  return (
    <>
      <p className="worship-pair" data-output-line="1" style={{ fontSize }}>{lines[0]}</p>
      {lines[1] ? <p className="worship-pair" data-output-line="2" style={{ fontSize }}>{lines[1]}</p> : null}
    </>
  );
}

function sameLines(current: string[] | null, lines: string[]): boolean {
  return Boolean(current) && current!.length === lines.length && current!.every((line, index) => line === lines[index]);
}
