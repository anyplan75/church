import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  if (!salt || !parts[2]) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(parts[2], "base64url");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;
  const actual = scryptSync(password, salt, KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}

let dummyHash: string | null = null;

export function dummyPasswordHash(): string {
  dummyHash ??= hashPassword("not-a-real-password");
  return dummyHash;
}
