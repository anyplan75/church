"use client";

import { InstagramEmbed } from "@/components/instagram-embed";
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
 * 넓은 화면: 왼쪽 인스타그램, 오른쪽 유튜브(위에서 아래 세 개).
 * 좁은 화면: 둘 다 위에서 아래로 한 줄.
 */
export function PromoSns({ headingLevel = "h2", instagramAccount, instagram, youtube, loading = false }: Props) {
  const Heading = headingLevel;
  const instagramHref =
    instagram?.status === "ready" || instagram?.status === "embed"
      ? instagram.href
      : null;
  const instagramReason = instagram?.status === "unavailable" ? instagram.reason : undefined;

  return (
    <div
      data-testid="promo-sns"
      className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"
    >
      <section
        className="grid min-w-0 gap-2 rounded-3xl bg-[#fffaf3] p-4"
        data-testid="instagram-section"
        data-instagram-feed={instagram?.status}
        data-instagram-reason={instagramReason}
      >
        <Heading className="font-semibold">인스타그램</Heading>
        {loading ? (
          <p className="leading-relaxed text-[#5c5148]">인스타그램을 읽고 있습니다.</p>
        ) : !instagramAccount.trim() || instagram?.status === "hidden" ? (
          <p className="leading-relaxed text-[#5c5148]">인스타그램 계정이 없습니다.</p>
        ) : instagram?.status === "unavailable" ? (
          <p className="leading-relaxed text-[#5c5148]">{instagram.reason}</p>
        ) : instagramHref ? (
          <InstagramEmbed href={instagramHref} />
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
        <Heading className="font-semibold">유튜브</Heading>
        {loading ? (
          <p className="leading-relaxed text-[#5c5148]">유튜브를 읽고 있습니다.</p>
        ) : youtube?.status === "ready" ? (
          <YoutubeMagazine videos={youtube.videos} />
        ) : youtube?.status === "unavailable" ? (
          <p className="leading-relaxed text-[#5c5148]">{youtube.reason}</p>
        ) : (
          <p className="leading-relaxed text-[#5c5148]">유튜브 글이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
