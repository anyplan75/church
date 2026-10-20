"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createQt, giveGrace, QtFlowError, readableQtError, saveReflection } from "@/server/qt/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableQtError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function readFile(formData: FormData): Promise<{ type: string; size: number; bytes: Buffer } | null> {
  const value = formData.get("sourceFile");
  if (!(value instanceof File) || value.size <= 0) return null;
  return {
    type: value.type,
    size: value.size,
    bytes: Buffer.from(await value.arrayBuffer()),
  };
}

export async function createQtAction(formData: FormData) {
  const parsed = z
    .object({
      qtDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 골라 주세요."),
      scriptureTitle: z.string().trim().min(1, "말씀 제목을 적어 주세요.").max(160),
      scriptureBody: z.string().max(20000),
      questionsText: z.string().max(20000),
    })
    .safeParse({
      qtDate: text(formData, "qtDate"),
      scriptureTitle: text(formData, "scriptureTitle"),
      scriptureBody: text(formData, "scriptureBody"),
      questionsText: text(formData, "questionsText"),
    });
  if (!parsed.success) fail("/qt", new QtFlowError(parsed.error.issues[0]?.message ?? "말씀을 확인해 주세요."));
  let created: { id: string; filledFromOcr: boolean } | null = null;
  try {
    created = await createQt({
      qtDate: parsed.data.qtDate,
      scriptureTitle: parsed.data.scriptureTitle,
      scriptureBody: parsed.data.scriptureBody,
      questionsText: parsed.data.questionsText,
      file: await readFile(formData),
    });
  } catch (error) {
    fail("/qt", error);
  }
  if (!created) return;
  const ocr = created.filledFromOcr ? "&ocr=1" : "";
  redirect(`/qt/${created.id}?ok=qt${ocr}`);
}

export async function saveReflectionAction(formData: FormData) {
  const qtId = text(formData, "qtId");
  const back = `/qt/${qtId}`;
  const parsed = z
    .object({
      qtId: z.string().uuid("말씀을 찾지 못했습니다."),
      answersText: z.string().trim().min(1, "묵상 답을 적어 주세요.").max(20000),
    })
    .safeParse({
      qtId,
      answersText: text(formData, "answersText"),
    });
  if (!parsed.success) fail(back, new QtFlowError(parsed.error.issues[0]?.message ?? "묵상을 확인해 주세요."));
  try {
    await saveReflection(parsed.data);
  } catch (error) {
    fail(back, error);
  }
  redirect(`${back}?ok=reflection`);
}

export async function giveGraceAction(formData: FormData) {
  const qtId = text(formData, "qtId");
  const back = `/qt/${qtId}`;
  const parsed = z
    .object({
      qtId: z.string().uuid("말씀을 찾지 못했습니다."),
      reflectionId: z.string().uuid("묵상을 찾지 못했습니다."),
    })
    .safeParse({
      qtId,
      reflectionId: text(formData, "reflectionId"),
    });
  if (!parsed.success) fail(back, new QtFlowError(parsed.error.issues[0]?.message ?? "은혜를 확인해 주세요."));
  let result: "added" | "kept" | null = null;
  try {
    result = await giveGrace(parsed.data);
  } catch (error) {
    fail(back, error);
  }
  if (!result) return;
  redirect(`${back}?ok=${result === "added" ? "grace" : "grace_kept"}`);
}
