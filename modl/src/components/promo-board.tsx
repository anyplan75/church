"use client";

import { useState } from "react";
import type { BoardTab } from "@/promo/rules";

/** 그 교회나 그 모들의 게시판입니다. 탭은 들어온 만큼만, 최대 3개입니다. */
export function PromoBoard({ tabs }: { tabs: readonly BoardTab[] }) {
  const [index, setIndex] = useState(0);
  const current = tabs[index] ?? tabs[0];
  if (!current) return <p className="leading-relaxed text-[#5c5148]">게시판 글이 없습니다.</p>;
  return (
    <div className="grid gap-3" data-testid="promo-board">
      <div role="tablist" aria-label="게시판" className="flex flex-wrap gap-2">
        {tabs.map((tab, tabIndex) => (
          <button
            key={`${tab.title}-${tabIndex}`}
            type="button"
            role="tab"
            aria-selected={tabIndex === index}
            data-testid="promo-tab"
            className={`rounded-full px-3 py-2 text-sm font-semibold ${tabIndex === index ? "bg-[#111827] text-white" : "border border-[#e4d8c8] bg-white"}`}
            onClick={() => setIndex(tabIndex)}
          >
            {tab.title}
          </button>
        ))}
      </div>
      {current.posts.length === 0 ? (
        <p className="leading-relaxed text-[#5c5148]">이 탭에는 글이 없습니다.</p>
      ) : (
        <ul className="grid list-none gap-3">
          {current.posts.map((post, postIndex) => (
            <li key={`${post.title}-${postIndex}`} className="grid gap-1 rounded-2xl bg-white px-3 py-3">
              <p className="font-semibold">{post.title}</p>
              <p className="whitespace-pre-wrap leading-relaxed">{post.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
