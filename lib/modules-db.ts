import { applyBulletin } from "./bulletin-apply";
import { authToken, currentUser, listChurches, readDb, updateDb } from "./app-db";
import { dbGet, dbRemove, dbSet } from "./firebase-db";
import {
  applySharedCaptionsToDb,
  clipBulletinText,
  isModuleId,
  makeModuleId,
  normalizeMembership,
  normalizeModuleMember,
  normalizeModuleMeta,
  normalizeSharedBulletin,
  normalizeSharedCaptions,
  shouldApplySharedBulletin,
  type ModuleMember,
  type ModuleMeta,
  type ModuleShared,
  type ModuleSnapshot,
  type SharedBulletin,
  type SharedCaptions,
} from "./modules";
import { isChurchId } from "./platform";
import { can } from "./roles";
import { syncReminders } from "./reminders";
import type { Service } from "./types";

function assertAdminChurch(): { churchId: string; churchName: string } {
  const user = currentUser();
  if (!user?.churchId || !isChurchId(user.churchId)) throw new Error("교회를 연 뒤에 연결할 수 있습니다.");
  if (user.kind !== "platform" && !can(user.roles, "mutate.admin")) throw new Error("설정·계정 역할이 필요합니다.");
  const db = readDb();
  return { churchId: user.churchId, churchName: db.settings.churchName || "교회" };
}

export async function loadModuleSnapshot(churchId: string): Promise<ModuleSnapshot> {
  if (!isChurchId(churchId)) {
    return { membership: null, meta: null, members: [], shared: {} };
  }
  const token = await authToken().catch(() => "");
  const membership = normalizeMembership(await dbGet(`moduleMembership/${churchId}`, token).catch(() => null));
  if (!membership) return { membership: null, meta: null, members: [], shared: {} };
  const [metaRaw, membersRaw, captionsRaw, bulletinRaw] = await Promise.all([
    dbGet(`modules/${membership.moduleId}/meta`, token).catch(() => null),
    dbGet<Record<string, unknown>>(`modules/${membership.moduleId}/members`, token).catch(() => null),
    dbGet(`modules/${membership.moduleId}/shared/captions`, token).catch(() => null),
    dbGet(`modules/${membership.moduleId}/shared/bulletin`, token).catch(() => null),
  ]);
  const meta = normalizeModuleMeta(metaRaw, membership.moduleId);
  const members = Object.entries(membersRaw || {})
    .map(([id, value]) => normalizeModuleMember(id, value))
    .filter((row): row is ModuleMember => row !== null)
    .sort((a, b) => a.joinedAt - b.joinedAt);
  const shared: ModuleShared = {
    captions: normalizeSharedCaptions(captionsRaw),
    bulletin: normalizeSharedBulletin(bulletinRaw),
  };
  return { membership, meta, members, shared };
}

/** 모들(연결 묶음)을 새로 만들고 이 교회를 첫 멤버로 둡니다. */
export async function createModule(name: string): Promise<{ ok: true; moduleId: string } | { ok: false; message: string }> {
  try {
    const { churchId, churchName } = assertAdminChurch();
    const existing = normalizeMembership(await dbGet(`moduleMembership/${churchId}`, await authToken()).catch(() => null));
    if (existing) return { ok: false, message: "이미 다른 교회와 연결되어 있습니다. 먼저 연결을 끊어 주세요." };
    const trimmed = String(name || "").trim().slice(0, 40) || `${churchName} 연결`;
    const moduleId = makeModuleId();
    const token = await authToken();
    const now = Date.now();
    const meta: ModuleMeta = { id: moduleId, name: trimmed, createdAt: now, hostChurchId: churchId };
    const member: ModuleMember = { churchId, name: churchName, joinedAt: now };
    await dbSet(`modules/${moduleId}/meta`, meta, token);
    await dbSet(`modules/${moduleId}/members/${churchId}`, member, token);
    await dbSet(`moduleMembership/${churchId}`, { moduleId, joinedAt: now }, token);
    return { ok: true, moduleId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "연결을 만들지 못했습니다." };
  }
}

/** 초대 코드(모들 ID)로 기존 연결에 참여합니다. */
export async function joinModule(moduleIdRaw: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { churchId, churchName } = assertAdminChurch();
    const moduleId = String(moduleIdRaw || "").trim().toLowerCase();
    if (!isModuleId(moduleId)) return { ok: false, message: "연결 코드 형식을 확인해 주세요. (예: m…)" };
    const token = await authToken();
    const existing = normalizeMembership(await dbGet(`moduleMembership/${churchId}`, token).catch(() => null));
    if (existing) return { ok: false, message: "이미 다른 교회와 연결되어 있습니다. 먼저 연결을 끊어 주세요." };
    const meta = normalizeModuleMeta(await dbGet(`modules/${moduleId}/meta`, token).catch(() => null), moduleId);
    if (!meta) return { ok: false, message: "그 연결 코드를 찾지 못했습니다." };
    const now = Date.now();
    const member: ModuleMember = { churchId, name: churchName, joinedAt: now };
    await dbSet(`modules/${moduleId}/members/${churchId}`, member, token);
    await dbSet(`moduleMembership/${churchId}`, { moduleId, joinedAt: now }, token);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "연결에 참여하지 못했습니다." };
  }
}

