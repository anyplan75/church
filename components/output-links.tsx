"use client";

import { useEffect, useState } from "react";
import { isDesktopApp } from "@/lib/desktop-api";
import { subscribeLanStatus } from "@/lib/lan-link";
import { isPrivateIpv4 } from "@/lib/output-host";
import { outputLinks } from "@/lib/roles";

export function OutputLinks({ id, className = "btn btn-quiet" }: { id: string; className?: string }) {
  const [localOrigin, setLocalOrigin] = useState("");
  const [lanStatus, setLanStatus] = useState("idle");
  const desktop = isDesktopApp();
  useEffect(() => {
    const host = window.location.hostname;
    if (host === "localhost" || host.endsWith(".local") || isPrivateIpv4(host)) setLocalOrigin(window.location.origin);
  }, []);
  useEffect(() => subscribeLanStatus(setLanStatus), []);
  if (desktop) {
    return (
      <p className="text-sm text-muted" data-desktop-output-status={lanStatus}>
        {lanStatus === "direct" ? "송출 앱에 연결됨" : lanStatus === "connecting" ? "송출 앱에 연결 중" : lanStatus === "error" ? "송출 앱 다시 연결 중" : "설정에서 송출 컴퓨터를 고르세요"}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {outputLinks(id, localOrigin).map((link) => (
        <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className={className}>
          {link.label}
        </a>
      ))}
    </div>
  );
}
