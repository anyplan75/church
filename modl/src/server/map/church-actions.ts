"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { importChurchRows, removeChurch, saveChurch, saveMyAddress, setPickupConsent } from "@/server/map/board";
import { MapServiceError } from "@/server/map/service";
import { readChurchSheet } from "@/server/map/sheet";

function messageOf(error: unknown): string {
  if (error instanceof MapServiceError || error instanceof Error) return error.message;
  return "교회 목록을 저장하지 못했습니다.";
}

function fail(error: unknown, tab = ""): never {
  const where = tab ? `/account?tab=${tab}&` : "/account?";
  redirect(`${where}error=${encodeURIComponent(messageOf(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const churchSchema = z.object({
  name: z.string().trim().min(1, "교회 이름을 적어 주세요.").max(80),
  pastorName: z.string().trim().max(80),
  address: z.string().trim().max(200),
  phone: z.string().trim().max(40),
  serviceTime: z.string().trim().max(80),
  memo: z.string().trim().max(500),
});

export async function saveChurchAction(formData: FormData) {
  const parsed = churchSchema.safeParse({
    name: text(formData, "name"),
    pastorName: text(formData, "pastorName"),
    address: text(formData, "address"),
    phone: text(formData, "phone"),
    serviceTime: text(formData, "serviceTime"),
    memo: text(formData, "memo"),
  });
  if (!parsed.success) fail(new MapServiceError(parsed.error.issues[0]?.message ?? "교회를 확인해 주세요."), "church");
  const churchId = text(formData, "churchId");
  let missed = false;
  try {
    const saved = await saveChurch({ ...parsed.data, churchId: churchId || null });
    missed = saved.missed;
  } catch (error) {
    fail(error, "church");
  }
  redirect(missed ? "/account?tab=church&ok=missed" : "/account?tab=church&ok=church");
}

export async function removeChurchAction(formData: FormData) {
  const churchId = text(formData, "churchId");
  if (!churchId) fail(new MapServiceError("지울 교회를 찾지 못했습니다."), "church");
  try {
    await removeChurch(churchId);
  } catch (error) {
    fail(error, "church");
  }
  redirect("/account?tab=church&ok=removed");
}

export async function importChurchSheetAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) fail(new MapServiceError("엑셀 파일을 골라 주세요."), "church");
  if (file.size > 2_000_000) fail(new MapServiceError("엑셀 파일은 2MB 안으로 올려 주세요."), "church");
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx")) fail(new MapServiceError("엑셀 파일은 .xlsx 만 받습니다."), "church");
  let result = { count: 0, missed: 0 };
  try {
    const rows = await readChurchSheet(new Uint8Array(await file.arrayBuffer()));
    result = await importChurchRows(rows);
  } catch (error) {
    fail(error, "church");
  }
  const missed = result.missed > 0 ? `&missed=${result.missed}` : "";
  redirect(`/account?tab=church&ok=sheet&count=${result.count}${missed}`);
}

export async function saveMyAddressAction(address: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await saveMyAddress(address);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

export async function saveMyAddressFormAction(formData: FormData) {
  try {
    await saveMyAddress(text(formData, "address"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=address");
}

export async function setPickupConsentFormAction(formData: FormData) {
  try {
    await setPickupConsent(formData.get("agreed") === "on");
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=pickup");
}

export async function setPickupConsentAction(agreed: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await setPickupConsent(agreed);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
