import { normalizeRoles, type Role } from "./roles";

export const PLATFORM_EMAIL = "anyplan@me.com";

const BANNED_IDS = new Set(["live-interpret", "cheil", "jifc", "church"]);

export type Actor = {
  kind: "platform" | "church";
  churchId: string | null;
};

export function isPlatformEmail(email: string): boolean {
  return email.trim().toLowerCase() === PLATFORM_EMAIL;
}

export function isChurchId(id: string): boolean {
  return /^c[a-z0-9]{6,16}$/.test(id) && !BANNED_IDS.has(id);
}

export function makeChurchId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let body = "";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (const byte of bytes) body += alphabet[byte % alphabet.length];
  const id = `c${body}`;
  return isChurchId(id) ? id : `c${Date.now().toString(36)}${alphabet[bytes[0] % alphabet.length]}`;
}

export function canAddChurch(actor: Actor): boolean {
  return actor.kind === "platform";
}

export function canSeeChurch(actor: Actor, churchId: string): boolean {
  if (!isChurchId(churchId)) return false;
  if (actor.kind === "platform") return true;
  return actor.churchId === churchId;
}

export function visibleChurchIds(actor: Actor, ids: readonly string[]): string[] {
  return ids.filter((id) => canSeeChurch(actor, id));
}

export function rolesToMap(roles: readonly Role[]): Record<string, true> {
  return Object.fromEntries(normalizeRoles(roles).map((role) => [role, true as const]));
}

export function rolesFromMap(value: unknown): Role[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return normalizeRoles(Object.keys(value as Record<string, unknown>));
}
