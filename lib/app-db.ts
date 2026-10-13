import { normalizeDb } from "./db-shape";
import { firebaseRefresh, firebaseSignIn } from "./firebase-auth";
import { hashLocalPassword, verifyLocalPassword } from "./local-password";
import { go } from "./page-path";
import { syncReminders } from "./reminders";
import { ALL_ROLES, can, type Capability, type Role } from "./roles";
import { buildSeed } from "./seed";
import type { Db } from "./types";

export const DEMO_EMAIL = "demo@eunhye.kr";

export type LocalAccount = {
  id: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  personId: string | null;
};

export type CurrentUser = { id: string; email: string; roles: Role[] };

type Session = { accountId: string; email: string; roles: Role[]; refreshToken: string };

type Snapshot = { ready: boolean; user: CurrentUser | null; db: Db | null };

const listeners = new Set<() => void>();
let db: Db | null = null;
let accounts: LocalAccount[] = [];
let session: Session | null = null;
let files = new Map<string, string>();
let ready = false;
let booting: Promise<void> | null = null;
const initialSnapshot: Snapshot = { ready: false, user: null, db: null };
let snapshot: Snapshot = initialSnapshot;

export function subscribeChurch(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function churchSnapshot(): Snapshot {
  return snapshot;
}

export function serverChurchSnapshot(): Snapshot {
  return initialSnapshot;
}

function emit() {
  snapshot = { ready, user: currentUser(), db };
  for (const listener of listeners) listener();
}

export function notifyChurch() {
  emit();
}

export async function bootChurch() {
  if (ready) return;
  booting ??= load();
  await booting;
}

async function load() {
  const savedDb = await idbGet<Db>("db");
  const savedAccounts = await idbGet<LocalAccount[]>("accounts");
  const savedSession = await idbGet<Session>("session");
  const savedFiles = await idbGet<Record<string, string>>("files");
  db = savedDb ? normalizeDb(savedDb) : buildSeed();
  syncReminders(db);
  accounts = Array.isArray(savedAccounts) ? savedAccounts.map(withPersonLink) : [];
  files = new Map(Object.entries(savedFiles ?? {}));
  session = savedSession && savedSession.email ? savedSession : null;
  if (session?.refreshToken) {
    const alive = await firebaseRefresh(session.refreshToken).catch(() => false);
    if (!alive && !usesLocalPassword(session)) session = null;
  }
  if (!savedDb) await idbSet("db", db);
  ready = true;
  emit();
}

function usesLocalPassword(value: Session | null): boolean {
  if (!value) return false;
  const account = accounts.find((item) => item.email === value.email);
  return Boolean(account && account.passwordHash.startsWith("pbkdf2$"));
}

export function readDb(): Db {
  if (!db) db = buildSeed();
  return db;
}

export function updateDb(mutator: (current: Db) => void): Db {
  const current = readDb();
  mutator(current);
  db = current;
  void idbSet("db", current);
  emit();
  return current;
}

export function currentUser(): CurrentUser | null {
  if (!session) return null;
  return { id: session.accountId, email: session.email, roles: session.roles };
}

export function listAccounts(): LocalAccount[] {
  return accounts.slice();
}

export function requireMutation(capability: Capability): CurrentUser {
  const user = currentUser();
  if (!user) go("/login");
  if (!can(user.roles, capability)) go("/denied");
  return user;
}

export function mutationUser(capability: Capability): { ok: true; user: CurrentUser } | { ok: false; message: string } {
  const user = currentUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  if (!can(user.roles, capability)) return { ok: false, message: "권한이 없습니다." };
  return { ok: true, user };
}

export async function loginWithPassword(email: string, password: string): Promise<CurrentUser | null> {
  const local = accounts.find((account) => account.email === email);
  if (local?.passwordHash.startsWith("pbkdf2$") && (await verifyLocalPassword(password, local.passwordHash))) {
    rememberSession({ accountId: local.id, email: local.email, roles: local.roles, refreshToken: "" });
    return currentUser();
  }
  const remote = await firebaseSignIn(email, password).catch(() => null);
  if (!remote) return null;
  const roles = email === DEMO_EMAIL ? ALL_ROLES : local?.roles ?? [];
  if (roles.length === 0) return null;
  const account: LocalAccount = {
    id: remote.localId,
    email,
    passwordHash: local?.passwordHash.startsWith("pbkdf2$") ? local.passwordHash : "firebase",
    roles,
    personId: local?.personId ?? null,
  };
  upsertAccount(account);
  rememberSession({ accountId: account.id, email, roles, refreshToken: remote.refreshToken });
  return currentUser();
}

export async function saveLocalAccount(account: LocalAccount, password?: string) {
  const next = { ...account };
  if (password) next.passwordHash = await hashLocalPassword(password);
  upsertAccount(next);
  if (session?.accountId === next.id || session?.email === next.email) {
    session = { ...session, accountId: next.id, email: next.email, roles: next.roles };
    await idbSet("session", session);
  }
  emit();
}

export function removeLocalAccount(id: string) {
  accounts = accounts.filter((account) => account.id !== id);
  void idbSet("accounts", accounts);
  if (session?.accountId === id) {
    session = null;
    void idbSet("session", null);
  }
  emit();
}

export function endLocalSession() {
  session = null;
  void idbSet("session", null);
  emit();
}

export function storedBackgroundUrl(name: string | null | undefined): string | null {
  if (!name) return null;
  return files.get(name) ?? null;
}

export async function saveBackgroundFile(name: string, dataUrl: string) {
  files.set(name, dataUrl);
  await idbSet("files", Object.fromEntries(files));
}

export function clearBackgroundFile(name: string | null) {
  if (!name) return;
  files.delete(name);
  void idbSet("files", Object.fromEntries(files));
}

export function dueReminders() {
  const current = readDb();
  syncReminders(current);
  return current.reminders.filter((reminder) => reminder.status === "due").map((reminder) => ({ id: reminder.id, message: reminder.message }));
}

export function markRemindersSent(ids: string[]) {
  const picked = new Set(ids);
  updateDb((current) => {
    for (const reminder of current.reminders) {
      if (picked.has(reminder.id) && reminder.status === "due") reminder.status = "sent";
    }
  });
}

function withPersonLink(account: LocalAccount): LocalAccount {
  return {
    ...account,
    personId: typeof account.personId === "string" && account.personId ? account.personId : null,
  };
}

function upsertAccount(account: LocalAccount) {
  const index = accounts.findIndex((item) => item.id === account.id || item.email === account.email);
  if (index >= 0) accounts[index] = account;
  else accounts.push(account);
  void idbSet("accounts", accounts);
}

function rememberSession(next: Session) {
  session = next;
  void idbSet("session", next);
  emit();
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("church-worship", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("kv")) request.result.createObjectStore("kv");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const database = await idb();
  return new Promise((resolve, reject) => {
    const request = database.transaction("kv", "readonly").objectStore("kv").get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key: string, value: unknown) {
  const database = await idb();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction("kv", "readwrite").objectStore("kv").put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
