/**
 * 지도 그림을 우리 서버가 대신 받습니다.
 * 브라우저는 열쇠를 받지 않고, 맵박스에는 허용된 공개 주소만 붙입니다.
 */

import { MAPBOX_ALLOWED_ORIGIN } from "@/map/origin";

export const dynamic = "force-dynamic";

function tileIndex(value: string, max: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) return null;
  return number;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
): Promise<Response> {
  const { z, x, y } = await context.params;
  const zoom = tileIndex(z, 22);
  const column = zoom === null ? null : tileIndex(x, 2 ** zoom - 1);
  const row = zoom === null ? null : tileIndex(y, 2 ** zoom - 1);
  if (zoom === null || column === null || row === null) return new Response(null, { status: 400 });
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  if (!token) return new Response(null, { status: 404 });
  const upstream = new URL(
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/${zoom}/${column}/${row}`,
  );
  upstream.searchParams.set("access_token", token);
  let response: Response;
  try {
    response = await fetch(upstream, {
      headers: { Referer: MAPBOX_ALLOWED_ORIGIN },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return new Response(null, { status: 502 });
  }
  if (!response.ok) return new Response(null, { status: 502 });
  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
