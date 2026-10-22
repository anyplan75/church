"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createArchive, createQuiz, ArchiveFlowError, readableArchiveError, saveQuizPrize, submitQuiz } from "@/server/archive/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableArchiveError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createArchiveAction(formData: FormData) {
  const parsed = z
    .object({
      title: z.string().trim().min(1, "행사 제목을 적어 주세요.").max(160),
      eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "행사 날짜를 확인해 주세요."),
      photoText: z.string().max(8000),
      youtubeText: z.string().max(8000),
    })
    .safeParse({
      title: text(formData, "title"),
      eventDate: text(formData, "eventDate"),
      photoText: text(formData, "photoText"),
      youtubeText: text(formData, "youtubeText"),
    });
  if (!parsed.success) fail("/archive", new ArchiveFlowError(parsed.error.issues[0]?.message ?? "행사 기록을 확인해 주세요."));
  try {
    await createArchive(parsed.data);
  } catch (error) {
    fail("/archive", error);
  }
  redirect("/archive?ok=archive");
}

export async function createQuizAction(formData: FormData) {
  const parsed = z
    .object({
      title: z.string().trim().min(1, "퀴즈 제목을 적어 주세요.").max(160),
      lines: z.string().trim().min(1, "퀴즈 문제를 적어 주세요.").max(20000),
      worshipEndedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "예배가 끝난 시각을 확인해 주세요."),
      solveMinutes: z.coerce
        .number({ invalid_type_error: "풀 수 있는 시간을 확인해 주세요." })
        .int("풀 수 있는 시간을 확인해 주세요.")
        .min(1, "풀 수 있는 시간은 1분에서 10080분 사이로 적어 주세요.")
        .max(10080, "풀 수 있는 시간은 1분에서 10080분 사이로 적어 주세요."),
    })
    .safeParse({
      title: text(formData, "title"),
      lines: text(formData, "lines"),
      worshipEndedAt: text(formData, "worshipEndedAt"),
      solveMinutes: text(formData, "solveMinutes"),
    });
  if (!parsed.success) fail("/quiz", new ArchiveFlowError(parsed.error.issues[0]?.message ?? "퀴즈를 확인해 주세요."));
  let quizId = "";
  try {
    quizId = await createQuiz(parsed.data);
  } catch (error) {
    fail("/quiz", error);
  }
  redirect(`/quiz/${quizId}?ok=quiz`);
}

export async function saveQuizPrizeAction(formData: FormData) {
  const prizeName = text(formData, "prizeName");
  if (!prizeName) fail("/quiz", new ArchiveFlowError("상품 이름을 적어 주세요."));
  try {
    await saveQuizPrize(prizeName);
  } catch (error) {
    fail("/quiz", error);
  }
  redirect("/quiz?ok=prize");
}

export async function submitQuizAction(formData: FormData) {
  const quizId = text(formData, "quizId");
  const back = `/quiz/${quizId}`;
  const answers: number[] = [];
  for (let index = 0; index < 50; index += 1) {
    const raw = text(formData, `answer${index}`);
    if (!raw) break;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      fail(back, new ArchiveFlowError("보기를 골라 주세요."));
    }
    answers.push(value);
  }
  const parsed = z.string().uuid("퀴즈를 찾지 못했습니다.").safeParse(quizId);
  if (!parsed.success) fail("/quiz", new ArchiveFlowError("퀴즈를 찾지 못했습니다."));
  try {
    await submitQuiz({ quizId: parsed.data, answers });
  } catch (error) {
    fail(back, error);
  }
  redirect(`${back}?ok=score`);
}
