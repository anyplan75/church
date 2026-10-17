"use client";

import { useEffect, useState } from "react";
import { useChurch } from "@/components/church-state";
import { startViewerLink } from "@/lib/output-link";
import { detectPrivateAddress, isPrivateIpv4, saveThisComputer } from "@/lib/output-host";
import { captionFont, captionSize, fullscreenStep, lineFontSize } from "@/lib/simple";

export function OutputComputer() {
  const { db } = useChurch();
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    let cancel = false;
    if (isPrivateIpv4(window.location.hostname)) saveThisComputer(window.location.hostname);
    void detectPrivateAddress().then((found) => {
      if (!cancel && isPrivateIpv4(found)) saveThisComputer(found);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const show = (next: string[]) => setLines((current) => (sameLines(current, next) ? current : next));
    const stopMain = startViewerLink("", "main", show);
    const stopOverlay = startViewerLink("", "overlay", show);
    return () => {
      stopMain();
      stopOverlay();
    };
  }, []);

  const size = captionSize(db?.settings.mainFontSize);
  const fontSize = `${lineFontSize(size, lines.join("\n"))}px`;
  const vertical = fullscreenStep(db?.settings.fullscreenStep);

  return (
    <div
      className="worship-output"
      style={{ backgroundColor: db?.settings.backgroundColor || "#1b3a32", fontFamily: captionFont(db?.settings.fullscreenFont).family }}
      data-output="computer"
      data-caption-size={size}
    >
      <div className="worship-stage" style={{ justifyContent: "flex-start", paddingTop: `${8 + vertical * 14}vh` }}>
        {lines.length > 0 ? (
          <>
            <p className="worship-pair" data-output-line="1" style={{ fontSize }}>{lines[0]}</p>
            {lines[1] ? <p className="worship-pair" data-output-line="2" style={{ fontSize }}>{lines[1]}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function sameLines(current: string[], lines: string[]): boolean {
  return current.length === lines.length && current.every((line, index) => line === lines[index]);
}
