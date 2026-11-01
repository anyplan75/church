"use server";

import { redirect } from "next/navigation";
import { loadActor } from "@/server/auth/session";
import {
  approveGuide,
  isSiteOperator,
  pullFailureMessage,
  pullGuideMail,
  readableGuideError,
  rejectGuide,
} from "@/server/guide/inbox";

function fail(error: unknown): never {
  redirect(`/guide-inbox?error=${encodeURIComponent(readableGuideError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function pullGuideMailAction() {
  const actor = await loadActor();
  if (!isSiteOperator(actor)) {
    redirect(`/guide-inbox?error=${encodeURIComponent("메일함 확인은 사이트 운영자만 할 수 있습니다.")}`);
  }
  const result = await pullGuideMail();
  if (!result.ok) {
    redirect(`/guide-inbox?error=${encodeURIComponent(pullFailureMessage(result.reason))}`);
  }
  redirect(`/guide-inbox?ok=mail&count=${result.added}`);
}

export async function approveGuideAction(formData: FormData) {
  try {
    await approveGuide(text(formData, "id"), text(formData, "placeRef"));
  } catch (error) {
    fail(error);
  }
  redirect("/guide-inbox?ok=approved");
}

export async function rejectGuideAction(formData: FormData) {
  try {
    await rejectGuide(text(formData, "id"));
  } catch (error) {
    fail(error);
  }
  redirect("/guide-inbox?ok=rejected");
}
