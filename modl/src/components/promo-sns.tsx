"use client";

import { useEffect, useState } from "react";
import { InstagramEmbed } from "@/components/instagram-embed";
import { InstagramLogo, YoutubeLogo } from "@/components/sns-logos";
import { YoutubeMagazine } from "@/components/youtube-magazine";
import type { InstagramFeed as InstagramFeedState } from "@/server/promo/instagram-feed";
import type { YoutubeFeed } from "@/server/promo/youtube-feed";

type Props = {
  headingLevel?: "h2" | "h3";
  instagramAccount: string;
  instagram: InstagramFeedState | null;
  youtube: YoutubeFeed | null;
  loading?: boolean;
};

/**
 * 홍보 페이지의 인스타그램·유튜브 자리입니다.
 * 넓은 화면: 왼쪽 아이폰 인스타, 오른쪽 유튜브 세 개가 아이폰 높이에 맞춤.
 * 좁은 화면: 둘 다 위에서 아래로 한 줄.
 */
export function PromoSns({ headingLevel = "h2", instagramAccount, instagram, youtube, loading = false }: Props) {
  const Heading = headingLevel;
  const instagramHref =
    instagram?.status === "ready" || instagram?.status === "embed" ? instagram.href : null;
  const instagramPosts = instagram?.status === "ready" ? instagram.posts : [];
  const instagramReason = instagram?.status === "unavailable" ? instagram.reason : undefined;
  const [phoneHeight, setPhoneHeight] = useState<number | null>(null);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>("[data-testid='iphone-shell']");
    if (!shell || typeof ResizeObserver === "undefined") return;
    const sync = () => setPhoneHeight(Math.round(shell.getBoundingClientRect().height));
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [instagramHref, instagramPosts.length, loading]);

  return (
    <div data-testid="promo-sns" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <section
        className="grid min-w-0 gap-2 rounded-3xl bg-[#fffaf3] p-4"
        data-testid="instagram-section"
        data-instagram-feed={instagram?.status}
        data-instagram-reason={instagramReason}
      >
        <Heading className="flex items-center gap-2 font-semibold">
          <InstagramLogo className="h-5 w-5 shrink-0" />
          <span>인스타그램</span>
        </Heading>
        {loading ? (
          <p className="leading-relaxed text-[#5c5148]">인스타그램을 읽고 있습니다.</p>
        ) : !instagramAccount.trim() || instagram?.status === "hidden" ? (
          <p className="leading-relaxed text-[#5c5148]">인스타그램 계정이 없습니다.</p>
        ) : instagram?.status === "unavailable" ? (
          <p className="leading-relaxed text-[#5c5148]">{instagram.reason}</p>
        ) : instagramHref ? (
          <InstagramEmbed href={instagramHref} posts={instagramPosts} />
        ) : (
          <p className="leading-relaxed text-[#5c5148]">인스타그램 계정이 없습니다.</p>
        )}
      </section>
      <section
        className="grid min-w-0 gap-2 rounded-3xl bg-[#fffaf3] p-4"
        data-testid="youtube-section"
        data-youtube-feed={youtube?.status}
        data-youtube-reason={youtube?.status === "unavailable" ? youtube.reason : undefined}
      >
        <Heading className="flex items-center gap-2 font-semibold">
          <YoutubeLogo className="h-5 w-5 shrink-0" />
          <span>유튜브</span>
        </Heading>
        {loading ? (
          <p className="leading-relaxed text-[#5c5148]">유튜브를 읽고 있습니다.</p>
        ) : youtube?.status === "ready" ? (
          <div
            data-testid="youtube-phone-height"
            className="min-h-0 w-full"
            style={phoneHeight ? { height: phoneHeight } : undefined}
          >
            <YoutubeMagazine videos={youtube.videos} fillPhoneHeight={Boolean(phoneHeight)} />
          </div>
        ) : youtube?.status === "unavailable" ? (
          <p className="leading-relaxed text-[#5c5148]">{youtube.reason}</p>
        ) : (
          <p className="leading-relaxed text-[#5c5148]">유튜브 글이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
