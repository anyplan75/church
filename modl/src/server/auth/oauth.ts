/**
 * 카카오와 네이버 로그인을 끝내는 서버 흐름입니다.
 * 열쇠가 없으면 세션을 만들지 않습니다.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "@/server/auth/password";
import { hashToken, openSession } from "@/server/auth/session";
import { parseAccountGender, parseAccountPhone } from "@/account/profile";
import {
  KAKAO_NOT_CONFIGURED,
  KAKAO_REDIRECT_URI,
  NAVER_NOT_CONFIGURED,
  NAVER_REDIRECT_URI,
  kakaoClientSecret,
  kakaoConfigured,
  naverConfigured,
  parseKakaoProfile,
  parseNaverProfile,
  type OauthProfile,
  type OauthProvider,
} from "@/server/auth/oauth-config";
import { oauthIdentities, oauthPending, users } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";

const STATE_COOKIE = "modl_oauth_state";
const PENDING_COOKIE = "modl_oauth_pending";
const KAKAO_TOKEN = "https://kauth.kakao.com/oauth/token";
const KAKAO_PROFILE = "https://kapi.kakao.com/v2/user/me";
const NAVER_TOKEN = "https://nid.naver.com/oauth2.0/token";
const NAVER_PROFILE = "https://openapi.naver.com/v1/nid/me";

export {
  KAKAO_NOT_CONFIGURED,
  KAKAO_REDIRECT_URI,
  NAVER_NOT_CONFIGURED,
  NAVER_REDIRECT_URI,
  kakaoAuthorizeUrl,
  naverAuthorizeUrl,
  type OauthProvider,
} from "@/server/auth/oauth-config";

export function newOauthState(): string {
  return randomBytes(16).toString("base64url");
}

export async function rememberOauthState(provider: OauthProvider, state: string): Promise<void> {
  const jar = await cookies();
  jar.set(STATE_COOKIE, `${provider}.${state}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });
}

function sameText(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function takeOauthState(provider: OauthProvider, state: string | null): Promise<boolean> {
  const jar = await cookies();
  const saved = jar.get(STATE_COOKIE)?.value ?? "";
  jar.delete(STATE_COOKIE);
  if (!state || !saved.startsWith(`${provider}.`)) return false;
  return sameText(saved.slice(provider.length + 1), state);
}

function accountError(message: string): string {
  return `/account?error=${encodeURIComponent(message)}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function postForm(url: string, body: URLSearchParams): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  return readJson(response);
}

export async function fetchKakaoProfile(code: string): Promise<OauthProfile | null> {
  const clientId = process.env.KAKAO_REST_API_KEY?.trim() ?? "";
  if (!clientId) return null;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: KAKAO_REDIRECT_URI,
    code,
  });
  const secret = kakaoClientSecret();
  if (secret) body.set("client_secret", secret);
  const token = await postForm(KAKAO_TOKEN, body);
  const access = token && typeof token === "object" ? (token as { access_token?: unknown }).access_token : null;
  if (typeof access !== "string" || !access) return null;
  const response = await fetch(KAKAO_PROFILE, {
    headers: { authorization: `Bearer ${access}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  return parseKakaoProfile(await readJson(response));
}

export async function fetchNaverProfile(code: string, state: string): Promise<OauthProfile | null> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  const url = new URL(NAVER_TOKEN);
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("code", code);
  url.searchParams.set("state", state);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) return null;
  const token = await readJson(response);
  const access = token && typeof token === "object" ? (token as { access_token?: unknown }).access_token : null;
  if (typeof access !== "string" || !access) return null;
  const profile = await fetch(NAVER_PROFILE, {
    headers: { authorization: `Bearer ${access}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!profile.ok) return null;
  return parseNaverProfile(await readJson(profile));
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const current = error as { code?: unknown; cause?: unknown };
  if (current.code === "23505") return true;
  return isUniqueViolation(current.cause);
}

function syntheticEmail(profile: OauthProfile): string {
  const id = createHash("sha256").update(profile.providerUserId).digest("hex").slice(0, 24);
  return `${profile.provider}.${id}@oauth.modl.invalid`;
}

async function safeName(name: string, fallback: string): Promise<string> {
  try {
    await assertTextsAllowed(name);
    return name;
  } catch {
    return fallback;
  }
}

/** 제공자 번호가 있으면 그 계정으로 들어가고, 없으면 계정을 새로 만듭니다. */
export async function signInWithProfile(profile: OauthProfile): Promise<void> {
  await ensureDatabase();
  const db = getDb();
  const [linked] = await db
    .select({ userId: oauthIdentities.userId })
    .from(oauthIdentities)
    .where(and(eq(oauthIdentities.provider, profile.provider), eq(oauthIdentities.providerUserId, profile.providerUserId)))
    .limit(1);
  if (linked) {
    await openSession(linked.userId);
    return;
  }
  if (!profile.phone || !profile.gender) {
    throw new Error("성별과 전화번호가 있어야 가입할 수 있습니다.");
  }

  const fallback = profile.provider === "kakao" ? "카카오" : "네이버";
  const name = await safeName(profile.name, fallback);
  const passwordHash = hashPassword(randomBytes(32).toString("hex"));
  const emails = profile.email ? [profile.email, syntheticEmail(profile)] : [syntheticEmail(profile)];
  const phone = profile.phone;
  const gender = profile.gender;

  for (const email of emails) {
    try {
      const userId = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({ name, email, passwordHash, phone, gender })
          .returning({ id: users.id });
        if (!created) throw new Error("계정을 만들지 못했습니다.");
        await tx.insert(oauthIdentities).values({
          userId: created.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        });
        return created.id;
      });
      await openSession(userId);
      return;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const [again] = await db
        .select({ userId: oauthIdentities.userId })
        .from(oauthIdentities)
        .where(and(eq(oauthIdentities.provider, profile.provider), eq(oauthIdentities.providerUserId, profile.providerUserId)))
        .limit(1);
      if (again) {
        await openSession(again.userId);
        return;
      }
    }
  }
  throw new Error("로그인 계정을 만들지 못했습니다.");
}

