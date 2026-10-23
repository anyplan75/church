"use server";

import { redirect } from "next/navigation";
import type { BoardTab } from "@/promo/rules";
import { loadInstagramFeed, type InstagramFeed } from "@/server/promo/instagram-feed";
import { readablePromoError, saveChurchIntro, savePromo, loadPromo, type PromoKind } from "@/server/promo/service";
import { loadYoutubeFeed, type YoutubeFeed } from "@/server/promo/youtube-feed";

function kindOf(value: string): PromoKind {
  if (value === "church" || value === "gathering") return value;
  throw new Error("교회나 모들을 찾지 못했습니다.");
}

function rows(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((item) => String(item));
}

export async function savePromoAction(formData: FormData) {
  const kind = kindOf(String(formData.get("kind") ?? ""));
  const id = String(formData.get("placeId") ?? "");
  const titles = rows(formData, "youtubeTitle");
  const urls = rows(formData, "youtubeUrl");
  const tabTitles = rows(formData, "tabTitle");
  const postTitles = rows(formData, "postTitle");
  const postBodies = rows(formData, "postBody");
  const postTabs = rows(formData, "postTab");
  const youtube = titles.map((title, index) => ({ title, url: urls[index] ?? "" }));
  const tabs = tabTitles.map((title, index) => ({
    title,
    posts: postTitles.flatMap((postTitle, postIndex) => {
      if (postTabs[postIndex] !== String(index)) return [];
      return [{ title: postTitle, body: postBodies[postIndex] ?? "" }];
    }),
  }));
  try {
    await savePromo(kind, id, { instagram: String(formData.get("instagram") ?? ""), youtube, tabs });
  } catch (error) {
    redirect(`/promo/${kind}/${id}/settings?error=${encodeURIComponent(readablePromoError(error))}`);
  }
  redirect(`/promo/${kind}/${id}?ok=saved`);
}

export type MapPromoPayload = {
  name: string;
  intro: string;
  manager: boolean;
  instagramAccount: string;
  instagram: InstagramFeed;
  youtube: YoutubeFeed;
  tabs: BoardTab[];
};

/** 지도 옆 창에 넣을 홍보 페이지입니다. 소개, 인스타그램, 유튜브, 게시판을 함께 돌려줍니다. */
export async function loadMapPromoAction(
  kind: string,
  id: string,
): Promise<{ ok: true; page: MapPromoPayload } | { ok: false; message: string }> {
  const placeKind: PromoKind | null = kind === "church" || kind === "gathering" ? kind : null;
  if (!placeKind || !id.trim()) return { ok: false, message: "교회나 모들을 찾지 못했습니다." };
  try {
    const page = await loadPromo(placeKind, id);
    if (!page) return { ok: false, message: placeKind === "church" ? "교회를 찾지 못했습니다." : "모들을 찾지 못했습니다." };
    const [instagram, youtube] = await Promise.all([loadInstagramFeed(page.content.instagram), loadYoutubeFeed(page.content.youtube)]);
    return {
      ok: true,
      page: {
        name: page.name,
        intro: page.intro,
        manager: page.manager,
        instagramAccount: page.content.instagram,
        instagram,
        youtube,
        tabs: page.content.tabs,
      },
    };
  } catch (error) {
    return { ok: false, message: readablePromoError(error) };
  }
}

export async function saveChurchIntroAction(churchId: string, intro: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await saveChurchIntro(churchId, intro);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: readablePromoError(error) };
  }
}
