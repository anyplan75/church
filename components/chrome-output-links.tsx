"use client";

import { useEffect, useState } from "react";
import { useChurch } from "@/components/church-state";
import { desktopApi, isDesktopApp } from "@/lib/desktop-api";
import { detectPrivateAddress, isPrivateIpv4 } from "@/lib/output-host";
import { readOperatorService } from "@/lib/output-link";
import { chromeOutputLinks } from "@/lib/roles";

/** 설정·예배 화면에 크롬 폴백 송출 주소를 보여 복사·클릭하게 한다. */
export function ChromeOutputLinks({
  serviceId = "",
  className = "btn btn-quiet btn-small",
}: {
  serviceId?: string;
  className?: string;
}) {
  const { db } = useChurch();
  const [id, setId] = useState(serviceId);
  const [from, setFrom] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (serviceId) {
      setId(serviceId);
      return;
    }
    const remembered = readOperatorService();
    if (remembered) {
      setId(remembered);
      return;
    }
    const latest = db?.services?.[0]?.id || "";
    setId(latest);
  }, [serviceId, db?.services]);

  useEffect(() => {
    let stop = false;
    async function loadFrom() {
      const api = desktopApi();
      if (api) {
        const addresses = await api.localAddresses();
        const first = addresses.find((item) => isPrivateIpv4(item)) || addresses[0] || "";
        if (!stop) setFrom(first);
        return;
      }
      if (isDesktopApp()) return;
      const found = await detectPrivateAddress();
      if (!stop && isPrivateIpv4(found)) setFrom(found);
    }
    void loadFrom();
    return () => {
      stop = true;
    };
  }, []);

  if (!id) {
    return (
      <p className="text-sm text-muted" data-chrome-output-links="empty">
        예배를 한 번 연 뒤 크롬용 송출 주소가 여기에 나타납니다. 앱이 본선이고, 크롬은 폴백입니다.
      </p>
    );
  }

  const links = chromeOutputLinks(id, from);

  return (
    <div className="space-y-2" data-chrome-output-links="1">
      <p className="text-sm text-muted">
        송출 앱이 없으면 크롬으로 아래 링크를 엽니다. 메뉴 없이 받을 준비만 하고, 조작 쪽이 포트 18765로 보낸 두 줄을 받습니다.
        {from ? ` · 조작 PC ${from}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <span key={link.label} className="inline-flex flex-wrap items-center gap-1">
            <a href={link.href} target="_blank" rel="noreferrer" className={className}>
              {link.label}
            </a>
            <button
              type="button"
              className="btn btn-quiet btn-small"
              onClick={() => {
                void navigator.clipboard?.writeText(link.href).then(() => {
                  setCopied(link.label);
                  window.setTimeout(() => setCopied((current) => (current === link.label ? "" : current)), 1500);
                });
              }}
            >
              {copied === link.label ? "복사됨" : "복사"}
            </button>
          </span>
        ))}
      </div>
      <p className="break-all text-xs text-muted" data-chrome-output-url="main">
        {links[0]?.href}
      </p>
      <p className="break-all text-xs text-muted" data-chrome-output-url="overlay">
        {links[1]?.href}
      </p>
    </div>
  );
}
