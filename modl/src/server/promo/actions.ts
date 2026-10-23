"use server";

import { redirect } from "next/navigation";
import { readablePromoError, saveChurchIntro, savePromo, type PromoKind } from "@/server/promo/service";

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

export async function saveChurchIntroAction(churchId: string, intro: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await saveChurchIntro(churchId, intro);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: readablePromoError(error) };
  }
}
