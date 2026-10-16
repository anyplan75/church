import { closeVisit, openVisit } from "./simple";
import { normalizeDb } from "./db-shape";
import { DatabasePermissionError, dbGet, dbPatch, dbSet } from "./firebase-db";
import {
  emailFromIdToken,
  firebaseDeleteAccount,
  firebaseRefresh,
  firebaseSignIn,
  firebaseSignUp,
  firebaseUpdateAccount,
  type FirebaseSession,
} from "./firebase-auth";
import { go } from "./page-path";
import {
  canAddChurch,
  canSeeChurch,
  isChurchId,
  isPlatformEmail,
  makeChurchId,
  rolesFromMap,
  rolesToMap,
  type Actor,
} from "./platform";
import { syncReminders } from "./reminders";
import { ALL_ROLES, can, normalizeRoles, type Capability, type Role } from "./roles";
import { buildSeed } from "./seed";
import type { ActivityEntry, Db } from "./types";

export type LocalAccount = {
  id: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  personId: string | null;
};

export type ChurchRow = {
  id: string;
  name: string;
  operatorEmail: string;
  createdAt: number;
};

export type CurrentUser = {
  id: string;
  email: string;
  roles: Role[];
  kind: "platform" | "church";
  churchId: string | null;
};

type Session = {
  accountId: string;
  email: string;
  roles: Role[];
  refreshToken: string;
  idToken: string;
  expiresAt: number;
  kind: "platform" | "church";
  churchId: string | null;
};

type RemoteAccount = {
  email?: string;
  churchId?: string;
  roles?: unknown;
  personId?: string | null;
};

type Snapshot = {
  ready: boolean;
  user: CurrentUser | null;
  db: Db | null;
  churches: ChurchRow[];
  error: string;
};

const SESSION_KEY = "church-worship-session";
const listeners = new Set<() => void>();
let db: Db | null = null;
let accounts: LocalAccount[] = [];
let churches: ChurchRow[] = [];
let session: Session | null = null;
let files = new Map<string, string>();
let ready = false;
let error = "";
let booting: Promise<void> | null = null;
let loadGeneration = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let writing = false;
const initialSnapshot: Snapshot = { ready: false, user: null, db: null, churches: [], error: "" };
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
  snapshot = { ready, user: currentUser(), db, churches: churches.slice(), error };
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
  const generation = ++loadGeneration;
  forgetBrowserData();
  session = readStoredSession();
  try {
    if (session) {
      const refreshed = await refreshShared(session.refreshToken);
      if (generation !== loadGeneration) return;
      if (!refreshed) clearSession();
      else {
        session = {
          ...session,
          accountId: refreshed.localId || session.accountId,
          email: emailFromIdToken(refreshed.idToken) || refreshed.email || session.email,
          idToken: refreshed.idToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
        };
        const adopted = await adoptSession(session);
        if (generation !== loadGeneration) return;
        if (!adopted) clearSession();
      }
    }
    if (generation !== loadGeneration) return;
    ready = true;
    emit();
    startPoll();
  } catch (reason) {
    if (generation !== loadGeneration) return;
    if (reason instanceof DatabasePermissionError) {
      clearSession();
      ready = true;
      emit();
      startPoll();
      return;
    }
    ready = false;
    error = "다시 연결합니다.";
    emit();
    window.setTimeout(() => {
      if (generation !== loadGeneration) return;
      booting = null;
      void load();
    }, 800);
  }
}

function forgetBrowserData() {
  if (typeof indexedDB === "undefined") return;
  try {
    indexedDB.deleteDatabase("church-worship");
  } catch {
    /* 이전 브라우저 저장은 더 이상 쓰지 않습니다. */
  }
}

export function readDb(): Db {
  return db ?? buildSeed();
}

export function updateDb(mutator: (current: Db) => void, _action?: string): Db {
  const actor = actorOf(session);
  if (!session || !db || !actor || !session.churchId || !canSeeChurch(actor, session.churchId)) go("/login");
  mutator(db!);
  syncReminders(db!);
  scheduleChurchWrite();
  emit();
  return db!;
}

