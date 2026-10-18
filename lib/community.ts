/** 지역 커뮤니티 — 코니아(Konia) 형식: 모임·게시판·나의 교회·채팅·MY */

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

/** 게시판 분류 (코니아 태그 스타일). 예전 notice/question/share/promo 도 읽기 호환 */
export const BOARD_CATEGORIES = [
  { id: "free", label: "자유게시판" },
  { id: "faith", label: "신앙" },
  { id: "pray", label: "기도" },
  { id: "qna", label: "질문" },
  { id: "notice", label: "공지" },
  { id: "promo", label: "홍보" },
] as const;

export type BoardCategory = (typeof BOARD_CATEGORIES)[number]["id"];

/** @deprecated 예전 피드 분류 — board 로 매핑 */
export const POST_CATEGORIES = [
  { id: "notice", label: "공지" },
  { id: "question", label: "질문" },
  { id: "share", label: "나눔" },
  { id: "promo", label: "홍보" },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]["id"] | BoardCategory;

export const GROUP_CATEGORIES = [
  { id: "all", label: "전체", color: "#94a3b8", icon: "people" },
  { id: "faith", label: "신앙", color: "#a78bfa", icon: "church" },
  { id: "qt", label: "QT", color: "#60a5fa", icon: "book" },
  { id: "pray", label: "기도", color: "#fb923c", icon: "hands" },
  { id: "praise", label: "찬양", color: "#f472b6", icon: "music" },
  { id: "sports", label: "운동", color: "#4ade80", icon: "dumbbell" },
  { id: "dating", label: "연애", color: "#fb7185", icon: "heart" },
  { id: "jobs", label: "구인구직", color: "#818cf8", icon: "briefcase" },
  { id: "hobby", label: "취미", color: "#22d3ee", icon: "palette" },
  { id: "study", label: "스터디", color: "#c084fc", icon: "grad" },
  { id: "parenting", label: "육아", color: "#fdba74", icon: "baby" },
  { id: "food", label: "맛집", color: "#f87171", icon: "utensils" },
] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number]["id"];

export type CommunityMembership = {
  regionId: string;
  sido: string;
  district: string;
  churchId: string;
  updatedAt: number;
};

export type CommunityProfile = {
  uid: string;
  nickname: string;
  churchId: string;
  churchName: string;
  verified: boolean;
  verificationStatus: "none" | "pending" | "verified";
  updatedAt: number;
};

export type CommunityPost = {
  id: string;
  title: string;
  body: string;
  category: BoardCategory;
  authorUid: string;
  authorEmail: string;
  authorNick: string;
  churchId: string;
  churchName: string;
  verified: boolean;
  likes: number;
  views: number;
  commentCount: number;
  createdAt: number;
};

export type CommunityComment = {
  id: string;
  body: string;
  authorUid: string;
  authorEmail: string;
  authorNick: string;
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

export type CommunityGroup = {
  id: string;
  title: string;
  category: Exclude<GroupCategory, "all">;
  place: string;
  schedule: string;
  capacity: number;
  memberCount: number;
  authorUid: string;
  churchId: string;
  churchName: string;
  createdAt: number;
};

export type ChurchNotice = {
  id: string;
  title: string;
  body: string;
  authorUid: string;
  createdAt: number;
};

export type ChurchScheduleItem = {
  id: string;
  title: string;
  when: string;
  place: string;
  authorUid: string;
  createdAt: number;
};

export type ChatThread = {
  id: string;
  kind: "personal" | "group";
  title: string;
  peerUid: string;
  unread: boolean;
  updatedAt: number;
};

export type SortMode = "latest" | "popular";

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

const LEGACY_CATEGORY: Record<string, BoardCategory> = {
  notice: "notice",
  question: "qna",
  share: "free",
  promo: "promo",
  free: "free",
  faith: "faith",
  pray: "pray",
  qna: "qna",
};

export function isBoardCategory(value: string): value is BoardCategory {
  return BOARD_CATEGORIES.some((item) => item.id === value);
}

export function isPostCategory(value: string): boolean {
  return value in LEGACY_CATEGORY;
}

export function normalizeBoardCategory(value: string): BoardCategory | null {
  return LEGACY_CATEGORY[value] ?? null;
}

export function categoryLabel(category: string): string {
  const board = BOARD_CATEGORIES.find((item) => item.id === category);
  if (board) return board.label;
  return POST_CATEGORIES.find((item) => item.id === category)?.label ?? "글";
}

export function isGroupCategory(value: string): value is Exclude<GroupCategory, "all"> {
  return GROUP_CATEGORIES.some((item) => item.id === value && item.id !== "all");
}

export function groupCategoryMeta(id: string) {
  return GROUP_CATEGORIES.find((item) => item.id === id) ?? GROUP_CATEGORIES[0];
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

export function cleanNickname(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 24);
}

export function cleanGroupTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 60);
}

export function cleanShort(value: string, max = 80): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function newCommunityId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nicknameFromEmail(email: string): string {
  const local = String(email || "")
    .split("@")[0]
    ?.trim();
  return cleanNickname(local || "익명") || "익명";
}

