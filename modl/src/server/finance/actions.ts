"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createCategory, createTransaction, FinanceFlowError, readableFinanceError, syncFinanceToSheets } from "@/server/finance/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableFinanceError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createCategoryAction(formData: FormData) {
  const parsed = z
    .object({
      departmentOrEvent: z.string().trim().min(1, "부서나 행사 이름을 적어 주세요.").max(120),
      type: z.enum(["INCOME", "EXPENSE"], { message: "수입 또는 지출을 골라 주세요." }),
      name: z.string().trim().min(1, "분류 이름을 적어 주세요.").max(120),
      budgetAmount: z.string().regex(/^\d+$/, "예산은 0 이상의 정수로 적어 주세요."),
    })
    .safeParse({
      departmentOrEvent: text(formData, "departmentOrEvent"),
      type: text(formData, "type"),
      name: text(formData, "name"),
      budgetAmount: text(formData, "budgetAmount"),
    });
  if (!parsed.success) fail("/finance", new FinanceFlowError(parsed.error.issues[0]?.message ?? "분류를 확인해 주세요."));
  const placeRef = text(formData, "placeRef");
  const placeKind = placeRef.startsWith("gathering:") ? "gathering" : placeRef.startsWith("church:") ? "church" : null;
  const placeId = placeKind ? placeRef.slice(placeKind.length + 1) : "";
  if (!placeKind || !placeId) fail("/finance", new FinanceFlowError("재정을 둘 교회나 모임을 골라 주세요."));
  try {
    await createCategory({ ...parsed.data, placeKind, placeId });
  } catch (error) {
    fail("/finance", error);
  }
  redirect("/finance?ok=category");
}

export async function createTransactionAction(formData: FormData) {
  const parsed = z
    .object({
      categoryId: z.string().uuid("분류를 골라 주세요."),
      transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 골라 주세요."),
      amount: z.string().regex(/^\d+$/, "금액은 0 이상의 정수로 적어 주세요."),
      description: z.string().trim().min(1, "설명을 적어 주세요.").max(1000),
      receiptText: z.string().max(8000),
    })
    .safeParse({
      categoryId: text(formData, "categoryId"),
      transactionDate: text(formData, "transactionDate"),
      amount: text(formData, "amount"),
      description: text(formData, "description"),
      receiptText: text(formData, "receiptText"),
    });
  if (!parsed.success) fail("/finance", new FinanceFlowError(parsed.error.issues[0]?.message ?? "거래를 확인해 주세요."));
  try {
    await createTransaction(parsed.data);
  } catch (error) {
    fail("/finance", error);
  }
  redirect("/finance?ok=transaction");
}

export async function syncSheetsAction() {
  let result: "sent" | "missing" | "failed" = "missing";
  try {
    result = await syncFinanceToSheets();
  } catch (error) {
    fail("/finance", error);
  }
  if (result === "sent") redirect("/finance?ok=sheets");
  if (result === "missing") redirect("/finance?note=sheets_needs_key");
  redirect("/finance?error=" + encodeURIComponent("구글 시트에 보내지 못했습니다."));
}
