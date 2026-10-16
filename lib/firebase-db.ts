const DATABASE_URL = "https://live-interpret-db65e-default-rtdb.asia-southeast1.firebasedatabase.app";
const BANNED = new Set(["live-interpret", "cheil", "jifc"]);

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

async function request(relative: string, idToken: string, method: string, body?: unknown): Promise<unknown> {
  const path = churchPath(relative);
  const response = await fetch(`${DATABASE_URL}/${path}.json?auth=${encodeURIComponent(idToken)}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401 || response.status === 403) throw new DatabasePermissionError();
  const text = await response.text();
  if (!response.ok) throw new Error(`database ${response.status} ${text.replace(/\s+/g, " ").slice(0, 120)}`);
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

export function dbGet<T>(relative: string, idToken: string): Promise<T | null> {
  return request(relative, idToken, "GET") as Promise<T | null>;
}

export async function dbKeys(relative: string, idToken: string): Promise<string[]> {
  const path = churchPath(relative);
  const response = await fetch(`${DATABASE_URL}/${path}.json?auth=${encodeURIComponent(idToken)}&shallow=true`);
  if (response.status === 401 || response.status === 403) throw new DatabasePermissionError();
  const text = await response.text();
  if (!response.ok) throw new Error(`database ${response.status} ${text.replace(/\s+/g, " ").slice(0, 120)}`);
  if (!text || text === "null") return [];
  const data = JSON.parse(text) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.keys(data as Record<string, unknown>);
}

export function dbSet(relative: string, value: unknown, idToken: string): Promise<void> {
  return request(relative, idToken, "PUT", value).then(() => undefined);
}

export function dbPatch(relative: string, value: unknown, idToken: string): Promise<void> {
  return request(relative, idToken, "PATCH", value).then(() => undefined);
}