export function formatCommunityWhen(ms: number): string {
  if (!ms) return "";
  try {
    const d = new Date(ms);
    const ampm = d.getHours() < 12 ? "오전" : "오후";
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${String(h).padStart(2, "0")}:${m}`;
  } catch {
    return "";
  }
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function postsFromMap(raw: unknown): CommunityPost[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list: CommunityPost[] = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const category = normalizeBoardCategory(String(row.category || ""));
    if (!category) continue;
    const commentsRaw = row.comments;
    let commentCount = num(row.commentCount);
    if (!commentCount && commentsRaw && typeof commentsRaw === "object" && !Array.isArray(commentsRaw)) {
      commentCount = Object.keys(commentsRaw as object).length;
    }
    list.push({
      id,
      title: cleanPostTitle(String(row.title || "")),
      body: cleanPostBody(String(row.body || "")),
      category,
      authorUid: String(row.authorUid || "").slice(0, 128),
      authorEmail: String(row.authorEmail || "").toLowerCase().slice(0, 120),
      authorNick: cleanNickname(String(row.authorNick || row.authorEmail || "익명")) || "익명",
      churchId: String(row.churchId || "").slice(0, 64),
      churchName: cleanShort(String(row.churchName || ""), 40),
      verified: Boolean(row.verified),
      likes: num(row.likes),
      views: num(row.views),
      commentCount,
      createdAt: num(row.createdAt),
    });
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function sortPosts(posts: CommunityPost[], mode: SortMode): CommunityPost[] {
  const copy = [...posts];
  if (mode === "popular") {
    return copy.sort((a, b) => b.likes - a.likes || b.views - a.views || b.createdAt - a.createdAt);
  }
  return copy.sort((a, b) => b.createdAt - a.createdAt);
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
      authorNick: cleanNickname(String(row.authorNick || row.authorEmail || "익명")) || "익명",
      createdAt: num(row.createdAt),
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
      createdAt: num(row.createdAt),
    });
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function groupsFromMap(raw: unknown): CommunityGroup[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list: CommunityGroup[] = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const category = String(row.category || "");
    if (!isGroupCategory(category)) continue;
    const members = row.members;
    let memberCount = num(row.memberCount);
    if (!memberCount && members && typeof members === "object" && !Array.isArray(members)) {
      memberCount = Object.keys(members as object).length;
    }
    list.push({
      id,
      title: cleanGroupTitle(String(row.title || "")),
      category,
      place: cleanShort(String(row.place || ""), 40),
      schedule: cleanShort(String(row.schedule || ""), 40),
      capacity: Math.max(1, Math.min(200, num(row.capacity) || 10)),
      memberCount: Math.max(0, memberCount),
      authorUid: String(row.authorUid || "").slice(0, 128),
      churchId: String(row.churchId || "").slice(0, 64),
      churchName: cleanShort(String(row.churchName || ""), 40),
      createdAt: num(row.createdAt),
    });
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function sortGroups(groups: CommunityGroup[], mode: SortMode): CommunityGroup[] {
  const copy = [...groups];
  if (mode === "popular") {
    return copy.sort((a, b) => b.memberCount - a.memberCount || b.createdAt - a.createdAt);
  }
  return copy.sort((a, b) => b.createdAt - a.createdAt);
}

export function noticesFromMap(raw: unknown): ChurchNotice[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list: ChurchNotice[] = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    list.push({
      id,
      title: cleanPostTitle(String(row.title || "")),
      body: cleanPostBody(String(row.body || "")),
      authorUid: String(row.authorUid || "").slice(0, 128),
      createdAt: num(row.createdAt),
    });
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function scheduleFromMap(raw: unknown): ChurchScheduleItem[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list: ChurchScheduleItem[] = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    list.push({
      id,
      title: cleanPostTitle(String(row.title || "")),
      when: cleanShort(String(row.when || ""), 60),
      place: cleanShort(String(row.place || ""), 40),
      authorUid: String(row.authorUid || "").slice(0, 128),
      createdAt: num(row.createdAt),
    });
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function chatsFromMap(raw: unknown): ChatThread[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list: ChatThread[] = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const kind = String(row.kind || "") === "group" ? "group" : "personal";
    list.push({
      id,
      kind,
      title: cleanShort(String(row.title || "채팅"), 40),
      peerUid: String(row.peerUid || "").slice(0, 128),
      unread: Boolean(row.unread),
      updatedAt: num(row.updatedAt),
    });
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
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
    updatedAt: num(row.updatedAt),
  };
}

export function profileFromRaw(raw: unknown, uid: string): CommunityProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const statusRaw = String(row.verificationStatus || "");
  const verificationStatus =
    statusRaw === "pending" || statusRaw === "verified" ? statusRaw : row.verified ? "verified" : "none";
  return {
    uid,
    nickname: cleanNickname(String(row.nickname || "")) || "익명",
    churchId: String(row.churchId || "").slice(0, 64),
    churchName: cleanShort(String(row.churchName || ""), 40),
    verified: verificationStatus === "verified" || Boolean(row.verified),
    verificationStatus,
    updatedAt: num(row.updatedAt),
  };
}

export function bookmarkKeysFromMap(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.keys(raw as Record<string, unknown>);
}

export function postBookmarkKey(regionId: string, postId: string): string {
  return `${regionId}__${postId}`.slice(0, 120);
}
