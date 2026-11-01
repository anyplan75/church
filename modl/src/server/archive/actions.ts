"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createArchive, ArchiveFlowError, readableArchiveError } from "@/server/archive/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableArchiveError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function texts(formData: FormData, key: string): string[] {
  return formData.getAll(key).flatMap((value) => (typeof value === "string" && value.trim() ? [value.trim()] : []));
}

export async function createArchiveAction(formData: FormData) {
  const parsed = z
    .object({
      title: z.string().trim().min(1, "행사 제목을 적어 주세요.").max(160),
      eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "행사 날짜를 확인해 주세요."),
      photoText: z.string().max(8000),
      youtubeText: z.string().max(8000),
      churchIds: z.array(z.string()),
      gatheringIds: z.array(z.string()),
    })
    .safeParse({
      title: text(formData, "title"),
      eventDate: text(formData, "eventDate"),
      photoText: text(formData, "photoText"),
      youtubeText: text(formData, "youtubeText"),
      churchIds: texts(formData, "churchIds"),
      gatheringIds: texts(formData, "gatheringIds"),
    });
  if (!parsed.success) fail("/archive", new ArchiveFlowError(parsed.error.issues[0]?.message ?? "행사 기록을 확인해 주세요."));
  try {
    await createArchive(parsed.data);
  } catch (error) {
    fail("/archive", error);
  }
  redirect("/archive?ok=archive");
}
