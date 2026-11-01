import { startKakaoLogin, startNaverLogin } from "@/server/login/oauth-actions";

/** 이메일 로그인 옆에 두는 카카오·네이버 버튼입니다. */
export function SocialLoginButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={startKakaoLogin}>
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-xl bg-[#FEE500] px-4 text-sm font-medium text-[#191919]"
        >
          카카오 로그인
        </button>
      </form>
      <form action={startNaverLogin}>
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-xl bg-[#03C75A] px-4 text-sm font-medium text-white"
        >
          네이버 로그인
        </button>
      </form>
    </div>
  );
}
