import { isChurchId } from "./platform";
import { normalizeOutputLines } from "./worship";
import type { Db, Service } from "./types";

/** 모들(교회 연결 묶음) ID. `m` + 영숫자 */
export function isModuleId(id: string): boolean {
  return /^m[a-z0-9]{6,16}$/.test(id);
}

export function makeModuleId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let body = "";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (const byte of bytes) body += alphabet[byte % alphabet.length];
  const id = `m${body}`;
  return isModuleId(id) ? id : `m${Date.now().toString(36)}${alphabet[bytes[0] % alphabet.length]}`;
}

export type ModuleMeta = {
  id: string;
  name: string;
  createdAt: number;
  hostChurchId: string;
};

export type ModuleMember = {
  churchId: string;
  name: string;
  joinedAt: number;
};

/** 연결된 교회끼리 공유하는 실시간 자막(송출 두 줄) */
export type SharedCaptions = {
  lines: string[];
  serviceId: string;
  serviceTitle: string;
  serviceDate: string;
  sourceChurchId: string;
  updatedAt: number;
};

/** 연결된 교회끼리 공유하는 주보 원문(입력) */
export type SharedBulletin = {
  text: string;
  sourceChurchId: string;
  updatedAt: number;
};

export type ModuleShared = {
  captions?: SharedCaptions | null;
  bulletin?: SharedBulletin | null;
};

export type ModuleMembership = {
  moduleId: string;
  joinedAt: number;
};

export type ModuleSnapshot = {
  membership: ModuleMembership | null;
  meta: ModuleMeta | null;
  members: ModuleMember[];
  shared: ModuleShared;
};

const BULLETIN_TEXT_MAX = 120_000;

export function normalizeModuleMeta(raw: unknown, fallbackId = ""): ModuleMeta | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id || fallbackId).trim();
  const hostChurchId = String(row.hostChurchId || "").trim();
  const name = String(row.name || "").trim().slice(0, 40);
  const createdAt = Number(row.createdAt);
  if (!isModuleId(id) || !isChurchId(hostChurchId) || !name || !Number.isFinite(createdAt)) return null;
  return { id, name, hostChurchId, createdAt };
}

export function normalizeModuleMember(churchId: string, raw: unknown): ModuleMember | null {
  if (!isChurchId(churchId)) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.churchId || churchId).trim();
  const name = String(row.name || "").trim().slice(0, 40) || "교회";
  const joinedAt = Number(row.joinedAt);
  if (!isChurchId(id) || id !== churchId || !Number.isFinite(joinedAt)) return null;
  return { churchId: id, name, joinedAt };
}

export function normalizeSharedCaptions(raw: unknown): SharedCaptions | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const sourceChurchId = String(row.sourceChurchId || "").trim();
  const updatedAt = Number(row.updatedAt);
  if (!isChurchId(sourceChurchId) || !Number.isFinite(updatedAt)) return null;
  return {
    lines: normalizeOutputLines(Array.isArray(row.lines) ? row.lines.map(String) : []),
    serviceId: String(row.serviceId || "").trim().slice(0, 80),
    serviceTitle: String(row.serviceTitle || "").trim().slice(0, 80),
    serviceDate: String(row.serviceDate || "").trim().slice(0, 10),
    sourceChurchId,
    updatedAt,
  };
}

export function normalizeSharedBulletin(raw: unknown): SharedBulletin | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const sourceChurchId = String(row.sourceChurchId || "").trim();
  const updatedAt = Number(row.updatedAt);
  const text = String(row.text || "").slice(0, BULLETIN_TEXT_MAX);
  if (!isChurchId(sourceChurchId) || !Number.isFinite(updatedAt) || !text.trim()) return null;
  return { text, sourceChurchId, updatedAt };
}

export function normalizeMembership(raw: unknown): ModuleMembership | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const moduleId = String(row.moduleId || "").trim();
  const joinedAt = Number(row.joinedAt);
  if (!isModuleId(moduleId) || !Number.isFinite(joinedAt)) return null;
  return { moduleId, joinedAt };
}

export function clipBulletinText(text: string): string {
  return String(text || "").slice(0, BULLETIN_TEXT_MAX);
}

/**
 * 공유 자막을 이 교회 DB의 진행 중(또는 같은 날짜) 예배에 반영합니다.
 * 자기 교회가 방금 올린 자막이면 건너뜁니다.
 */
export function applySharedCaptionsToDb(
  db: Db,
  shared: SharedCaptions,
  selfChurchId: string,
): { changed: boolean; serviceId: string | null } {
  if (shared.sourceChurchId === selfChurchId) return { changed: false, serviceId: null };
  const target = pickCaptionTarget(db.services, shared);
  if (!target) return { changed: false, serviceId: null };
  const next = normalizeOutputLines(shared.lines);
  const prev = normalizeOutputLines(target.outputLines);
  if (prev.length === next.length && prev.every((line, index) => line === next[index])) {
    return { changed: false, serviceId: target.id };
  }
  target.outputLines = next;
  return { changed: true, serviceId: target.id };
}

function pickCaptionTarget(services: Service[], shared: SharedCaptions): Service | null {
  const live = services.find((service) => service.status === "live");
  if (live) return live;
  if (shared.serviceDate) {
    const sameDate = services.filter((service) => service.date === shared.serviceDate);
    if (shared.serviceTitle) {
      const titled = sameDate.find((service) => service.title === shared.serviceTitle);
      if (titled) return titled;
    }
    if (sameDate[0]) return sameDate[0];
  }
  if (shared.serviceId) {
    const byId = services.find((service) => service.id === shared.serviceId);
    if (byId) return byId;
  }
  return services.find((service) => service.status === "ready") ?? null;
}

/** 공유 주보를 아직 반영하지 않았으면 true */
export function shouldApplySharedBulletin(shared: SharedBulletin, selfChurchId: string, appliedAt: number | undefined): boolean {
  if (shared.sourceChurchId === selfChurchId) return false;
  const last = Number(appliedAt || 0);
  return shared.updatedAt > last;
}
