import { NextResponse } from "next/server";
import { readLinkedCaption } from "@/server/worship/caption";

export const dynamic = "force-dynamic";

/** 고른 언어에 연결된 번역기 링크의 자막만 돌려줍니다. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const communityId = url.searchParams.get("community")?.trim() ?? "";
  const language = url.searchParams.get("language")?.trim() ?? "";
  if (!communityId || !language) {
    return NextResponse.json({ lines: [], message: "언어를 골라 주세요." });
  }
  const result = await readLinkedCaption(communityId, language);
  return NextResponse.json(result);
}
