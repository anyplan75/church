"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createPrayer,
  markLetterRead,
  prayTogether,
  PrayerFlowError,
  readablePrayerError,
  sendPrayerLetter,
} from "@/server/prayer/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readablePrayerError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createPrayerAction(formData: FormData) {
  const parsed = z
    .object({
      content: z.string().trim().min(1, "기도 내용을 적어 주세요.").max(4000),
      placeRefs: z.array(z.string().trim().min(1)).min(1, "기도 범위를 골라 주세요."),
      isAnonymous: z.boolean(),
    })
    .safeParse({
      content: text(formData, "content"),
      placeRefs: formData.getAll("placeRef").filter((item): item is string => typeof item === "string" && item.trim().length > 0),
      isAnonymous: formData.get("isAnonymous") === "yes",
    });
  if (!parsed.success) fail("/prayer", new PrayerFlowError(parsed.error.issues[0]?.message ?? "기도를 확인해 주세요."));
  try {
    await createPrayer(parsed.data);
  } catch (error) {
    fail("/prayer", error);
  }
  redirect("/prayer?ok=prayer");
}

export async function prayTogetherAction(formData: FormData) {
  const prayerId = text(formData, "prayerId");
  const parsed = z.string().uuid("기도 글을 찾지 못했습니다.").safeParse(prayerId);
  if (!parsed.success) fail("/prayer", new PrayerFlowError(parsed.error.issues[0]?.message ?? "기도를 확인해 주세요."));
  let result: "added" | "kept" | null = null;
  try {
    result = await prayTogether(parsed.data);
  } catch (error) {
    fail("/prayer", error);
  }
  if (!result) return;
  redirect(`/prayer?ok=${result === "added" ? "prayed" : "pray_kept"}`);
}

export async function sendPrayerLetterAction(formData: FormData) {
  const parsed = z
    .object({
      prayerId: z.string().uuid("기도 글을 찾지 못했습니다."),
      message: z.string().trim().min(1, "기별 내용을 적어 주세요.").max(2000),
    })
    .safeParse({
      prayerId: text(formData, "prayerId"),
      message: text(formData, "message"),
    });
  if (!parsed.success) {
    fail("/prayer", new PrayerFlowError(parsed.error.issues[0]?.message ?? "기별을 확인해 주세요."));
  }
  try {
    await sendPrayerLetter(parsed.data);
  } catch (error) {
    fail("/prayer", error);
  }
  redirect("/prayer_letter?ok=letter");
}

export async function markLetterReadAction(formData: FormData) {
  const parsed = z.string().uuid("기별을 찾지 못했습니다.").safeParse(text(formData, "letterId"));
  if (!parsed.success) {
    fail("/prayer_letter", new PrayerFlowError(parsed.error.issues[0]?.message ?? "기별을 확인해 주세요."));
  }
  try {
    await markLetterRead(parsed.data);
  } catch (error) {
    fail("/prayer_letter", error);
  }
  redirect("/prayer_letter?ok=read");
}
