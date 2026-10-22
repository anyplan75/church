"use server";

import { redirect } from "next/navigation";
import { KAKAO_NOT_CONFIGURED, NAVER_NOT_CONFIGURED, kakaoAuthorizeUrl, naverAuthorizeUrl } from "@/server/auth/oauth-config";
import { newOauthState, rememberOauthState } from "@/server/auth/oauth";

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
