"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { parseLocalDateTime } from "@/calendar/rules";
import {
  CalendarFlowError,
  deleteCalendarEvent,
  readableCalendarError,
  saveCalendarEvent,
  syncCalendarEvent,
} from "@/server/calendar/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableCalendarError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function eventPath(eventId: string): string {
  return eventId ? `/calendar/${eventId}` : "/calendar";
}

export async function saveCalendarEventAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  const back = eventPath(eventId);
  const parsed = z
    .object({
      title: z.string().trim().min(1, "일정 제목을 적어 주세요.").max(200),
      startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "시작 시각을 골라 주세요."),
      endAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "끝나는 시각을 골라 주세요."),
      category: z.enum(["RETREAT", "EVENT", "BIRTHDAY", "HOLIDAY", "ETC"], { message: "일정 종류를 골라 주세요." }),
    })
    .safeParse({
      title: text(formData, "title"),
      startAt: text(formData, "startAt"),
      endAt: text(formData, "endAt"),
      category: text(formData, "category"),
    });
  if (!parsed.success) fail(back, new CalendarFlowError(parsed.error.issues[0]?.message ?? "일정을 확인해 주세요."));
  const startAt = parseLocalDateTime(parsed.data.startAt);
  const endAt = parseLocalDateTime(parsed.data.endAt);
  if (!startAt || !endAt) fail(back, new CalendarFlowError("시작과 끝 시각을 골라 주세요."));
  let saved: { id: string; google: "skipped" | "synced" | "failed" } | null = null;
  try {
    saved = await saveCalendarEvent({
      eventId: eventId || null,
      title: parsed.data.title,
      startAt,
      endAt,
      category: parsed.data.category,
      isLeaderOnly: text(formData, "isLeaderOnly") === "yes",
      groupId: text(formData, "groupId") || null,
    });
  } catch (error) {
    fail(back, error);
  }
  if (!saved) return;
  if (saved.google === "failed") {
    redirect(`/calendar/${saved.id}?error=${encodeURIComponent("구글 달력에 보내지 못했습니다. 모들 달력에는 남았습니다.")}`);
  }
  redirect(`/calendar/${saved.id}?ok=${saved.google === "synced" ? "google" : "event"}`);
}

export async function syncCalendarEventAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  const back = eventPath(eventId);
  let result: "skipped" | "synced" | "failed" | null = null;
  try {
    result = await syncCalendarEvent(eventId);
  } catch (error) {
    fail(back, error);
  }
  if (result === "synced") redirect(`${back}?ok=google`);
  if (result === "failed") {
    redirect(`${back}?error=${encodeURIComponent("구글 달력에 보내지 못했습니다. 모들 달력에는 남았습니다.")}`);
  }
  redirect(back);
}

export async function deleteCalendarEventAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await deleteCalendarEvent(eventId);
  } catch (error) {
    fail(eventPath(eventId), error);
  }
  redirect("/calendar?ok=event");
}
