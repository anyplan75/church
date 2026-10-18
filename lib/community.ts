/** 지역 커뮤니티 — 시/도·시군구 묶음, 게시글·댓글·자료실·홍보 */

export const COMMUNITY_SIDO = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
] as const;

export type CommunitySido = (typeof COMMUNITY_SIDO)[number];

export const POST_CATEGORIES = [
  { id: "notice", label: "공지" },
  { id: "question", label: "질문" },
  { id: "share", label: "나눔" },
  { id: "promo", label: "홍보" },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]["id"];

export type CommunityMembership = {
  regionId: string;
  sido: string;
  district: string;
  churchId: string;
  updatedAt: number;
};

export type CommunityPost = {
  id: string;
  title: string;
  body: string;
  category: PostCategory;
  authorUid: string;
  authorEmail: string;
  churchId: string;
  createdAt: number;
};

export type CommunityComment = {
  id: string;
  body: string;
  authorUid: string;
  authorEmail: string;
  createdAt: number;
};

export type CommunityResource = {
  id: string;
  title: string;
  url: string;
  note: string;
  authorUid: string;
  authorEmail: string;
  churchId: string;
  createdAt: number;
};

export function isCommunitySido(value: string): value is CommunitySido {
  return (COMMUNITY_SIDO as readonly string[]).includes(value);
}

/** 지역 키: 시/도 + 선택 시군구. 한글·숫자·하이픈만. */
export function regionIdFrom(sido: string, district = ""): string {
  const s = sido.trim();
  const d = district.replace(/\s+/g, " ").trim();
  if (!isCommunitySido(s)) return "";
  const raw = d ? `${s}-${d}` : s;
  return raw
    .replace(/[^0-9A-Za-z가-힣\-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

export function regionLabel(sido: string, district = ""): string {
  const s = sido.trim();
  const d = district.replace(/\s+/g, " ").trim();
  if (!s) return "";
  return d ? `${s} ${d}` : s;
}

export function isPostCategory(value: string): value is PostCategory {
  return POST_CATEGORIES.some((item) => item.id === value);
}

export function categoryLabel(category: string): string {
  return POST_CATEGORIES.find((item) => item.id === category)?.label ?? "글";
}

export function cleanPostTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function cleanPostBody(value: string): string {
  return value.replace(/\r\n/g, "\n").trim().slice(0, 4000);
}

export function cleanCommentBody(value: string): string {
  return value.replace(/\r\n/g, "\n").trim().slice(0, 1000);
}

export function cleanResourceTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function cleanResourceUrl(value: string): string {
  const url = value.trim().slice(0, 500);
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[\w.-]+\.[\w.-]+/.test(url)) return `https://${url}`;
  return "";
}

export function cleanResourceNote(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

export function cleanDistrict(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 24);
}

export function newCommunityId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function postsFromMap(raw: unknown): CommunityPost[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list: CommunityPost[] = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const category = String(row.category || "");
    if (!isPostCategory(category)) continue;
    list.push({
      id,
      title: cleanPostTitle(String(row.title || "")),
      body: cleanPostBody(String(row.body || "")),
      category,
      authorUid: String(row.authorUid || "").slice(0, 128),
      authorEmail: String(row.authorEmail || "").toLowerCase().slice(0, 120),
      churchId: String(row.churchId || "").slice(0, 64),
      createdAt: typeof row.createdAt === "number" ? row.createdAt : 0,
    });
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function commentsFromMap(raw: unknown): CommunityComment[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list: CommunityComment[] = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    list.push({
      id,
      body: cleanCommentBody(String(row.body || "")),
      authorUid: String(row.authorUid || "").slice(0, 128),
      authorEmail: String(row.authorEmail || "").toLowerCase().slice(0, 120),
      createdAt: typeof row.createdAt === "number" ? row.createdAt : 0,
    });
  }
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export function resourcesFromMap(raw: unknown): CommunityResource[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list: CommunityResource[] = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    list.push({
      id,
      title: cleanResourceTitle(String(row.title || "")),
      url: cleanResourceUrl(String(row.url || "")),
      note: cleanResourceNote(String(row.note || "")),
      authorUid: String(row.authorUid || "").slice(0, 128),
      authorEmail: String(row.authorEmail || "").toLowerCase().slice(0, 120),
      churchId: String(row.churchId || "").slice(0, 64),
      createdAt: typeof row.createdAt === "number" ? row.createdAt : 0,
    });
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function membershipFromRaw(raw: unknown): CommunityMembership | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const regionId = String(row.regionId || "").slice(0, 48);
  const sido = String(row.sido || "").trim();
  if (!regionId || !isCommunitySido(sido)) return null;
  return {
    regionId,
    sido,
    district: cleanDistrict(String(row.district || "")),
    churchId: String(row.churchId || "").slice(0, 64),
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : 0,
  };
}
