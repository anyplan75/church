/** 성도 기도제목 Firebase 읽기·쓰기. church/churches/{id}/prayerRequests 만 사용. */

import { authToken, currentUser, listAccounts, readDb } from "./app-db";
import { DatabasePermissionError, dbGet, dbPatch, dbSet } from "./firebase-db";
import {
  buildPrayerRequest,
  canManagePrayers,
  canSeePastorInbox,
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

function assignedPastor() {
  const db = readDb();
  const pastorUid = String(db?.settings.pastorUid || "").trim();
  const pastorName = String(db?.settings.pastorName || "").trim();
  if (pastorUid) return { pastorUid, pastorName };
  // 설정이 비어 있으면 admin/prepare/run 계정 중 첫 사람을 기본 담당으로 씁니다.
  const accounts = listAccounts().filter((row) => canManagePrayers(row.roles));
  const first = accounts[0];
  if (!first) return { pastorUid: "", pastorName: "" };
  return { pastorUid: first.id, pastorName: first.email.split("@")[0] || "담당 목사" };
}

export async function loadPrayerRequests(): Promise<PrayerRequest[]> {
  const user = requireChurchUser();
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(prayerPath(user.churchId!), token);
    const all = prayersFromMap(raw);
    const assigned = String(readDb()?.settings.pastorUid || "").trim();
    return all.filter((row) => {
      if (row.authorUid === user.id) return true;
      return canSeePastorInbox(user, row, assigned);
    });
  } catch (error) {
    rethrow(error);
  }
}

export async function submitPrayerRequest(input: {
  text: string;
  serviceId?: string;
  serviceTitle?: string;
  authorName?: string;
  pastorUid?: string;
}): Promise<PrayerRequest> {
  const user = requireChurchUser();
  const assigned = assignedPastor();
  const pastorUid = String(input.pastorUid || assigned.pastorUid || "").trim();
  if (!pastorUid) {
    throw new Error("담당 목사님이 아직 정해지지 않았습니다. 설정에서 담당 목사를 지정해 주세요.");
  }
  const accounts = listAccounts();
  const pastor = accounts.find((row) => row.id === pastorUid);
  const pastorName =
    pastorUid === assigned.pastorUid && assigned.pastorName
      ? assigned.pastorName
      : pastor?.email.split("@")[0] || assigned.pastorName || "담당 목사";
  const row = buildPrayerRequest({
    authorUid: user.id,
    authorEmail: user.email,
    authorName: input.authorName || "",
    pastorUid,
    pastorName,
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
  if (!isPrayerStatus(status)) throw new Error("상태가 올바르지 않습니다.");
  try {
    const token = await authToken();
    const path = prayerPath(user.churchId!, requestId);
    const raw = await dbGet<unknown>(path, token);
    const current = prayerFromRaw(requestId, raw);
    if (!current) throw new Error("기도제목을 찾지 못했습니다.");
    const assigned = String(readDb()?.settings.pastorUid || "").trim();
    if (!canSeePastorInbox(user, current, assigned)) {
      throw new Error("기도제목 상태를 바꿀 권한이 없습니다.");
    }
    const next: PrayerRequest = { ...current, status, updatedAt: Date.now() };
    await dbPatch(
      path,
      {
        status: next.status,
        updatedAt: next.updatedAt,
        pastorUid: next.pastorUid || null,
        pastorName: next.pastorName || null,
      },
      token,
    );
    return next;
  } catch (error) {
    rethrow(error);
  }
}

export function churchPastorOptions(): { id: string; label: string }[] {
  return listAccounts()
    .filter((row) => canManagePrayers(row.roles))
    .map((row) => ({
      id: row.id,
      label: `${row.email}${row.roles.includes("admin") ? " (관리)" : ""}`,
    }));
}
