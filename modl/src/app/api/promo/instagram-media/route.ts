import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 인스타그램 CDN 그림만 허용합니다. 다른 주소는 거절합니다. */
function allowedImageUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const ok =
      host === "instagram.com" ||
      host.endsWith(".cdninstagram.com") ||
      host === "cdninstagram.com" ||
      host.endsWith(".fbcdn.net");
    return ok ? url : null;
  } catch {
    return null;
  }
}

/**
 * 브라우저가 인스타그램 CDN 그림을 직접 못 받을 때가 있어,
 * 서버가 대신 받아 같은 그림을 넘겨 줍니다. 비밀 열쇠는 쓰지 않습니다.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("u")?.trim() ?? "";
  const target = allowedImageUrl(raw);
  if (!target) {
    return new NextResponse("그림을 열 수 없습니다.", { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      cache: "force-cache",
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Referer: "https://www.instagram.com/",
      },
    });
    if (!upstream.ok) {
      return new NextResponse("그림을 받지 못했습니다.", { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new NextResponse("그림이 아닙니다.", { status: 502 });
    }
    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse("그림을 받지 못했습니다.", { status: 502 });
  }
}
