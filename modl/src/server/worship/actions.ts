"use server";

import { redirect } from "next/navigation";
import { WorshipFlowError, saveCaptionLinks } from "@/server/worship/caption";
import { CAPTION_LANGUAGES } from "@/worship/caption-links";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveCaptionLinksAction(formData: FormData) {
  const communityId = text(formData, "communityId");
  const back = `/worship?church=${encodeURIComponent(communityId)}`;
  try {
    await saveCaptionLinks(
      communityId,
      CAPTION_LANGUAGES.map((item) => ({ code: item.code, url: text(formData, `url-${item.code}`) })),
    );
  } catch (error) {
    const message = error instanceof WorshipFlowError ? error.message : "자막 언어를 저장하지 못했습니다.";
    redirect(`${back}&error=${encodeURIComponent(message)}`);
  }
  redirect(`${back}&ok=captions`);
}
