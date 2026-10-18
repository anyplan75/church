"use client";

import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";

export default function SetupPage() {
  return (
    <div className="page max-w-md">
      <p className="text-sm font-semibold text-gold">{PRODUCT_NAME}</p>
      <h1 className="mt-1 font-serif text-4xl">로그인</h1>
      <p className="mt-2 text-muted">계정은 전체 운영자가 만듭니다. 교회를 직접 추가하는 첫 가입은 없습니다.</p>
      <Link href="/login" className="btn btn-primary mt-6">
        로그인
      </Link>
    </div>
  );
}
