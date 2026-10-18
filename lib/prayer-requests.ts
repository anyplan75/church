/** 성도 기도제목 — Firebase 경로용 순수 도우미 (비밀값 없음). */

export const PRAYER_STATUSES = ["new", "read", "prayed"] as const;
export type PrayerStatus = (typeof PRAYER_STATUSES)[number];

export type PrayerRequest = {
  id: string;
  authorUid: string;
  authorEmail: string;
  authorName: string;
  text: string;
  serviceId: string;
  serviceTitle: string;
  createdAt: number;
  updatedAt: number;
  status: PrayerStatus;
};

const MAX_TEXT = 800;
const MAX_NAME = 40;
const MAX_TITLE = 80;
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

export function isPrayerStatus(value: unknown): value is PrayerStatus {
  return typeof value === "string" && (PRAYER_STATUSES as readonly string[]).includes(value);
}

export function prayerRequestId(seed = ""): string {
  const base = String(seed || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const id = `pr_${base}${rand}`.slice(0, 48);
  return ID_RE.test(id) ? id : `pr_${rand}`.slice(0, 48);
}

export function cleanPrayerText(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
}

export function prayerCreateError(text: string): string | null {
  const body = cleanPrayerText(text);
  if (body.length < 2) return "기도제목을 두 글자 이상 적어 주세요.";
  if (body.length > MAX_TEXT) return "기도제목이 너무 깁니다.";
  return null;
}

export function buildPrayerRequest(input: {
  id?: string;
  authorUid: string;
  authorEmail: string;
  authorName?: string;
  text: string;
  serviceId?: string;
  serviceTitle?: string;
  createdAt?: number;
  status?: PrayerStatus;
}): PrayerRequest {
  const text = cleanPrayerText(input.text);
  const err = prayerCreateError(text);
  if (err) throw new Error(err);
  const uid = String(input.authorUid || "").trim();
  if (!uid) throw new Error("작성자 정보가 없습니다.");
  const now = input.createdAt && Number.isFinite(input.createdAt) ? Number(input.createdAt) : Date.now();
  return {
    id: input.id && ID_RE.test(input.id) ? input.id : prayerRequestId(uid.slice(0, 8)),
    authorUid: uid,
    authorEmail: String(input.authorEmail || "")
      .trim()
      .toLowerCase()
      .slice(0, 120),
    authorName: String(input.authorName || "")
      .trim()
      .slice(0, MAX_NAME),
    text,
    serviceId: String(input.serviceId || "")
      .trim()
      .slice(0, 64),
    serviceTitle: String(input.serviceTitle || "")
      .trim()
      .slice(0, MAX_TITLE),
    createdAt: now,
    updatedAt: now,
    status: input.status && isPrayerStatus(input.status) ? input.status : "new",
  };
}

export function prayerFromRaw(id: string, raw: unknown): PrayerRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const text = cleanPrayerText(row.text);
  if (text.length < 2) return null;
  const authorUid = String(row.authorUid || "").trim();
  if (!authorUid) return null;
  const status = isPrayerStatus(row.status) ? row.status : "new";
  const createdAt = Number(row.createdAt) || 0;
  const updatedAt = Number(row.updatedAt) || createdAt;
  const key = ID_RE.test(id) ? id : String(row.id || "").trim();
  if (!ID_RE.test(key)) return null;
  return {
    id: key,
    authorUid,
    authorEmail: String(row.authorEmail || "")
      .trim()
      .toLowerCase()
      .slice(0, 120),
    authorName: String(row.authorName || "")
      .trim()
      .slice(0, MAX_NAME),
    text,
    serviceId: String(row.serviceId || "")
      .trim()
      .slice(0, 64),
    serviceTitle: String(row.serviceTitle || "")
      .trim()
      .slice(0, MAX_TITLE),
    createdAt,
    updatedAt,
    status,
  };
}

export function prayersFromMap(raw: unknown): PrayerRequest[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list: PrayerRequest[] = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const row = prayerFromRaw(id, value);
    if (row) list.push(row);
  }
  return list.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

/** 목회자·운영자가 받은 기도함에서 상태를 바꿀 수 있는지. */
export function canManagePrayers(roles: readonly string[]): boolean {
  return roles.some((role) => role === "admin" || role === "prepare" || role === "run");
}

export function prayerStatusLabel(status: PrayerStatus): string {
  if (status === "read") return "확인함";
  if (status === "prayed") return "기도함";
  return "새 기도";
}

export function prayerPath(churchId: string, requestId = ""): string {
  const church = String(churchId || "").trim();
  if (!church) throw new Error("교회 정보가 없습니다.");
  const base = `churches/${church}/prayerRequests`;
  if (!requestId) return base;
  if (!ID_RE.test(requestId)) throw new Error("기도제목 id가 올바르지 않습니다.");
  return `${base}/${requestId}`;
}
