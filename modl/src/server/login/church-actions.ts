"use server";

import { redirect } from "next/navigation";
import { chooseSignupChurch, registerSignupChurch } from "@/server/map/board";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(error: unknown): never {
  const message = error instanceof Error && /[\uac00-\ud7a3]/.test(error.message) ? error.message : "교회를 저장하지 못했습니다.";
  redirect(`/signup/church?error=${encodeURIComponent(message)}`);
}

/** 목록에 있는 교회를 계정에 저장합니다. */
export async function chooseSignupChurchAction(formData: FormData): Promise<void> {
  try {
    await chooseSignupChurch(text(formData, "churchId"));
  } catch (error) {
    fail(error);
  }
  redirect("/");
}

/** 목록에 없는 교회를 직접 등록하고 계정에 저장합니다. */
export async function registerSignupChurchAction(formData: FormData): Promise<void> {
  const tags = formData.getAll("tags").filter((value): value is string => typeof value === "string");
  try {
    await registerSignupChurch({
      name: text(formData, "name"),
      pastorName: text(formData, "pastorName"),
      address: text(formData, "address"),
      phone: text(formData, "phone"),
      serviceTime: text(formData, "serviceTime"),
      memo: text(formData, "memo"),
      tags,
    });
  } catch (error) {
    fail(error);
  }
  redirect("/");
}
