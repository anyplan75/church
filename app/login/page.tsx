"use client";

import { login } from "@/lib/account-actions";
import { SubmitButton } from "@/components/submit-button";
import { useClientQuery } from "@/components/church-state";
import { isMobileOperatorApp } from "@/lib/mobile-app";

export default function LoginPage() {
  const query = useClientQuery();
  const brand = isMobileOperatorApp() ? "은혜로운 예배 Remote" : "은혜로운 예배";

  return (
    <div className="page max-w-md">
      <p className="text-sm font-semibold text-gold">{brand}</p>
      <h1 className="mt-1 font-serif text-4xl">로그인</h1>
      <p className="mt-2 text-muted">전체 운영자와 교회 운영자가 이메일과 비밀번호로 들어갑니다. 교회 운영자는 자기 교회만 봅니다.</p>
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
    </div>
  );
}
