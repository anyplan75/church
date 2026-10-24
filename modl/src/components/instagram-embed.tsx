"use client";

import { instagramFrameSrc } from "@/promo/instagram";

/**
 * 인스타그램을 폰 화면처럼 긴 틀 안에 보여 줍니다.
 * 프로필·게시물 주소는 Instagram 공식 /embed 칸으로 열어, 그 틀 안에서 스크롤·탐색합니다.
 * Meta 열쇠 없이 공개 주소만 씁니다. 바깥 새 탭으로만 보내지 않습니다.
 */
export function InstagramEmbed({ href }: { href: string }) {
  const src = instagramFrameSrc(href);

  if (!src) {
    return (
      <p className="leading-relaxed text-[#5c5148]" data-testid="instagram-embed-missing">
        인스타그램 주소를 읽지 못했습니다.
      </p>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-[320px]"
      data-testid="instagram-embed"
      data-instagram-href={href}
      data-instagram-frame={src}
    >
      {/* 폰 화면 비율(대략 9:19.5). 틀은 유지하고 안에서만 스크롤합니다. */}
      <div className="relative aspect-[9/19.5] overflow-hidden rounded-[1.75rem] border border-[#d6d3d1] bg-[#0f172a]">
        <div className="absolute inset-[6px] overflow-hidden rounded-[1.35rem] bg-white">
          <iframe
            title="인스타그램"
            src={src}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
      <p className="mt-2 text-center text-sm leading-relaxed text-[#5c5148]">
        이 틀 안에서 인스타그램을 스크롤해 보세요. 새 창으로 나가지 않습니다.
      </p>
    </div>
  );
}
