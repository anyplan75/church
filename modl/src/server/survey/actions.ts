"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSurvey, readableSurveyError, submitSurvey, SurveyFlowError } from "@/server/survey/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableSurveyError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createSurveyAction(formData: FormData) {
  const parsed = z
    .object({
      title: z.string().trim().min(1, "설문 제목을 적어 주세요.").max(160),
      questionsText: z.string().trim().min(1, "질문을 한 줄 이상 적어 주세요.").max(20000),
      allowAnonymous: z.boolean(),
      deadline: z.string(),
    })
    .safeParse({
      title: text(formData, "title"),
      questionsText: text(formData, "questionsText"),
      allowAnonymous: formData.get("allowAnonymous") === "yes",
      deadline: text(formData, "deadline"),
    });
  if (!parsed.success) fail("/survey", new SurveyFlowError(parsed.error.issues[0]?.message ?? "설문을 확인해 주세요."));
  let surveyId = "";
  try {
    surveyId = await createSurvey(parsed.data);
  } catch (error) {
    fail("/survey", error);
  }
  redirect(`/survey/${surveyId}?ok=survey`);
}

export async function submitSurveyAction(formData: FormData) {
  const surveyId = text(formData, "surveyId");
  const back = `/survey/${surveyId}`;
  const answers: string[] = [];
  for (let index = 0; index < 50; index += 1) {
    const raw = formData.get(`answer${index}`);
    if (typeof raw !== "string") break;
    answers.push(raw.trim());
  }
  const parsed = z.string().uuid("설문을 찾지 못했습니다.").safeParse(surveyId);
  if (!parsed.success) fail("/survey", new SurveyFlowError("설문을 찾지 못했습니다."));
  let result: "saved" | "closed" | null = null;
  try {
    result = await submitSurvey({ surveyId: parsed.data, answers });
  } catch (error) {
    fail(back, error);
  }
  if (result === "closed") redirect(`${back}?note=survey_closed`);
  redirect(`${back}?ok=answer`);
}
