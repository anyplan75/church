const BANNED = new Set(["live-interpret", "cheil", "jifc"]);

/** 정적보내기에 심어진 RTDB URL 이 있는지(값은 노출하지 않음). */
export function firebaseDatabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim());
}

function databaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim() || "";
  if (!url) throw new Error("NEXT_PUBLIC_FIREBASE_DATABASE_URL이 없습니다. .env.local을 확인하세요.");
  return url.replace(/\/+$/, "");
}

export class DatabasePermissionError extends Error {
  constructor() {
    super("permission");
    this.name = "DatabasePermissionError";
  }
}

export function churchPath(relative: string): string {
  const clean = String(relative || "").replace(/^\/+|\/+$/g, "");
  const body = clean === "church" ? "" : clean.startsWith("church/") ? clean.slice("church/".length) : clean;
  if (!body) throw new Error("빈 Firebase 경로");
  const parts = body.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) throw new Error("잘못된 Firebase 경로");
  if (parts.some((part) => BANNED.has(part.toLowerCase()))) {
    throw new Error("live-interpret, cheil, jifc 경로는 쓸 수 없습니다.");
  }
  return ["church", ...parts].join("/");
}

const DB_TIMEOUT_MS = 15_000;

/** 공개 읽기(비로그인)는 auth 없이, 쓰기는 토큰이 필요합니다. */
function withAuthQuery(pathUrl: string, idToken: string, extra = ""): string {
  const clean = extra.replace(/^\?/, "").replace(/^&/, "");
  if (idToken) {
    const auth = `auth=${encodeURIComponent(idToken)}`;
    return clean ? `${pathUrl}?${auth}&${clean}` : `${pathUrl}?${auth}`;
  }
  return clean ? `${pathUrl}?${clean}` : pathUrl;
}

async function request(relative: string, idToken: string, method: string, body?: unknown): Promise<unknown> {
  const path = churchPath(relative);
  if ((method === "PUT" || method === "PATCH" || method === "DELETE") && !idToken) {
    throw new DatabasePermissionError();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DB_TIMEOUT_MS);
  try {
    const response = await fetch(withAuthQuery(`${databaseUrl()}/${path}.json`, idToken), {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) throw new DatabasePermissionError();
    const text = await response.text();
    if (!response.ok) throw new Error(`database ${response.status} ${text.replace(/\s+/g, " ").slice(0, 120)}`);
    if (!text) return null;
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

export function dbGet<T>(relative: string, idToken: string): Promise<T | null> {
  return request(relative, idToken, "GET") as Promise<T | null>;
}

export async function dbKeys(relative: string, idToken: string): Promise<string[]> {
  const path = churchPath(relative);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DB_TIMEOUT_MS);
  try {
    const response = await fetch(withAuthQuery(`${databaseUrl()}/${path}.json`, idToken, "shallow=true"), {
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) throw new DatabasePermissionError();
    const text = await response.text();
    if (!response.ok) throw new Error(`database ${response.status} ${text.replace(/\s+/g, " ").slice(0, 120)}`);
    if (!text || text === "null") return [];
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    return Object.keys(data as Record<string, unknown>);
  } finally {
    clearTimeout(timer);
  }
}

/** 시험·문서용: 공개 GET URL에 auth 를 붙이지 않는지 확인합니다. */
export function buildDatabaseUrl(pathJson: string, idToken: string, extra = ""): string {
  return withAuthQuery(pathJson, idToken, extra);
}

export function dbSet(relative: string, value: unknown, idToken: string): Promise<void> {
  return request(relative, idToken, "PUT", value).then(() => undefined);
}

export function dbPatch(relative: string, value: unknown, idToken: string): Promise<void> {
  return request(relative, idToken, "PATCH", value).then(() => undefined);
}

export function dbRemove(relative: string, idToken: string): Promise<void> {
  return request(relative, idToken, "DELETE").then(() => undefined);
}
