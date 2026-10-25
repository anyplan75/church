"use client";

import { useMemo, useState } from "react";
import { instagramFrameSrc, instagramUsername, type InstagramPost } from "@/promo/instagram";

function postEmbedSrc(permalink: string): string | null {
  return instagramFrameSrc(permalink);
}

/**
 * 인스타그램을 폰처럼 긴 틀 안에 보여 줍니다.
 * 글 목록이 있으면 모바일 프로필처럼 3열 그리드가 주가 되고,
 * 글을 누르면 그 틀 안에서 게시물 화면이 열립니다.
 * 글 목록이 없을 때만 공식 프로필 embed 를 쓰되, 헤더를 위로 밀어 게시물 칸이 먼저 보이게 합니다.
 */
export function InstagramEmbed({
  href,
  posts = [],
}: {
  href: string;
  posts?: readonly InstagramPost[];
}) {
  const username = instagramUsername(href) ?? "";
  const profileEmbed = instagramFrameSrc(href);
  const [openId, setOpenId] = useState<string | null>(null);
  const openPost = useMemo(() => posts.find((post) => post.id === openId) ?? null, [openId, posts]);
  const openSrc = openPost ? postEmbedSrc(openPost.permalink) : null;

  if (!profileEmbed && posts.length === 0) {
    return (
      <p className="leading-relaxed text-[#5c5148]" data-testid="instagram-embed-missing">
        인스타그램 주소를 읽지 못했습니다.
      </p>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-[300px]"
      data-testid="instagram-embed"
      data-instagram-href={href}
      data-instagram-mode={posts.length > 0 ? "grid" : "profile-embed"}
      data-instagram-count={posts.length}
    >
      {/* 세로 긴 폰 비율이되, 게시물 3~4줄이 틀을 거의 채우도록 9:16보다 조금 낮춥니다. */}
      <div className="relative aspect-[9/14.5] overflow-hidden rounded-[1.75rem] border border-[#d6d3d1] bg-[#0f172a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        <div className="absolute inset-[5px] flex h-[calc(100%-10px)] flex-col overflow-hidden rounded-[1.35rem] bg-white">
          {openPost && openSrc ? (
            <>
              <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[#f1f5f9] px-2">
                <button
                  type="button"
                  data-testid="instagram-back"
                  className="rounded-md px-2 py-1 text-xs font-semibold text-[#0f172a]"
                  onClick={() => setOpenId(null)}
                >
                  ← 목록
                </button>
                <span className="min-w-0 truncate text-xs text-[#64748b]">{username ? `@${username}` : "게시물"}</span>
              </div>
              <iframe
                title="인스타그램 게시물"
                src={openSrc}
                className="min-h-0 w-full flex-1 border-0"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
              />
            </>
          ) : posts.length > 0 ? (
            <>
              {/* 실제 폰 인스타처럼 얇은 상단만 두고, 나머지 대부분을 3열 게시물 칸에 줍니다. */}
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#f1f5f9] px-3">
                <span className="truncate text-xs font-semibold text-[#0f172a]">{username ? `@${username}` : "인스타그램"}</span>
                <span className="text-[11px] text-[#94a3b8]">게시물</span>
              </div>
              <ul
                data-testid="instagram-phone-grid"
                className="grid min-h-0 flex-1 grid-cols-3 content-start gap-px overflow-y-auto overscroll-contain bg-white [scrollbar-width:thin]"
              >
                {posts.map((post) => (
                  <li key={post.id} className="min-w-0">
                    <button
                      type="button"
                      data-testid="instagram-grid-item"
                      className="block w-full overflow-hidden bg-[#f8fafc]"
                      onClick={() => setOpenId(post.id)}
                      aria-label={post.caption || "인스타그램 게시물 열기"}
                    >
                      <img
                        src={post.imageUrl}
                        alt=""
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            // 공식 프로필 embed 는 헤더가 커서, 틀보다 크게 그린 뒤 위로 밀어 그리드가 먼저 보이게 합니다.
            <div className="relative h-full w-full overflow-hidden bg-white" data-testid="instagram-profile-crop">
              <iframe
                title="인스타그램"
                src={profileEmbed!}
                className="absolute left-0 top-0 border-0"
                style={{ width: "100%", height: "220%", transform: "translateY(-28%)" }}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-sm leading-relaxed text-[#5c5148]">
        {posts.length > 0
          ? "게시물을 누르면 이 틀 안에서 열립니다. 새 창으로 나가지 않습니다."
          : "이 틀 안에서 인스타그램을 스크롤해 보세요. 새 창으로 나가지 않습니다."}
      </p>
    </div>
  );
}