/** 연결을 끊습니다. 마지막 교회면 모들 자료도 지웁니다. */
export async function leaveModule(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { churchId } = assertAdminChurch();
    const token = await authToken();
    const membership = normalizeMembership(await dbGet(`moduleMembership/${churchId}`, token).catch(() => null));
    if (!membership) return { ok: true };
    const moduleId = membership.moduleId;
    const membersNow = await dbGet<Record<string, unknown>>(`modules/${moduleId}/members`, token).catch(() => null);
    const onlySelf =
      membersNow &&
      Object.keys(membersNow).length === 1 &&
      Object.prototype.hasOwnProperty.call(membersNow, churchId);
    // 멤버십을 지운 뒤에는 meta 삭제 권한이 사라지므로, 마지막 교회면 먼저 공유·meta를 지웁니다.
    if (onlySelf) {
      await Promise.all([
        dbRemove(`modules/${moduleId}/shared/captions`, token).catch(() => undefined),
        dbRemove(`modules/${moduleId}/shared/bulletin`, token).catch(() => undefined),
        dbRemove(`modules/${moduleId}/meta`, token).catch(() => undefined),
      ]);
    }
    await dbRemove(`modules/${moduleId}/members/${churchId}`, token).catch(() => undefined);
    await dbRemove(`moduleMembership/${churchId}`, token).catch(() => undefined);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "연결을 끊지 못했습니다." };
  }
}

export async function publishSharedCaptions(service: Service, lines: string[]): Promise<void> {
  const user = currentUser();
  if (!user?.churchId || !isChurchId(user.churchId)) return;
  const token = await authToken().catch(() => "");
  if (!token) return;
  const membership = normalizeMembership(await dbGet(`moduleMembership/${user.churchId}`, token).catch(() => null));
  if (!membership) return;
  const payload: SharedCaptions = {
    lines: lines.map((line) => String(line || "").trim()).filter(Boolean).slice(0, 2),
    serviceId: service.id,
    serviceTitle: service.title,
    serviceDate: service.date,
    sourceChurchId: user.churchId,
    updatedAt: Date.now(),
  };
  await dbSet(`modules/${membership.moduleId}/shared/captions`, payload, token);
}

export async function publishSharedBulletin(text: string): Promise<void> {
  const user = currentUser();
  if (!user?.churchId || !isChurchId(user.churchId)) return;
  const clipped = clipBulletinText(text);
  if (!clipped.trim()) return;
  const token = await authToken().catch(() => "");
  if (!token) return;
  const membership = normalizeMembership(await dbGet(`moduleMembership/${user.churchId}`, token).catch(() => null));
  if (!membership) return;
  const payload: SharedBulletin = {
    text: clipped,
    sourceChurchId: user.churchId,
    updatedAt: Date.now(),
  };
  await dbSet(`modules/${membership.moduleId}/shared/bulletin`, payload, token);
}

/**
 * 연결(모들)에 올라온 자막·주보를 이 교회 로컬 자료에 반영합니다.
 * 연결되지 않았으면 아무 것도 하지 않습니다.
 */
export async function pullModuleSharedIntoLocal(churchId: string): Promise<boolean> {
  if (!isChurchId(churchId)) return false;
  const snap = await loadModuleSnapshot(churchId);
  if (!snap.membership) return false;
  let changed = false;
  const captions = snap.shared.captions;
  const bulletin = snap.shared.bulletin;
  const dbNow = readDb();
  const needCaptions =
    Boolean(captions) && applySharedCaptionsToDb(structuredClone(dbNow), captions!, churchId).changed;
  const needBulletin = Boolean(bulletin) && shouldApplySharedBulletin(bulletin!, churchId, dbNow.settings.moduleBulletinAt);
  if (!needCaptions && !needBulletin) return false;
  updateDb((db) => {
    if (needCaptions && captions) {
      const result = applySharedCaptionsToDb(db, captions, churchId);
      if (result.changed) changed = true;
    }
    if (needBulletin && bulletin) {
      applyBulletin(db, bulletin.text);
      syncReminders(db);
      db.settings.moduleBulletinAt = bulletin.updatedAt;
      changed = true;
    }
  });
  return changed;
}

