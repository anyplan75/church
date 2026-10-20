"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { readableError } from "@/server/community/service";
import { answerQuestion, approveQuestionReply, askQuestion } from "@/server/questions/service";
import { isQuestionAudience } from "@/questions/rules";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function returnPath(value: string, fallback: string): string {
  if (value === "/approvals" || value === "/") return value;
  if (/^\/question\/[0-9a-f-]{36}$/i.test(value)) return value;
  return fallback;
}

export async function askQuestionAction(formData: FormData) {
  const parsed = z
    .object({
      body: z.string().trim().min(1, "질문을 적어 주세요.").max(2000, "질문은 2000자 안으로 적어 주세요."),
      audience: z.string().refine(isQuestionAudience, "보이는 곳을 골라 주세요."),
      pastorMemberId: z.string().trim(),
    })
    .safeParse({
      body: text(formData, "body"),
      audience: text(formData, "audience"),
      pastorMemberId: text(formData, "pastorMemberId"),
    });
  if (!parsed.success) fail("/", new Error(parsed.error.issues[0]?.message ?? "질문을 확인해 주세요."));
  let id = "";
  try {
    id = await askQuestion({
      body: parsed.data.body,
      audience: parsed.data.audience,
      pastorMemberId: parsed.data.pastorMemberId || null,
    });
  } catch (error) {
    fail("/", error);
  }
  redirect(`/question/${id}?ok=asked`);
}

export async function answerQuestionAction(formData: FormData) {
  const questionId = text(formData, "questionId");
  const path = returnPath(`/question/${questionId}`, "/");
  try {
    await answerQuestion(questionId, text(formData, "body"));
  } catch (error) {
    fail(path, error);
  }
  redirect(`${path}?ok=replied`);
}

export async function approveQuestionReplyAction(formData: FormData) {
  const replyId = text(formData, "replyId");
  const back = returnPath(text(formData, "returnTo"), "/approvals");
  let questionId = "";
  try {
    questionId = await approveQuestionReply(replyId);
  } catch (error) {
    fail(back, error);
  }
  redirect(back === "/approvals" ? "/approvals?ok=reply_approved" : `/question/${questionId}?ok=reply_approved`);
}
