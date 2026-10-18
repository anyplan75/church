/** 성도 기도제목 Firebase 읽기·쓰기. church/churches/{id}/prayerRequests 만 사용. */

import { authToken, currentUser } from "./app-db";
import { DatabasePermissionError, dbGet, dbPatch, dbSet } from "./firebase-db";
import {
  buildPrayerRequest,
  canManagePrayers,
  isPrayerStatus,
  prayerFromRaw,
  prayerPath,
  prayersFromMap,
  type PrayerRequest,
  type PrayerStatus,
} from "./prayer-requests";

function requireChurchUser() {
  const user = currentUser();
  if (!user || !user.churchId || user.kind === "platform") {
    throw new Error("교회 계정으로 로그인해 주세요.");
  }
  return user;
}

function rethrow(error: unknown): never {
  if (error instanceof DatabasePermissionError) {
    throw new Error("기도제목 권한이 없습니다. 교회 계정으로 다시 로그인해 주세요.");
  }
  throw error;
}

export async function loadPrayerRequests(): Promise<PrayerRequest[]> {
  const user = requireChurchUser();
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(prayerPath(user.churchId!), token);
    const all = prayersFromMap(raw);
    if (canManagePrayers(user.roles)) return all;
    return all.filter((row) => row.authorUid === user.id);
  } catch (error) {
    rethrow(error);
  }
}

export async function submitPrayerRequest(input: {
  text: string;
  serviceId?: string;
  serviceTitle?: string;
  authorName?: string;
}): Promise<PrayerRequest> {
  const user = requireChurchUser();
  const row = buildPrayerRequest({
    authorUid: user.id,
    authorEmail: user.email,
    authorName: input.authorName || "",
    text: input.text,
    serviceId: input.serviceId,
    serviceTitle: input.serviceTitle,
  });
  try {
    const token = await authToken();
    await dbSet(prayerPath(user.churchId!, row.id), row, token);
    return row;
  } catch (error) {
    rethrow(error);
  }
}

export async function updatePrayerStatus(requestId: string, status: PrayerStatus): Promise<PrayerRequest> {
  const user = requireChurchUser();
  if (!canManagePrayers(user.roles)) throw new Error("기도제목 상태를 바꿀 권한이 없습니다.");
  if (!isPrayerStatus(status)) throw new Error("상태가 올바르지 않습니다.");
  try {
    const token = await authToken();
    const path = prayerPath(user.churchId!, requestId);
    const raw = await dbGet<unknown>(path, token);
    const current = prayerFromRaw(requestId, raw);
    if (!current) throw new Error("기도제목을 찾지 못했습니다.");
    const next: PrayerRequest = { ...current, status, updatedAt: Date.now() };
    await dbPatch(path, { status: next.status, updatedAt: next.updatedAt }, token);
    return next;
  } catch (error) {
    rethrow(error);
  }
}