export async function readActivityBoards(): Promise<{ churchId: string; churchName: string; entries: ActivityEntry[] }[]> {
  if (!session) return [];
  if (session.kind === "platform") {
    const token = await currentToken();
    const boards = [];
    for (const church of churches) {
      const entries = await dbGet<ActivityEntry[]>(`churches/${church.id}/data/activity`, token).catch(() => null);
      boards.push({ churchId: church.id, churchName: church.name, entries: Array.isArray(entries) ? entries : [] });
    }
    return boards;
  }
  if (!db || !session.churchId) return [];
  return [{ churchId: session.churchId, churchName: db.settings.churchName, entries: db.activity ?? [] }];
}

export function currentUser(): CurrentUser | null {
  if (!session) return null;
  return {
    id: session.accountId,
    email: session.email,
    roles: session.roles,
    kind: session.kind,
    churchId: session.churchId,
  };
}

export function listAccounts(): LocalAccount[] {
  return accounts.slice();
}

export function listChurches(): ChurchRow[] {
  const actor = actorOf(session);
  if (!actor) return [];
  return churches.filter((church) => canSeeChurch(actor, church.id));
}

export function requireMutation(capability: Capability): CurrentUser {
  const user = currentUser();
  if (!user) go("/login");
  if (!can(user!.roles, capability)) go("/denied");
  return user!;
}

export function mutationUser(capability: Capability): { ok: true; user: CurrentUser } | { ok: false; message: string } {
  const user = currentUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  if (!can(user.roles, capability)) return { ok: false, message: "권한이 없습니다." };
  return { ok: true, user };
}

export async function loginWithPassword(email: string, password: string): Promise<CurrentUser | null> {
  const remote = await firebaseSignIn(email, password).catch(() => null);
  if (!remote) return null;
  const next = sessionFromAuth(remote, isPlatformEmail(remote.email) ? "platform" : "church", null, []);
  const adopted = await adoptSession(next).catch((reason: unknown) => {
    error = reason instanceof DatabasePermissionError ? "데이터베이스 권한이 없습니다." : "로그인하지 못했습니다.";
    return false;
  });
  if (!adopted) {
    clearSession();
    return null;
  }
  emit();
  return currentUser();
}

