import Link from "next/link";
import { SocialLoginButtons } from "@/components/social-login";

/** 로그인하지 않고 막힌 메뉴를 눌렀을 때 보여 주는 안내입니다. */
export function LoginGuide({ compact = false }: { compact?: boolean }) {
  return (
    <section className="grid gap-4">
      {compact ? null : (
        <h1 className="page-title text-[clamp(1.45rem,1.1rem+1.2vw,2.15rem)] leading-snug">로그인</h1>
      )}
      <p className="leading-relaxed">이 화면은 로그인한 뒤에 사용할 수 있습니다.</p>
      <SocialLoginButtons />
      <Link href="/account" className="font-medium text-[#1e293b] underline">
        이메일로 로그인
      </Link>
    </section>
  );
}
