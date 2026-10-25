"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { instagramFrameSrc, instagramUsername, type InstagramPost } from "@/promo/instagram";

function postEmbedSrc(permalink: string): string | null {
  // captioned 는 「프로필 보기」등 글자가 커서, 짧은 /embed/ 를 쓰고 상단은 우리가 작게 둡니다.
  const src = instagramFrameSrc(permalink);
  if (!src) return null;
  return src.replace(/\/embed\/captioned\/?/, "/embed/");
}

const POST_EMBED_HEIGHT = 640;

/**
 * 인스타그램을 폰처럼 긴 틀 안에 보여 줍니다.
 * 글 목록이 있으면 모바일 프로필처럼 3열 그리드가 주가 되고,
 * 글을 누르면 그 틀 안에서 게시물 화면이 열립니다.
 * 그리드·상세 모두 틀 높이를 넘치면 세로 스크롤됩니다.
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
  const [showProfile, setShowProfile] = useState(false);
  const openPost = useMemo(() => posts.find((post) => post.id === openId) ?? null, [openId, posts]);
  const feedPosts = useMemo(() => {
    if (!openId) return posts;
    const index = posts.findIndex((post) => post.id === openId);
    if (index < 0) return posts.slice(0, 8);
    // 고른 글부터 아래로 이어 보이게 해서, 스크롤하면 다음 게시물이 나옵니다.
    // iframe 을 너무 많이 한꺼번에 열지 않도록 8개까지만 둡니다.
    return [...posts.slice(index), ...posts.slice(0, index)].slice(0, 8);
  }, [openId, posts]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [openId, showProfile]);

  if (!profileEmbed && posts.length === 0) {
    return (
      <p className="leading-relaxed text-[#5c5148]" data-testid="instagram-embed-missing">
        인스타그램 주소를 읽지 못했습니다.
      </p>
    );
  }

  const mode = showProfile ? "profile-embed" : openPost ? "post-feed" : posts.length > 0 ? "grid" : "profile-embed";

  return (
    <div
      className="mx-auto w-full max-w-[300px]"
      data-testid="instagram-embed"
      data-instagram-href={href}
      data-instagram-mode={mode}
      data-instagram-count={posts.length}
    >
      {/* 세로 긴 폰 비율. 12칸(4줄) 그리드도 아래가 잘려 스크롤되게 높이를 맞춥니다. */}
      <div className="relative aspect-[9/11.5] overflow-hidden rounded-[1.75rem] border border-[#d6d3d1] bg-[#0f172a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        <div className="absolute inset-[5px] flex flex-col overflow-hidden rounded-[1.35rem] bg-white">
          {(openPost || showProfile) && (
            <div className="flex h-6 shrink-0 items-center gap-1 border-b border-[#f1f5f9] px-1.5">
              <button
                type="button"
                data-testid="instagram-back"
                className="rounded px-1 py-0.5 font-medium text-[#0f172a]"
                style={{ fontSize: 10, lineHeight: 1.1 }}
                onClick={() => {
                  setOpenId(null);
                  setShowProfile(false);
                }}
              >
                목록
              </button>
              <span
                className="min-w-0 flex-1 truncate text-[#64748b]"
                style={{ fontSize: 10, lineHeight: 1.1 }}
              >
                {username ? `@${username}` : "인스타그램"}
              </span>
              {!showProfile && (
                <button
                  type="button"
                  data-testid="instagram-profile"
                  className="rounded px-1 py-0.5 font-medium text-[#2563eb]"
                  style={{ fontSize: 10, lineHeight: 1.1 }}
                  onClick={() => {
                    setOpenId(null);
                    setShowProfile(true);
                  }}
                >
                  프로필 보기
                </button>
              )}
            </div>
          )}

          {showProfile || (posts.length === 0 && profileEmbed) ? (
            <div
              ref={scrollRef}
              data-testid="instagram-profile-scroll"
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
            >
              <iframe
                title="인스타그램 프로필"
                src={profileEmbed!}
                className="block w-full border-0"
                style={{ height: Math.max(POST_EMBED_HEIGHT * 2, 1100), minHeight: 1100 }}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : openPost ? (
            <div
              ref={scrollRef}
              data-testid="instagram-post-scroll"
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
            >
              {feedPosts.map((post) => {
                const src = postEmbedSrc(post.permalink);
                if (!src) return null;
                return (
                  <iframe
                    key={post.id}
                    title={post.caption || "인스타그램 게시물"}
                    src={src}
                    className="block w-full border-0 border-b border-[#f1f5f9]"
                    style={{ height: POST_EMBED_HEIGHT, minHeight: POST_EMBED_HEIGHT }}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                  />
                );
              })}
            </div>
          ) : (
            <>
              <div className="flex h-6 shrink-0 items-center justify-between border-b border-[#f1f5f9] px-2">
                <span className="truncate font-semibold text-[#0f172a]" style={{ fontSize: 10, lineHeight: 1.1 }}>
                  {username ? `@${username}` : "인스타그램"}
                </span>
                <button
                  type="button"
                  data-testid="instagram-profile"
                  className="rounded px-1 py-0.5 font-medium text-[#2563eb]"
                  style={{ fontSize: 10, lineHeight: 1.1 }}
                  onClick={() => setShowProfile(true)}
                >
                  프로필 보기
                </button>
              </div>
              <ul
                data-testid="instagram-phone-grid"
                className="grid min-h-0 flex-1 grid-cols-3 content-start gap-px overflow-y-auto overscroll-y-contain touch-pan-y bg-white [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
              >
                {posts.map((post) => (
                  <li key={post.id} className="min-w-0">
                    <button
                      type="button"
                      data-testid="instagram-grid-item"
                      className="block w-full overflow-hidden bg-[#f8fafc]"
                      onClick={() => {
                        setShowProfile(false);
                        setOpenId(post.id);
                      }}
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
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-sm leading-relaxed text-[#5c5148]">
        {posts.length > 0
          ? "틀 안에서 스크롤해 더 보고, 게시물을 누르면 이어서 볼 수 있습니다."
          : "이 틀 안에서 인스타그램을 스크롤해 보세요. 새 창으로 나가지 않습니다."}
      </p>
    </div>
  );
}
