"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createArchive, createQuiz, ArchiveFlowError, readableArchiveError, submitQuiz } from "@/server/archive/service";

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
      photoText: z.string().max(8000),
      youtubeText: z.string().max(8000),
    })
    .safeParse({
      title: text(formData, "title"),
      photoText: text(formData, "photoText"),
      youtubeText: text(formData, "youtubeText"),
    });
  if (!parsed.success) fail("/archive", new ArchiveFlowError(parsed.error.issues[0]?.message ?? "행사 기록을 확인해 주세요."));
  let archiveId = "";
  try {
    archiveId = await createArchive(parsed.data);
  } catch (error) {
    fail("/archive", error);
  }
  redirect(`/archive/${archiveId}?ok=archive`);
}

export async function createQuizAction(formData: FormData) {
  const parsed = z
    .object({
      title: z.string().trim().min(1, "퀴즈 제목을 적어 주세요.").max(160),
      lines: z.string().trim().min(1, "퀴즈 문제를 적어 주세요.").max(20000),
    })
    .safeParse({
      title: text(formData, "title"),
      lines: text(formData, "lines"),
    });
  if (!parsed.success) fail("/archive", new ArchiveFlowError(parsed.error.issues[0]?.message ?? "퀴즈를 확인해 주세요."));
  let quizId = "";
  try {
    quizId = await createQuiz(parsed.data);
  } catch (error) {
    fail("/archive", error);
  }
  redirect(`/archive/quiz/${quizId}?ok=quiz`);
}

export async function submitQuizAction(formData: FormData) {
  const quizId = text(formData, "quizId");
  const back = `/archive/quiz/${quizId}`;
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
  if (!parsed.success) fail("/archive", new ArchiveFlowError("퀴즈를 찾지 못했습니다."));
  try {
    await submitQuiz({ quizId: parsed.data, answers });
  } catch (error) {
    fail(back, error);
  }
  redirect(`${back}?ok=score`);
}
