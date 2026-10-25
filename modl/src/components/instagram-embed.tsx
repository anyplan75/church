"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IphoneShell, IPHONE_LOGICAL_HEIGHT, IPHONE_LOGICAL_WIDTH } from "@/components/iphone-shell";
import { instagramFrameSrc, instagramUsername, type InstagramPost } from "@/promo/instagram";

function postEmbedSrc(permalink: string): string | null {
  const src = instagramFrameSrc(permalink);
  if (!src) return null;
  return src.replace(/\/embed\/captioned\/?/, "/embed/");
}

const POST_EMBED_HEIGHT = 720;

type ScreenMode = "feed" | "grid" | "post" | "profile";

const scrollClass =
  "min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-white touch-pan-y [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * 아이폰 셸 안에서 인스타그램 피드/격자를 보여 줍니다.
 * 스크롤은 화면(틀) 안에서만 움직이고, 게시물을 누르면 그 안에서 상세가 이어집니다.
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
  const [mode, setMode] = useState<ScreenMode>(posts.length > 0 ? "feed" : "profile");
  const [openId, setOpenId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const openPost = useMemo(() => posts.find((post) => post.id === openId) ?? null, [openId, posts]);
  const feedPosts = useMemo(() => {
    if (!openId) return posts.slice(0, 8);
    const index = posts.findIndex((post) => post.id === openId);
    if (index < 0) return posts.slice(0, 8);
    return [...posts.slice(index), ...posts.slice(0, index)].slice(0, 8);
  }, [openId, posts]);

  useEffect(() => {
    if (posts.length === 0) setMode("profile");
  }, [posts.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [mode, openId]);

  // 휠이 페이지로 넘어가지 않게, 틀 안 스크롤만 움직입니다.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      event.stopPropagation();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mode, openId, posts.length]);

  if (!profileEmbed && posts.length === 0) {
    return (
      <p className="leading-relaxed text-[#5c5148]" data-testid="instagram-embed-missing">
        인스타그램 주소를 읽지 못했습니다.
      </p>
    );
  }

  const screenMode: ScreenMode = mode === "post" && openPost ? "post" : mode === "post" ? "feed" : mode;

  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: 300 }}
      data-testid="instagram-embed"
      data-instagram-href={href}
      data-instagram-mode={screenMode}
      data-instagram-count={posts.length}
      data-instagram-aspect={`${IPHONE_LOGICAL_WIDTH}/${IPHONE_LOGICAL_HEIGHT}`}
      data-instagram-resolution={`${IPHONE_LOGICAL_WIDTH}x${IPHONE_LOGICAL_HEIGHT}`}
    >
      <IphoneShell maxWidth={300}>
        <div className="flex h-7 shrink-0 items-center gap-1 border-b border-[#eceff3] bg-white px-1.5">
          {(screenMode === "post" || screenMode === "profile") && (
            <button
              type="button"
              data-testid="instagram-back"
              className="rounded px-1 py-0.5 font-medium text-[#0f172a]"
              style={{ fontSize: 10, lineHeight: 1.1 }}
              onClick={() => {
                setOpenId(null);
                setMode(posts.length > 0 ? "feed" : "profile");
              }}
            >
              목록
            </button>
          )}
          <span className="min-w-0 flex-1 truncate font-semibold text-[#0f172a]" style={{ fontSize: 10, lineHeight: 1.1 }}>
            {username ? `@${username}` : "인스타그램"}
          </span>
          {posts.length > 0 && screenMode !== "grid" && (
            <button
              type="button"
              data-testid="instagram-grid-toggle"
              className="rounded px-1 py-0.5 font-medium text-[#64748b]"
              style={{ fontSize: 10, lineHeight: 1.1 }}
              onClick={() => {
                setOpenId(null);
                setMode("grid");
              }}
            >
              격자
            </button>
          )}
          {posts.length > 0 && screenMode === "grid" && (
            <button
              type="button"
              data-testid="instagram-feed-toggle"
              className="rounded px-1 py-0.5 font-medium text-[#64748b]"
              style={{ fontSize: 10, lineHeight: 1.1 }}
              onClick={() => setMode("feed")}
            >
              피드
            </button>
          )}
          {screenMode !== "profile" && (
            <button
              type="button"
              data-testid="instagram-profile"
              className="rounded px-1 py-0.5 font-medium text-[#2563eb]"
              style={{ fontSize: 10, lineHeight: 1.1 }}
              onClick={() => {
                setOpenId(null);
                setMode("profile");
              }}
            >
              프로필 보기
            </button>
          )}
        </div>

        {screenMode === "profile" || (posts.length === 0 && profileEmbed) ? (
          <div ref={scrollRef} data-testid="instagram-profile-scroll" className={scrollClass}>
            <iframe
              title="인스타그램 프로필"
              src={profileEmbed!}
              className="block w-full border-0"
              style={{ height: 1200, minHeight: 1200 }}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : screenMode === "post" && openPost ? (
          <div ref={scrollRef} data-testid="instagram-post-scroll" className={scrollClass}>
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
        ) : screenMode === "grid" ? (
          <div ref={scrollRef} data-testid="instagram-phone-grid" className={`${scrollClass} grid grid-cols-3 content-start gap-px`}>
            {posts.map((post) => (
              <button
                key={post.id}
                type="button"
                data-testid="instagram-grid-item"
                className="block w-full overflow-hidden bg-[#f8fafc]"
                onClick={() => {
                  setOpenId(post.id);
                  setMode("post");
                }}
                aria-label={post.caption || "인스타그램 게시물 열기"}
              >
                <img src={post.imageUrl} alt="" className="aspect-square w-full object-cover" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        ) : (
          <div ref={scrollRef} data-testid="instagram-feed-scroll" className={scrollClass}>
            {posts.map((post) => (
              <article key={post.id} className="border-b border-[#efefef]" data-testid="instagram-feed-item">
                <div className="flex items-center gap-2 px-2.5 py-1.5">
                  <span className="inline-block h-6 w-6 shrink-0 rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-[1.5px]">
                    <span className="block h-full w-full rounded-full bg-white p-[1px]">
                      <span className="block h-full w-full rounded-full bg-[#e2e8f0]" />
                    </span>
                  </span>
                  <span className="truncate text-[11px] font-semibold text-[#0f172a]">{username || "instagram"}</span>
                </div>
                <button
                  type="button"
                  data-testid="instagram-grid-item"
                  className="block w-full overflow-hidden bg-[#f8fafc]"
                  onClick={() => {
                    setOpenId(post.id);
                    setMode("post");
                  }}
                  aria-label={post.caption || "인스타그램 게시물 열기"}
                >
                  <img src={post.imageUrl} alt="" className="aspect-square w-full object-cover" loading="lazy" decoding="async" />
                </button>
                {post.caption ? (
                  <p className="px-2.5 py-1.5 text-[11px] leading-snug text-[#0f172a]">
                    <span className="font-semibold">{username}</span> {post.caption}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </IphoneShell>
      <p className="mt-2 text-center text-sm leading-relaxed text-[#5c5148]">
        아이폰 틀 안에서 스크롤해 보세요. 게시물을 누르면 그 안에서 이어집니다.
      </p>
    </div>
  );
}
