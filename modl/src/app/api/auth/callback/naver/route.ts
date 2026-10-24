import { redirect } from "next/navigation";
import { finishSocialLogin } from "@/server/login/callback";

/** 네이버가 돌려보내는 주소입니다. 이 경로만 사용합니다. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = await finishSocialLogin({
    provider: "naver",
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    providerError: url.searchParams.get("error"),
  });
  redirect(next);
}
