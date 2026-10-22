"use server";

import { redirect } from "next/navigation";
import { KAKAO_NOT_CONFIGURED, NAVER_NOT_CONFIGURED, kakaoAuthorizeUrl, naverAuthorizeUrl } from "@/server/auth/oauth-config";
import { completePendingSignup, newOauthState, rememberOauthState } from "@/server/auth/oauth";

function fail(message: string): never {
  redirect(`/account?error=${encodeURIComponent(message)}`);
}

/** 카카오 공식 로그인 화면으로 보냅니다. 열쇠가 없으면 들어가지 않습니다. */
export async function startKakaoLogin(): Promise<void> {
  const state = newOauthState();
  const url = kakaoAuthorizeUrl(state);
  if (!url) fail(KAKAO_NOT_CONFIGURED);
  await rememberOauthState("kakao", state);
  redirect(url);
}

/** 네이버 공식 로그인 화면으로 보냅니다. 열쇠가 없으면 들어가지 않습니다. */
export async function startNaverLogin(): Promise<void> {
  const state = newOauthState();
  const url = naverAuthorizeUrl(state);
  if (!url) fail(NAVER_NOT_CONFIGURED);
  await rememberOauthState("naver", state);
  redirect(url);
}

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** 간편 로그인에서 빠졌던 성별·전화번호만 받아 가입을 끝냅니다. */
export async function completeSocialSignup(formData: FormData): Promise<void> {
  try {
    await completePendingSignup({ phone: field(formData, "phone"), gender: field(formData, "gender") });
  } catch (error) {
    const message = error instanceof Error && /[\uac00-\ud7a3]/.test(error.message) ? error.message : "가입을 끝내지 못했습니다.";
    redirect(`/account?need=profile&error=${encodeURIComponent(message)}`);
  }
  redirect("/");
}
