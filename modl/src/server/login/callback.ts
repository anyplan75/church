import { finishOauthLogin } from "@/server/auth/oauth";

/** 화면 파일이 권한 모듈 경로를 직접 부르지 않게 한 겹 감쌉니다. */
export async function finishSocialLogin(input: {
  provider: "kakao" | "naver";
  code: string | null;
  state: string | null;
  providerError: string | null;
}): Promise<string> {
  return finishOauthLogin(input);
}