export async function finishOauthLogin(input: {
  provider: OauthProvider;
  code: string | null;
  state: string | null;
  providerError: string | null;
}): Promise<string> {
  const missing = input.provider === "kakao" ? KAKAO_NOT_CONFIGURED : NAVER_NOT_CONFIGURED;
  const configured = input.provider === "kakao" ? kakaoConfigured() : naverConfigured();
  const failed = input.provider === "kakao" ? "카카오 로그인을 끝내지 못했습니다." : "네이버 로그인을 끝내지 못했습니다.";
  if (!configured) return accountError(missing);
  const stateOk = await takeOauthState(input.provider, input.state);
  if (input.providerError || !input.code || !input.state || !stateOk) return accountError(failed);
  try {
    const profile = input.provider === "kakao" ? await fetchKakaoProfile(input.code) : await fetchNaverProfile(input.code, input.state);
    if (!profile) return accountError(failed);
    const linked = await linkedUserId(profile);
    if (linked) {
      await openSession(linked);
      return "/";
    }
    if (!profile.phone || !profile.gender) {
      await holdIncompleteSignup(profile);
      return "/account?need=profile";
    }
    await signInWithProfile(profile);
    return "/";
  } catch {
    return accountError(failed);
  }
}

async function linkedUserId(profile: OauthProfile): Promise<string | null> {
  await ensureDatabase();
  const [linked] = await getDb()
    .select({ userId: oauthIdentities.userId })
    .from(oauthIdentities)
    .where(and(eq(oauthIdentities.provider, profile.provider), eq(oauthIdentities.providerUserId, profile.providerUserId)))
    .limit(1);
  return linked?.userId ?? null;
}

export type PendingSignup = {
  needPhone: boolean;
  needGender: boolean;
};

/** 성별이나 전화번호가 없으면 계정을 만들지 않고, 빠진 칸만 나중에 받습니다. */
export async function holdIncompleteSignup(profile: OauthProfile): Promise<void> {
  await ensureDatabase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const db = getDb();
  await db.delete(oauthPending).where(and(eq(oauthPending.provider, profile.provider), eq(oauthPending.providerUserId, profile.providerUserId)));
  await db.insert(oauthPending).values({
    tokenHash: hashToken(token),
    provider: profile.provider,
    providerUserId: profile.providerUserId,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    gender: profile.gender,
    expiresAt,
  });
  const jar = await cookies();
  jar.set(PENDING_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function loadPendingSignup(): Promise<PendingSignup | null> {
  await ensureDatabase();
  const jar = await cookies();
  const token = jar.get(PENDING_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb().select().from(oauthPending).where(eq(oauthPending.tokenHash, hashToken(token))).limit(1);
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row) await getDb().delete(oauthPending).where(eq(oauthPending.id, row.id));
    jar.delete(PENDING_COOKIE);
    return null;
  }
  return { needPhone: !row.phone, needGender: !row.gender };
}

/** 빠진 성별·전화번호만 받아 가입을 끝냅니다. 둘 다 없으면 계정을 만들지 않습니다. */
export async function completePendingSignup(input: { phone: string; gender: string }): Promise<void> {
  await ensureDatabase();
  const jar = await cookies();
  const token = jar.get(PENDING_COOKIE)?.value;
  if (!token) throw new Error("가입을 이어 갈 수 없습니다. 카카오 또는 네이버 로그인을 다시 눌러 주세요.");
  const db = getDb();
  const [row] = await db.select().from(oauthPending).where(eq(oauthPending.tokenHash, hashToken(token))).limit(1);
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    jar.delete(PENDING_COOKIE);
    throw new Error("가입 시간이 지났습니다. 카카오 또는 네이버 로그인을 다시 눌러 주세요.");
  }
  const phone = row.phone ?? parseAccountPhone(input.phone);
  const gender = parseAccountGender(row.gender) ?? parseAccountGender(input.gender);
  if (!phone || !gender) throw new Error("성별과 전화번호를 적어 주세요.");
  await signInWithProfile({
    provider: row.provider === "naver" ? "naver" : "kakao",
    providerUserId: row.providerUserId,
    name: row.name,
    email: row.email,
    phone,
    gender,
  });
  await db.delete(oauthPending).where(eq(oauthPending.id, row.id));
  jar.delete(PENDING_COOKIE);
}
