"use server";

import { redirect } from "next/navigation";
import { addBannedWord, BannedWordAdminError, removeBannedWord, updateBannedWord } from "@/server/moderation/words";

function messageOf(error: unknown): string {
  if (error instanceof BannedWordAdminError || error instanceof Error) return error.message;
  return "금지어를 저장하지 못했습니다.";
}

function fail(error: unknown): never {
  redirect(`/account?error=${encodeURIComponent(messageOf(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function addBannedWordAction(formData: FormData) {
  try {
    await addBannedWord(text(formData, "word"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=banned");
}

export async function updateBannedWordAction(formData: FormData) {
  try {
    await updateBannedWord(text(formData, "wordId"), text(formData, "word"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=banned");
}

export async function removeBannedWordAction(formData: FormData) {
  try {
    await removeBannedWord(text(formData, "wordId"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=banned-removed");
}
