"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AttendanceFlowError,
  createSession,
  markAttendance,
  readableAttendanceError,
  selfCheckIn,
} from "@/server/attendance/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableAttendanceError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createSessionAction(formData: FormData) {
  const parsed = z
    .object({
      departmentType: z.enum(["YOUTH", "SCHOOL"], { message: "청년부 또는 교육부를 골라 주세요." }),
      title: z.string().trim().min(1, "모임 제목을 적어 주세요.").max(120),
      sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "모임 날짜를 골라 주세요."),
    })
    .safeParse({
      departmentType: text(formData, "departmentType"),
      title: text(formData, "title"),
      sessionDate: text(formData, "sessionDate"),
    });
  if (!parsed.success) fail("/attendance", new AttendanceFlowError(parsed.error.issues[0]?.message ?? "출석 모임을 확인해 주세요."));
  let sessionId = "";
  try {
    sessionId = await createSession(parsed.data);
  } catch (error) {
    fail("/attendance", error);
  }
  redirect(`/attendance/session/${sessionId}?ok=session`);
}

export async function markAttendanceAction(formData: FormData) {
  const sessionId = text(formData, "sessionId");
  const back = `/attendance/session/${sessionId}`;
  const parsed = z
    .object({
      memberId: z.string().uuid("식구를 찾지 못했습니다."),
      status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"], { message: "출석 상태를 골라 주세요." }),
    })
    .safeParse({
      memberId: text(formData, "memberId"),
      status: text(formData, "status"),
    });
  if (!parsed.success) fail(back, new AttendanceFlowError(parsed.error.issues[0]?.message ?? "출석을 확인해 주세요."));
  try {
    await markAttendance({ sessionId, memberId: parsed.data.memberId, status: parsed.data.status });
  } catch (error) {
    fail(back, error);
  }
  redirect(back);
}

export async function selfCheckInAction(formData: FormData) {
  const token = text(formData, "token");
  const back = `/attendance/qr/${encodeURIComponent(token)}`;
  let result: "checked" | "kept" | null = null;
  try {
    result = await selfCheckIn(token);
  } catch (error) {
    fail(back, error);
  }
  if (!result) return;
  redirect(`${back}?ok=${result}`);
}
