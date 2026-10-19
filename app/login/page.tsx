"use client";

import Link from "next/link";
import { login } from "@/lib/account-actions";
import { SubmitButton } from "@/components/submit-button";
import { useClientQuery } from "@/components/church-state";
import { PRODUCT_MEMBER_NAME, PRODUCT_NAME, PRODUCT_REMOTE_NAME } from "@/lib/brand";
import { isMobileMemberApp, isMobileOperatorApp, MOBILE_MEMBER_HOME } from "@/lib/mobile-app";

export default function LoginPage() {
  const query = useClientQuery();
  const member = isMobileMemberApp();
  const operator = isMobileOperatorApp();
  const brand = member ? PRODUCT_MEMBER_NAME : operator ? PRODUCT_REMOTE_NAME : PRODUCT_NAME;
  const blurb = member
    ? "기도제목 보내기·커뮤니티 글쓰기 등에 씁니다. 예배정보·자막은 로그인 없이 볼 수 있습니다."
    : "전체 운영자와 교회 운영자가 이메일과 비밀번호로 들어갑니다. 교회 운영자는 자기 교회만 봅니다.";

  return (
    <div className="page max-w-md">
      <p className="text-sm font-semibold text-gold">{brand}</p>
      <h1 className="mt-1 font-serif text-4xl">로그인</h1>
      <p className="mt-2 text-muted">{blurb}</p>
      {query.error ? <p className="mt-4 text-sm text-wine">이메일 또는 비밀번호가 맞지 않습니다.</p> : null}
      <form action={login} className="card mt-6 space-y-4 p-5">
        <label className="field">
          <span>이메일</span>
          <input className="input" name="email" type="email" autoComplete="email" maxLength={120} required />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </label>
        <SubmitButton>들어가기</SubmitButton>
      </form>
      {!operator ? (
        <p className="mt-6 text-center text-sm text-muted">
          <Link href={`${MOBILE_MEMBER_HOME}/`} className="font-medium text-ink underline-offset-2 hover:underline">
            로그인 없이 주변 교회·예배정보 보기
          </Link>
        </p>
      ) : null}
    </div>
  );
}
