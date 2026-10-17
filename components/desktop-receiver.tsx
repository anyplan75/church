"use client";

import { useEffect, useState } from "react";
import { desktopApi, type DesktopLinesPayload } from "@/lib/desktop-api";
import { lineFontSize } from "@/lib/simple";

type Mode = "main" | "overlay";

const DEFAULT_STYLE = {
  backgroundColor: "#1b3a32",
  backgroundUrl: "",
  overlay: "bottom",
  mainFontSize: 64,
  overlayFontSize: 48,
  vertical: 0.55,
};

export function DesktopReceiver() {
  const [mode, setMode] = useState<Mode>("main");
  const [lines, setLines] = useState<string[]>([]);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [ready, setReady] = useState(false);
  const [host, setHost] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMode(params.get("mode") === "overlay" ? "overlay" : "main");
  }, []);

  useEffect(() => {
    const api = desktopApi();
    if (!api) {
      setReady(true);
      return;
    }
    void api.outputStatus().then((status) => {
      setHost(status.host);
      setReady(true);
    });
    const stopLines = api.onLines((payload: DesktopLinesPayload) => {
      setLines(payload.lines);
      if (payload.style) {
        setStyle((current) => ({
          ...current,
          backgroundColor: payload.style?.backgroundColor || current.backgroundColor,
          backgroundUrl: payload.style?.backgroundUrl || current.backgroundUrl,
          overlay: payload.style?.overlay || current.overlay,
          mainFontSize: payload.style?.mainFontSize || current.mainFontSize,
          overlayFontSize: payload.style?.overlayFontSize || current.overlayFontSize,
          vertical: typeof payload.style?.vertical === "number" ? payload.style.vertical : current.vertical,
        }));
      }
    });
    const stopStatus = api.onOutputStatus((status) => setHost(status.host));
    return () => {
      stopLines();
      stopStatus();
    };
  }, []);

  if (mode === "overlay") {
    return (
      <div className="worship-output" style={{ background: "transparent" }} data-output="overlay" data-desktop-receive="1">
        <div className={`worship-shade layout-${style.overlay}`}>
          {lines.length > 0 ? <CaptionLines lines={lines} size={style.overlayFontSize} /> : null}
        </div>
        {ready && lines.length === 0 ? <ReadyMark host={host} quiet /> : null}
      </div>
    );
  }

  return (
    <div
      className="worship-output"
      data-output="main"
      data-desktop-receive="1"
      style={{
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundUrl ? `url("${style.backgroundUrl}")` : undefined,
      }}
    >
      <div className="worship-stage" style={{ justifyContent: "flex-start", paddingTop: `${8 + style.vertical * 14}vh` }}>
        {lines.length > 0 ? <CaptionLines lines={lines} size={style.mainFontSize} /> : <ReadyMark host={host} />}
      </div>
    </div>
  );
}

function CaptionLines({ lines, size }: { lines: string[]; size: number }) {
  const fontSize = `${lineFontSize(size, lines.join("\n"))}px`;
  return (
    <>
      <p className="worship-pair" data-output-line="1" style={{ fontSize }}>
        {lines[0]}
      </p>
      {lines[1] ? (
        <p className="worship-pair" data-output-line="2" style={{ fontSize }}>
          {lines[1]}
        </p>
      ) : null}
    </>
  );
}

function ReadyMark({ host, quiet = false }: { host: string; quiet?: boolean }) {
  if (quiet) return null;
  return (
    <p className="worship-kicker" data-output-ready>
      {host ? `받을 준비 · ${host}` : "받을 준비"}
    </p>
  );
}
