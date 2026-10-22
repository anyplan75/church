import { parseAccountGender, parseAccountPhone } from "@/account/profile";

/**
 * 카카오와 네이버 공식 로그인 주소입니다.
 * 콜백은 공개 주소 두 곳으로만 고정합니다. 다른 콜백 경로는 만들지 않습니다.
 * 열쇠가 없으면 주소를 만들지 않습니다.
 */

export const KAKAO_REDIRECT_URI = "https://modl-jeju.vercel.app/api/auth/callback/kakao";
export const NAVER_REDIRECT_URI = "https://modl-jeju.vercel.app/api/auth/callback/naver";

export const KAKAO_NOT_CONFIGURED =
  "카카오 로그인 열쇠가 아직 없습니다. KAKAO_REST_API_KEY 를 넣은 뒤에 다시 시도해 주세요.";
export const NAVER_NOT_CONFIGURED =
  "네이버 로그인 열쇠가 아직 없습니다. NAVER_CLIENT_ID 와 NAVER_CLIENT_SECRET 을 넣은 뒤에 다시 시도해 주세요.";

const KAKAO_AUTHORIZE = "https://kauth.kakao.com/oauth/authorize";
const NAVER_AUTHORIZE = "https://nid.naver.com/oauth2.0/authorize";

export type OauthProvider = "kakao" | "naver";

export type OauthProfile = {
  provider: OauthProvider;
  providerUserId: string;
  name: string;
  email: string | null;
  phone: string | null;
  gender: "male" | "female" | null;
};

function envValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function kakaoConfigured(): boolean {
  return Boolean(envValue("KAKAO_REST_API_KEY"));
}

export function naverConfigured(): boolean {
  return Boolean(envValue("NAVER_CLIENT_ID") && envValue("NAVER_CLIENT_SECRET"));
}

export function kakaoClientSecret(): string {
  return envValue("KAKAO_CLIENT_SECRET");
}

export function kakaoAuthorizeUrl(state: string): string | null {
  const clientId = envValue("KAKAO_REST_API_KEY");
  if (!clientId || !state) return null;
  const url = new URL(KAKAO_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", KAKAO_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "profile_nickname,account_email,phone_number,gender");
  return url.toString();
}

export function naverAuthorizeUrl(state: string): string | null {
  const clientId = envValue("NAVER_CLIENT_ID");
  if (!clientId || !envValue("NAVER_CLIENT_SECRET") || !state) return null;
  const url = new URL(NAVER_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", NAVER_REDIRECT_URI);
  url.searchParams.set("state", state);
  return url.toString();
}

function cleanName(value: string, fallback: string): string {
  const name = value.replace(/\s+/g, " ").trim().slice(0, 40);
  return name || fallback;
}

function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email.includes("@") || /\s/.test(email)) return null;
  return email;
}

export function parseKakaoProfile(payload: unknown): OauthProfile | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as {
    id?: unknown;
    kakao_account?: { email?: unknown; phone_number?: unknown; gender?: unknown; profile?: { nickname?: unknown } };
  };
  if (typeof row.id !== "number" && typeof row.id !== "string") return null;
  const providerUserId = String(row.id).trim();
  if (!providerUserId) return null;
  const nickname = row.kakao_account?.profile?.nickname;
  return {
    provider: "kakao",
    providerUserId,
    name: cleanName(typeof nickname === "string" ? nickname : "", "카카오"),
    email: cleanEmail(row.kakao_account?.email),
    phone: parseAccountPhone(row.kakao_account?.phone_number),
    gender: parseAccountGender(row.kakao_account?.gender),
  };
}

export function parseNaverProfile(payload: unknown): OauthProfile | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as {
    resultcode?: unknown;
    response?: { id?: unknown; email?: unknown; name?: unknown; nickname?: unknown; mobile?: unknown; gender?: unknown };
  };
  if (row.resultcode !== "00" || !row.response) return null;
  if (typeof row.response.id !== "string" || !row.response.id.trim()) return null;
  const name = typeof row.response.name === "string" ? row.response.name : "";
  const nickname = typeof row.response.nickname === "string" ? row.response.nickname : "";
  return {
    provider: "naver",
    providerUserId: row.response.id.trim(),
    name: cleanName(name || nickname, "네이버"),
    email: cleanEmail(row.response.email),
    phone: parseAccountPhone(row.response.mobile),
    gender: parseAccountGender(row.response.gender),
  };
}
