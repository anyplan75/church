"use client";

import { useEffect, useId, useRef } from "react";

type Instgrm = { Embeds: { process: () => void } };

declare global {
  interface Window {
    instgrm?: Instgrm;
  }
}

function loadEmbedScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.instgrm?.Embeds) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>('script[data-modl-instagram-embed="1"]');
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      if (window.instgrm?.Embeds) resolve();
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.instagram.com/embed.js";
    script.dataset.modlInstagramEmbed = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("인스타그램 화면을 불러오지 못했습니다."));
    document.body.appendChild(script);
  });
}

/**
 * 인스타그램 공개 주소를 이 페이지 안에 보여 줍니다.
 * Meta 열쇠 없이 embed.js 로 프로필·게시물을 그립니다. 바깥 링크로만 보내지 않습니다.
 */
export function InstagramEmbed({ href }: { href: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const captionId = useId();

  useEffect(() => {
    let cancelled = false;
    void loadEmbedScript()
      .then(() => {
        if (cancelled) return;
        window.instgrm?.Embeds.process();
      })
      .catch(() => {
        /* 막히면 아래 안내 문구만 남깁니다. */
      });
    return () => {
      cancelled = true;
    };
  }, [href]);

  return (
    <div ref={rootRef} className="min-w-0" data-testid="instagram-embed" data-instagram-href={href}>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={href}
        data-instgrm-version="14"
        style={{
          background: "#FFF",
          border: 0,
          borderRadius: "3px",
          boxShadow: "none",
          margin: "0 auto",
          maxWidth: "540px",
          minWidth: "260px",
          padding: 0,
          width: "100%",
        }}
      >
        <p id={captionId} className="px-2 py-3 text-center text-sm leading-relaxed text-[#5c5148]">
          인스타그램 화면을 이 자리에서 불러오는 중입니다.
        </p>
      </blockquote>
    </div>
  );
}
