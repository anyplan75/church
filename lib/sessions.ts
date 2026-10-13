import { createHash, randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { dataDir } from "./data-dir";

type Session = {
  tokenHash: string;
  accountId: string;
  expiresAt: string;
};

type SessionFile = { sessions: Session[] };

const SESSION_DAYS = 14;

export function sessionsFile(): string {
  return path.join(dataDir(), "sessions.json");
}

export function createSession(accountId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const sessions = readSessions().filter((session) => Date.parse(session.expiresAt) > Date.now());
  sessions.push({ tokenHash: hashToken(token), accountId, expiresAt });
  writeSessions(sessions);
  return { token, expiresAt };
}

export function accountIdForToken(token: string): string | null {
  if (!token) return null;
  const hash = hashToken(token);
  const now = Date.now();
  const session = readSessions().find((item) => item.tokenHash === hash && Date.parse(item.expiresAt) > now);
  return session?.accountId ?? null;
}

export function dropSession(token: string) {
  if (!token) return;
  const hash = hashToken(token);
  writeSessions(readSessions().filter((session) => session.tokenHash !== hash));
}

export function dropSessionsForAccount(accountId: string) {
  const sessions = readSessions();
  const next = sessions.filter((session) => session.accountId !== accountId);
  if (next.length !== sessions.length) writeSessions(next);
}

function readSessions(): Session[] {
  const file = sessionsFile();
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<SessionFile> | null;
  return Array.isArray(parsed?.sessions) ? parsed.sessions.filter(isSession) : [];
}

function writeSessions(sessions: Session[]) {
  const file = sessionsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  const body: SessionFile = { sessions };
  fs.writeFileSync(temporary, JSON.stringify(body, null, 2));
  fs.renameSync(temporary, file);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isSession(value: Session | null | undefined): value is Session {
  return Boolean(value && typeof value.tokenHash === "string" && typeof value.accountId === "string" && typeof value.expiresAt === "string");
}
