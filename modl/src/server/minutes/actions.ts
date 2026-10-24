"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createMinutes, MinutesFlowError, readableMinutesError } from "@/server/minutes/service";

function fail(gatheringId: string, error: unknown): never {
  const place = gatheringId ? `gathering=${encodeURIComponent(gatheringId)}&` : "";
  redirect(`/minutes?${place}error=${encodeURIComponent(readableMinutesError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createMinutesAction(formData: FormData) {
  const gatheringId = text(formData, "gatheringId");
  const parsed = z
    .object({
      gatheringId: z.string().uuid("모들을 골라 주세요."),
      meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "회의 날짜를 골라 주세요."),
      attendeesText: z.string().max(4000),
      content: z.string().trim().min(1, "회의 내용을 적어 주세요.").max(20000),
      attachmentText: z.string().max(8000),
    })
    .safeParse({
      gatheringId,
      meetingDate: text(formData, "meetingDate"),
      attendeesText: text(formData, "attendeesText"),
      content: text(formData, "content"),
      attachmentText: text(formData, "attachmentText"),
    });
  if (!parsed.success) fail(gatheringId, new MinutesFlowError(parsed.error.issues[0]?.message ?? "회의록을 확인해 주세요."));
  try {
    await createMinutes(parsed.data);
  } catch (error) {
    fail(gatheringId, error);
  }
  redirect(`/minutes?gathering=${encodeURIComponent(gatheringId)}&ok=minutes`);
}
