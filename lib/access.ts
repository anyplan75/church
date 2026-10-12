import type { Service } from "./types";
import { can, type Role } from "./roles";

export function serviceSaveBlock(roles: readonly Role[], previous: Service, next: Service): string | null {
  const contentChanged = contentKey(previous) !== contentKey(next);
  const prepareStatus = next.status !== previous.status && (next.status === "ready" || next.status === "planning");
  const runChanged = isRunChange(previous, next);
  if (!contentChanged && !prepareStatus && !runChanged) {
    return can(roles, "mutate.prepare") ? null : "권한이 없습니다.";
  }
  if ((contentChanged || prepareStatus) && !can(roles, "mutate.prepare")) return "권한이 없습니다.";
  if (runChanged && !can(roles, "mutate.run")) return "권한이 없습니다.";
  return null;
}

function isRunChange(previous: Service, next: Service): boolean {
  if (previous.liveIndex !== next.liveIndex) return true;
  if (previous.status !== next.status && (next.status === "live" || next.status === "done" || previous.status === "live")) return true;
  if ((previous.startedAt ?? null) !== (next.startedAt ?? null) && (next.status === "live" || previous.status === "live" || next.status === "done")) {
    return true;
  }
  return false;
}

function contentKey(service: Service): string {
  return JSON.stringify(stable({
    title: service.title,
    date: service.date,
    time: service.time,
    type: service.type,
    place: service.place,
    preacherId: service.preacherId,
    items: service.items,
    announcements: service.announcements,
    notes: service.notes,
    checks: service.checks,
    source: service.source,
  }));
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stable(record[key])]));
  }
  return value;
}