export async function addChurchWithOperator(input: {
  name: string;
  email: string;
  password: string;
  roles: readonly string[];
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const actor = actorOf(session);
  if (!session || !actor || !canAddChurch(actor)) return { ok: false, code: "denied" };
  const name = input.name.trim().slice(0, 40);
  if (!name) return { ok: false, code: "name" };
  const roles = normalizeRoles(input.roles);
  if (roles.length === 0) return { ok: false, code: "roles" };
  if (isPlatformEmail(input.email)) return { ok: false, code: "taken" };
  const created = await firebaseSignUp(input.email, input.password);
  if (!created.ok) return { ok: false, code: created.taken ? "taken" : "email" };
  const id = makeChurchId();
  const churchDb = normalizeDb({
    settings: { churchName: name, backgroundColor: "#1b3a32", backgroundFile: null, overlay: "bottom" },
    people: [],
    songs: [],
    services: [],
    reminders: [],
    departments: [],
    attendance: [],
    supplies: [],
    activity: [],
    visits: [],
  });
  churchDb.visits = openVisit(churchDb.visits, session.email);
  const row: ChurchRow = { id, name, operatorEmail: created.session.email, createdAt: Date.now() };
  try {
    const token = await currentToken();
    await dbSet(`churches/${id}/meta`, { name, createdAt: row.createdAt }, token);
    await dbSet(`churches/${id}/data`, churchDb, token);
    await dbSet(`churches/${id}/members/${created.session.localId}`, memberBody(created.session.email, id, roles, null), token);
    await dbSet(`accounts/${created.session.localId}`, memberBody(created.session.email, id, roles, null), token);
    await dbSet(`churchIndex/${id}`, row, token);
    churches = [...churches.filter((item) => item.id !== id), row].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    error = "";
    emit();
    return { ok: true };
  } catch (reason) {
    await firebaseDeleteAccount(created.session.idToken).catch(() => undefined);
    error = reason instanceof DatabasePermissionError ? "데이터베이스 권한이 없습니다." : "교회를 저장하지 못했습니다.";
    emit();
    return { ok: false, code: "denied" };
  }
}

export async function enterChurch(id: string) {
  const actor = actorOf(session);
  if (!session || !actor || !canAddChurch(actor) || !canSeeChurch(actor, id)) go("/platform");
  session = { ...session!, churchId: id, roles: ALL_ROLES, kind: "platform" };
  persistSession();
  await loadChurch(id).catch(() => {
    error = "이 교회를 열지 못했습니다.";
  });
  if (db && session) updateDb((current) => {
    current.visits = openVisit(current.visits ?? [], session!.email);
  });
  emit();
}

export function leaveChurch() {
  if (!session || session.kind !== "platform") return;
  session = { ...session, churchId: null, roles: [] };
  db = null;
  accounts = [];
  files = new Map();
  persistSession();
  emit();
}

export async function registerChurchMember(email: string, password: string, roles: readonly Role[], personId: string | null) {
  const churchId = activeChurchId();
  if (!churchId) go("/login");
  requireMutation("mutate.admin");
  if (isPlatformEmail(email)) throw new Error("이미 있는 이메일입니다.");
  const created = await firebaseSignUp(email, password);
  if (!created.ok) throw new Error(created.taken ? "이미 있는 이메일입니다." : "이메일 형식을 확인해 주세요.");
  try {
    const token = await currentToken();
    const body = memberBody(created.session.email, churchId!, roles, personId);
    await dbSet(`accounts/${created.session.localId}`, body, token);
    await dbSet(`churches/${churchId}/members/${created.session.localId}`, body, token);
    upsertAccount({ id: created.session.localId, email: created.session.email, passwordHash: "firebase", roles: normalizeRoles(roles), personId });
    updateDb(() => undefined, `계정을 추가함: ${created.session.email}`);
    emit();
  } catch (reason) {
    await firebaseDeleteAccount(created.session.idToken).catch(() => undefined);
    throw reason;
  }
}

export async function updateChurchMember(
  id: string,
  input: { email: string; roles: readonly Role[]; personId: string | null; currentPassword?: string; password?: string },
) {
  const churchId = activeChurchId();
  if (!churchId) go("/login");
  requireMutation("mutate.admin");
  const current = accounts.find((account) => account.id === id);
  if (!current || !canSeeChurch(actorOf(session)!, churchId)) throw new Error("계정을 찾을 수 없습니다.");
  let email = input.email;
  if ((email !== current.email || input.password) && input.currentPassword) {
    const signed = await firebaseSignIn(current.email, input.currentPassword);
    if (!signed || signed.localId !== id) throw new Error("이메일 또는 비밀번호가 맞지 않습니다.");
    const updated = await firebaseUpdateAccount(signed.idToken, {
      email: email !== current.email ? email : undefined,
      password: input.password,
    });
    if (!updated.ok) throw new Error("계정을 저장하지 못했습니다.");
    email = updated.email || email;
  } else if (email !== current.email || input.password) {
    throw new Error("현재 비밀번호를 입력해 주세요.");
  }
  const body = memberBody(email, churchId, input.roles, input.personId);
  const authToken = await currentToken();
  await dbSet(`accounts/${id}`, body, authToken);
  await dbSet(`churches/${churchId}/members/${id}`, body, authToken);
  upsertAccount({ ...current, email, roles: normalizeRoles(input.roles), personId: input.personId });
  if (session?.accountId === id) {
    session = { ...session, email, roles: normalizeRoles(input.roles) };
    persistSession();
  }
  updateDb(() => undefined, `계정 권한을 바꿈: ${email}`);
  emit();
}

export async function removeLocalAccount(id: string) {
  const churchId = activeChurchId();
  if (!churchId) go("/login");
  requireMutation("mutate.admin");
  const authToken = await currentToken();
  await dbSet(`accounts/${id}`, null, authToken);
  await dbSet(`churches/${churchId}/members/${id}`, null, authToken);
  accounts = accounts.filter((account) => account.id !== id);
  updateDb(() => undefined, "계정을 삭제함");
  if (session?.accountId === id) clearSession();
  emit();
}

export function endLocalSession() {
  clearSession();
  emit();
}

export function storedBackgroundUrl(name: string | null | undefined): string | null {
  if (!name) return null;
  return files.get(name) ?? null;
}

export async function saveBackgroundFile(name: string, dataUrl: string) {
  const churchId = activeChurchId();
  if (!churchId) return;
  files.set(name, dataUrl);
  const authToken = await currentToken();
  await dbSet(`churches/${churchId}/files/${encodePath(name)}`, dataUrl, authToken);
}

export function clearBackgroundFile(name: string | null) {
  if (!name) return;
  files.delete(name);
  const churchId = activeChurchId();
  if (!churchId || !session) return;
  void currentToken().then((current) => dbSet(`churches/${churchId}/files/${encodePath(name)}`, null, current)).catch(() => undefined);
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

function memberBody(email: string, churchId: string, roles: readonly Role[], personId: string | null) {
  const body: RemoteAccount = { email, churchId, roles: rolesToMap(roles) };
  if (personId) body.personId = personId;
  return body;
}

function activeChurchId(): string | null {
  const actor = actorOf(session);
  if (!session?.churchId || !actor || !canSeeChurch(actor, session.churchId)) return null;
  return session.churchId;
}

function actorOf(value: Session | null): Actor | null {
  if (!value) return null;
  return { kind: value.kind, churchId: value.churchId };
}

async function adoptSession(next: Session): Promise<boolean> {
  const authToken = next.idToken;
  if (isPlatformEmail(next.email)) {
    const adminUid = await dbGet<string>("platform/adminUid", authToken).catch((reason: unknown) => {
      if (reason instanceof DatabasePermissionError) return "";
      throw reason;
    });
    if (adminUid && adminUid !== next.accountId) return false;
    if (!adminUid) {
      await dbSet("platform/adminUid", next.accountId, authToken).catch((reason: unknown) => {
        error = reason instanceof DatabasePermissionError ? "데이터베이스 권한이 없습니다." : "";
      });
    }
    session = { ...next, kind: "platform", roles: next.churchId ? ALL_ROLES : [], churchId: isChurchId(next.churchId || "") ? next.churchId : null };
    persistSession();
    churches = await loadChurchIndex(session.idToken);
    if (session.churchId) await loadChurch(session.churchId);
    return true;
  }
  const remote = await dbGet<RemoteAccount>(`accounts/${next.accountId}`, authToken).catch((reason: unknown) => {
    if (reason instanceof DatabasePermissionError) return null;
    throw reason;
  });
  const churchId = remote?.churchId || "";
  const roles = rolesFromMap(remote?.roles);
  if (!remote || !isChurchId(churchId) || roles.length === 0) return false;
  session = { ...next, kind: "church", churchId, roles, email: remote.email || next.email };
  persistSession();
  churches = [];
  await loadChurch(churchId);
  if (db && session) updateDb((current) => {
    current.visits = openVisit(current.visits ?? [], session!.email);
  });
  return Boolean(db);
}

async function loadChurchIndex(authToken: string): Promise<ChurchRow[]> {
  const index = await dbGet<Record<string, Partial<ChurchRow>>>("churchIndex", authToken).catch((reason: unknown) => {
    if (reason instanceof DatabasePermissionError) {
      error = "데이터베이스 권한이 없습니다.";
      return null;
    }
    throw reason;
  });
  if (!index || typeof index !== "object") return [];
  return Object.entries(index)
    .filter(([id]) => isChurchId(id))
    .map(([id, row]) => ({
      id,
      name: String(row?.name || "교회").slice(0, 40),
      operatorEmail: String(row?.operatorEmail || ""),
      createdAt: Number(row?.createdAt || 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

async function loadChurch(id: string) {
  const actor = actorOf(session);
  if (!session || !actor || !canSeeChurch(actor, id)) return;
  const authToken = await currentToken();
  const [data, members, storedFiles] = await Promise.all([
    dbGet<Db>(`churches/${id}/data`, authToken),
    dbGet<Record<string, RemoteAccount>>(`churches/${id}/members`, authToken),
    dbGet<Record<string, string>>(`churches/${id}/files`, authToken),
  ]);
  db = data ? normalizeDb(data) : null;
  if (db) syncReminders(db);
  accounts = Object.entries(members || {})
    .map(([memberId, member]) => toAccount(memberId, member))
    .filter((account): account is LocalAccount => account !== null);
  files = new Map(Object.entries(storedFiles || {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  if (session.kind === "church") {
    const mine = accounts.find((account) => account.id === session?.accountId);
    if (mine) session = { ...session, roles: mine.roles, email: mine.email };
  }
}

function toAccount(id: string, member: RemoteAccount | null): LocalAccount | null {
  if (!member) return null;
  const roles = rolesFromMap(member.roles);
  const email = String(member.email || "").trim().toLowerCase();
  if (!email || roles.length === 0) return null;
  return { id, email, passwordHash: "firebase", roles, personId: member.personId || null };
}

export function flushChurchWrite(): Promise<void> {
  return writeChain.then(() => undefined);
}

function scheduleChurchWrite() {
  const churchId = activeChurchId();
  if (!churchId || !db || !session) return;
  const payload = normalizeDb(structuredClone(db));
  const authToken = session.idToken;
  writing = true;
  writeChain = writeChain
    .then(async () => {
      await Promise.all(
        Object.entries(payload).map(([key, value]) => dbSet(`churches/${churchId}/data/${key}`, value, authToken)),
      );
      error = "";
    })
    .catch((reason: unknown) => {
      error = reason instanceof DatabasePermissionError ? "데이터베이스 권한이 없습니다." : "저장하지 못했습니다.";
      emit();
    })
    .finally(() => {
      writing = false;
    });
}

export function refreshChurchNow() {
  void refreshRemote();
}

const SIGNAL_ID = /^[A-Za-z0-9_-]{1,80}$/;
const SIGNAL_PATH = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

export async function readOutputRoom(serviceId: string): Promise<unknown> {
  if (!SIGNAL_ID.test(serviceId)) return null;
  const churchId = activeChurchId();
  if (!churchId || !session) return null;
  const token = await currentToken();
  return dbGet(`churches/${churchId}/data/outputSignals/${serviceId}`, token);
}

export async function patchOutputRoom(serviceId: string, path: string, value: unknown): Promise<void> {
  if (!SIGNAL_ID.test(serviceId) || !SIGNAL_PATH.test(path)) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const churchId = activeChurchId();
  if (!churchId || !session) return;
  const token = await currentToken();
  await dbPatch(`churches/${churchId}/data/outputSignals/${serviceId}/${path}`, value, token);
}

export async function clearOutputRoom(serviceId: string, path: string): Promise<void> {
  if (!SIGNAL_ID.test(serviceId) || !SIGNAL_PATH.test(path)) return;
  const churchId = activeChurchId();
  if (!churchId || !session) return;
  const token = await currentToken();
  await dbSet(`churches/${churchId}/data/outputSignals/${serviceId}/${path}`, null, token);
}

async function refreshRemote() {
  if (!session || writing) return;
  try {
    const authToken = await currentToken();
    if (session.kind === "platform") churches = await loadChurchIndex(authToken);
    if (session.churchId && canSeeChurch(actorOf(session)!, session.churchId)) await loadChurch(session.churchId);
    emit();
  } catch {
    /* 다음 주기에 다시 받습니다. */
  }
}

async function currentToken(): Promise<string> {
  if (!session) throw new Error("auth");
  if (session.expiresAt > Date.now() + 60_000 && session.idToken) return session.idToken;
  const refreshed = await refreshShared(session.refreshToken);
  if (!refreshed) throw new Error("auth");
  if (!session) throw new Error("auth");
  session = {
    ...session,
    accountId: refreshed.localId || session.accountId,
    email: emailFromIdToken(refreshed.idToken) || refreshed.email || session.email,
    idToken: refreshed.idToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
  };
  persistSession();
  return session.idToken;
}

async function refreshShared(refreshToken: string): Promise<FirebaseSession | null> {
  const run = async () => {
    const stored = readStoredSession();
    const memory = session && session.idToken && session.expiresAt > Date.now() + 60_000 ? session : null;
    const storedFresh = stored && stored.idToken && stored.expiresAt > Date.now() + 60_000 ? stored : null;
    const fresh = memory || storedFresh;
    if (fresh?.idToken) {
      return {
        localId: fresh.accountId,
        email: fresh.email,
        idToken: fresh.idToken,
        refreshToken: fresh.refreshToken,
        expiresAt: fresh.expiresAt,
      };
    }
    const token = stored?.refreshToken || refreshToken;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const refreshed = await firebaseRefresh(token);
        if (!refreshed) return null;
        if (session) {
          session = {
            ...session,
            accountId: refreshed.localId || session.accountId,
            email: emailFromIdToken(refreshed.idToken) || refreshed.email || session.email,
            idToken: refreshed.idToken,
            refreshToken: refreshed.refreshToken,
            expiresAt: refreshed.expiresAt,
          };
          persistSession();
        }
        return refreshed;
      } catch (reason) {
        lastError = reason;
        await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Failed to fetch");
  };
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request("church-token-refresh", run);
  return run();
}

function startPoll() {
  if (!pollTimer && typeof window !== "undefined") pollTimer = setInterval(() => void refreshRemote(), 4000);
}

function sessionFromAuth(remote: FirebaseSession, kind: "platform" | "church", churchId: string | null, roles: Role[]): Session {
  return {
    accountId: remote.localId,
    email: remote.email,
    roles,
    refreshToken: remote.refreshToken,
    idToken: remote.idToken,
    expiresAt: remote.expiresAt,
    kind,
    churchId,
  };
}

function upsertAccount(account: LocalAccount) {
  const index = accounts.findIndex((item) => item.id === account.id || item.email === account.email);
  if (index >= 0) accounts[index] = account;
  else accounts.push(account);
}

function persistSession() {
  if (typeof localStorage === "undefined" || !session) return;
  const stored = {
    accountId: session.accountId,
    email: session.email,
    refreshToken: session.refreshToken,
    idToken: session.idToken,
    expiresAt: session.expiresAt,
    kind: session.kind,
    churchId: session.churchId,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
}

function readStoredSession(): Session | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as Partial<Session> | null;
    if (!parsed?.refreshToken || !parsed.email || !parsed.accountId) return null;
    if (parsed.kind !== "platform" && parsed.kind !== "church") return null;
    return {
      accountId: parsed.accountId,
      email: parsed.email,
      roles: [],
      refreshToken: parsed.refreshToken,
      idToken: typeof parsed.idToken === "string" ? parsed.idToken : "",
      expiresAt: Number(parsed.expiresAt) || 0,
      kind: parsed.kind,
      churchId: parsed.churchId || null,
    };
  } catch {
    return null;
  }
}

function clearSession() {
  session = null;
  db = null;
  accounts = [];
  churches = [];
  files = new Map();
  if (typeof localStorage !== "undefined") localStorage.removeItem(SESSION_KEY);
}

function encodePath(name: string): string {
  return encodeURIComponent(name).replaceAll(".", "%2E");
}
