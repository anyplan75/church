"use client";

import { useEffect, useRef, useState } from "react";
import { instagramFrameSrc } from "@/promo/instagram";

/**
 * iframe 안 실제 카드(여백 제외) 대략 크기입니다.
 * 이 기준으로 확대해 틀을 채우고, 문서 안 흰 여백은 잘라 냅니다.
 */
const VIEW_W = 300;
const VIEW_H = 250;
const IFRAME_W = 320;
const IFRAME_H = 520;
/** 인스타 페이지 위쪽 여백을 잘라 내는 양(px). */
const CROP_TOP = 12;

/**
 * 인스타그램을 폰처럼 긴 틀 안에 보여 줍니다.
 * 프로필·게시물 그리드가 틀을 꽉 채우게 확대하고, 더 아래는 틀 안에서 스크롤합니다.
 */
export function InstagramEmbed({ href }: { href: string }) {
  const src = instagramFrameSrc(href);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 310, h: 552 });

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const sync = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w > 0 && h > 0) setStage({ w, h });
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [src]);

  if (!src) {
    return (
      <p className="leading-relaxed text-[#5c5148]" data-testid="instagram-embed-missing">
        인스타그램 주소를 읽지 못했습니다.
      </p>
    );
  }

  const scale = Math.max(stage.w / VIEW_W, stage.h / VIEW_H);
  const offsetX = (stage.w - VIEW_W * scale) / 2;
  const offsetY = -CROP_TOP * scale;
  const scrollH = Math.max(stage.h, (IFRAME_H - CROP_TOP) * scale);

  return (
    <div
      className="mx-auto w-full max-w-[320px]"
      data-testid="instagram-embed"
      data-instagram-href={href}
      data-instagram-frame={src}
      data-instagram-scale={scale.toFixed(3)}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-[1.75rem] border border-[#d6d3d1] bg-[#0f172a]">
        <div
          ref={stageRef}
          className="absolute inset-[5px] overflow-x-hidden overflow-y-auto overscroll-contain rounded-[1.35rem] bg-[#fafafa] [scrollbar-width:thin]"
        >
          <div style={{ width: stage.w, height: scrollH, position: "relative" }}>
            <iframe
              title="인스타그램"
              src={src}
              width={IFRAME_W}
              height={IFRAME_H}
              className="absolute left-0 top-0 block border-0"
              style={{
                width: IFRAME_W,
                height: IFRAME_H,
                transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                transformOrigin: "top left",
              }}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-sm leading-relaxed text-[#5c5148]">
        이 틀 안에서 인스타그램을 스크롤해 보세요. 새 창으로 나가지 않습니다.
      </p>
    </div>
  );
}
