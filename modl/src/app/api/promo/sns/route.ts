import { NextResponse } from "next/server";
import { cachedInstagramFeed, cachedYoutubeFeed, SNS_FEED_REVALIDATE_SECONDS } from "@/server/promo/feed-cache";
import { loadPromoPublicContent, type PromoKind } from "@/server/promo/service";

/** 공개 SNS JSON은 수분 단위로 다시 써도 됩니다. 계정 화면과는 다릅니다. */
export const revalidate = SNS_FEED_REVALIDATE_SECONDS;
export const maxDuration = 60;

function kindOf(value: string | null): PromoKind | null {
  if (value === "church" || value === "gathering") return value;
  return null;
}

function cacheHeaders(): HeadersInit {
  return {
    "Cache-Control": `public, s-maxage=${SNS_FEED_REVALIDATE_SECONDS}, stale-while-revalidate=${SNS_FEED_REVALIDATE_SECONDS * 2}`,
  };
}

/**
 * 교회·모들·미리보기 화면이 인스타그램·유튜브를 나중에 채울 때 씁니다.
 * HTML을 보내기 전에 바깥 SNS를 기다리지 않게 합니다. 결과는 수분 단위로 기억합니다.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = kindOf(url.searchParams.get("kind"));
  const id = url.searchParams.get("id")?.trim() ?? "";
  const instagramParam = url.searchParams.get("instagram")?.trim() ?? "";
  const youtubeParam = url.searchParams.get("youtube")?.trim() ?? "";

  try {
    if (kind && id) {
      const page = await loadPromoPublicContent(kind, id);
      if (!page) {
        return NextResponse.json({ ok: false, message: "교회나 모들을 찾지 못했습니다." }, { status: 404 });
      }
      const [instagram, youtube] = await Promise.all([
        cachedInstagramFeed(page.content.instagram),
        cachedYoutubeFeed(page.content.youtube),
      ]);
      return NextResponse.json(
        {
          ok: true,
          instagramAccount: page.content.instagram,
          instagram,
          youtube,
        },
        { headers: cacheHeaders() },
      );
    }

    if (instagramParam || youtubeParam) {
      const youtubePosts = youtubeParam ? [{ title: "채널", url: youtubeParam }] : [];
      const [instagram, youtube] = await Promise.all([
        cachedInstagramFeed(instagramParam),
        cachedYoutubeFeed(youtubePosts),
      ]);
      return NextResponse.json(
        {
          ok: true,
          instagramAccount: instagramParam,
          instagram,
          youtube,
        },
        { headers: cacheHeaders() },
      );
    }

    return NextResponse.json({ ok: false, message: "무엇을 읽을지 적지 않았습니다." }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, message: "SNS 글을 읽지 못했습니다." }, { status: 502 });
  }
}
