"use client";

import type { ReactNode } from "react";

/** iPhone 14/15 논리 해상도(포인트). 비율 ≈ 9:19.5 */
export const IPHONE_LOGICAL_WIDTH = 390;
export const IPHONE_LOGICAL_HEIGHT = 844;

/**
 * 다이나믹 아일랜드·얇은 베젤·홈 인디케이터가 있는 아이폰 셸입니다.
 * 자식은 화면(safe area) 안에만 그려집니다.
 */
export function IphoneShell({
  children,
  maxWidth = 300,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      className="relative mx-auto w-full"
      style={{ maxWidth, aspectRatio: `${IPHONE_LOGICAL_WIDTH} / ${IPHONE_LOGICAL_HEIGHT}` }}
      data-testid="iphone-shell"
      data-iphone-resolution={`${IPHONE_LOGICAL_WIDTH}x${IPHONE_LOGICAL_HEIGHT}`}
    >
      <span aria-hidden className="absolute left-[-2px] top-[18%] z-20 h-[8%] w-[3px] rounded-l-sm bg-[#2a2a2c]" />
      <span aria-hidden className="absolute left-[-2px] top-[28%] z-20 h-[5%] w-[3px] rounded-l-sm bg-[#2a2a2c]" />
      <span aria-hidden className="absolute left-[-2px] top-[35%] z-20 h-[5%] w-[3px] rounded-l-sm bg-[#2a2a2c]" />
      <span aria-hidden className="absolute right-[-2px] top-[24%] z-20 h-[12%] w-[3px] rounded-r-sm bg-[#2a2a2c]" />

      <div
        className="absolute inset-0 overflow-hidden rounded-[2.35rem]"
        style={{
          background: "linear-gradient(145deg, #3a3a3c 0%, #1c1c1e 42%, #0b0b0c 100%)",
          boxShadow:
            "0 18px 40px rgba(15,23,42,0.28), inset 0 0 0 1px rgba(255,255,255,0.14), inset 0 0 0 3px #141416",
        }}
      >
        <div className="absolute inset-[7px] flex flex-col overflow-hidden bg-black" style={{ borderRadius: "1.95rem" }}>
          <div className="relative z-10 flex h-9 shrink-0 items-center justify-between bg-white px-4 pt-1">
            <span className="font-semibold tabular-nums text-[#0f172a]" style={{ fontSize: 10 }}>
              9:41
            </span>
            <span
              data-testid="iphone-dynamic-island"
              aria-hidden
              className="absolute left-1/2 top-[7px] h-[18px] w-[78px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            />
            <span className="flex items-center gap-1 text-[#0f172a]" style={{ fontSize: 10 }} aria-hidden>
              <svg width="14" height="10" viewBox="0 0 16 12" fill="currentColor">
                <rect x="0" y="3" width="2.2" height="6" rx="0.5" />
                <rect x="3.2" y="2" width="2.2" height="7" rx="0.5" />
                <rect x="6.4" y="0.8" width="2.2" height="8.4" rx="0.5" />
                <rect x="9.6" y="0" width="2.2" height="9.2" rx="0.5" />
              </svg>
              <svg width="14" height="10" viewBox="0 0 16 12" fill="currentColor">
                <path d="M8 2.2c2.2 0 4.1 1 5.4 2.5l-1.1 1.1C11.3 4.5 9.7 3.8 8 3.8S4.7 4.5 3.7 5.8L2.6 4.7C3.9 3.2 5.8 2.2 8 2.2z" />
                <path d="M8 5.2c1.3 0 2.5.5 3.4 1.4L10.2 7.8C9.6 7.3 8.8 7 8 7s-1.6.3-2.2.8L4.6 6.6C5.5 5.7 6.7 5.2 8 5.2z" />
                <circle cx="8" cy="9.6" r="1.2" />
              </svg>
              <svg width="20" height="10" viewBox="0 0 25 12" fill="currentColor">
                <rect x="0" y="1" width="19" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <rect x="1.5" y="2.5" width="14" height="7" rx="1" />
                <rect x="20" y="3.5" width="2" height="5" rx="0.6" />
              </svg>
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">{children}</div>

          <div className="flex h-4 shrink-0 items-end justify-center bg-white pb-1">
            <span
              data-testid="iphone-home-indicator"
              aria-hidden
              className="mb-0.5 h-[3px] w-[28%] rounded-full bg-[#0f172a]/80"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
