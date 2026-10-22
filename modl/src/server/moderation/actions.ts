"use server";

import { redirect } from "next/navigation";
import { BannedWordAdminError, saveBannedWordList } from "@/server/moderation/words";

function messageOf(error: unknown): string {
  if (error instanceof BannedWordAdminError || error instanceof Error) return error.message;
  return "금지어를 저장하지 못했습니다.";
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveBannedWordsAction(formData: FormData) {
  try {
    await saveBannedWordList(text(formData, "words"));
  } catch (error) {
    redirect(`/account?tab=banned&error=${encodeURIComponent(messageOf(error))}`);
  }
  redirect("/account?tab=banned&ok=banned");
}
