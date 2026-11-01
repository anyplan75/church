"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeChurchTags } from "@/map/church-tags";
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

function placesFail(error: unknown): never {
  redirect(`/account/places?error=${encodeURIComponent(messageOf(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const churchSchema = z.object({
  name: z.string().trim().min(1, "교회 이름을 적어 주세요.").max(80, "교회 이름은 80자 안으로 적어 주세요."),
  pastorName: z.string().trim().max(80, "담임목사 이름은 80자 안으로 적어 주세요."),
  address: z.string().trim().max(200, "주소는 200자 안으로 적어 주세요."),
  phone: z.string().trim().max(40, "전화번호는 40자 안으로 적어 주세요."),
  serviceTime: z.string().trim().max(80, "주일 예배시간은 80자 안으로 적어 주세요."),
  memo: z.string().trim().max(500, "메모는 500자 안으로 적어 주세요."),
});

export async function saveMapChurchAction(input: {
  churchId: string;
  name: string;
  pastorName: string;
  address: string;
  phone: string;
  serviceTime: string;
  memo: string;
  tags: string[];
}): Promise<{ ok: true; missed: boolean; church: Awaited<ReturnType<typeof saveChurch>>["church"] } | { ok: false; message: string }> {
  const parsed = churchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "교회를 확인해 주세요." };
  const churchId = input.churchId.trim();
  if (!churchId) return { ok: false, message: "교회를 찾지 못했습니다." };
  try {
    const saved = await saveChurch({ ...parsed.data, churchId, tags: input.tags });
    return { ok: true, missed: saved.missed, church: saved.church };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

export async function saveChurchAction(formData: FormData) {
  const parsed = churchSchema.safeParse({
    name: text(formData, "name"),
    pastorName: text(formData, "pastorName"),
    address: text(formData, "address"),
    phone: text(formData, "phone"),
    serviceTime: text(formData, "serviceTime"),
    memo: text(formData, "memo"),
  });
  if (!parsed.success) placesFail(new MapServiceError(parsed.error.issues[0]?.message ?? "교회를 확인해 주세요."));
  const churchId = text(formData, "churchId");
  let missed = false;
  try {
    const tags = normalizeChurchTags(formData.getAll("tags").flatMap((value) => (typeof value === "string" ? [value] : [])));
    const saved = await saveChurch({ ...parsed.data, churchId: churchId || null, tags });
    missed = saved.missed;
  } catch (error) {
    placesFail(error);
  }
  redirect(missed ? "/account/places?ok=missed" : "/account/places?ok=church");
}

export async function removeChurchAction(formData: FormData) {
  const churchId = text(formData, "churchId");
  if (!churchId) placesFail(new MapServiceError("지울 교회를 찾지 못했습니다."));
  try {
    await removeChurch(churchId);
  } catch (error) {
    placesFail(error);
  }
  redirect("/account/places?ok=removed");
}

export async function importChurchSheetAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) placesFail(new MapServiceError("엑셀 파일을 골라 주세요."));
  if (file.size > 2_000_000) placesFail(new MapServiceError("엑셀 파일은 2MB 안으로 올려 주세요."));
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx")) placesFail(new MapServiceError("엑셀 파일은 .xlsx 만 받습니다."));
  let result = { count: 0, missed: 0 };
  try {
    const rows = await readChurchSheet(new Uint8Array(await file.arrayBuffer()));
    result = await importChurchRows(rows);
  } catch (error) {
    placesFail(error);
  }
  const missed = result.missed > 0 ? `&missed=${result.missed}` : "";
  redirect(`/account/places?ok=sheet&count=${result.count}${missed}`);
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
