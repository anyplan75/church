"use client";

import Link from "next/link";
import { useChurch } from "@/components/church-state";
import { homeFor } from "@/lib/roles";

export default function DeniedPage() {
  const { ready, user } = useChurch();
  if (!ready || !user) return null;
  const home = homeFor(user.roles);

  return (
    <div className="page max-w-xl">
      <p className="text-sm font-semibold text-gold">권한</p>
      <h1 className="mt-1 font-serif text-4xl">이 화면을 열 수 없습니다</h1>
      <p className="mt-3 text-muted">가진 역할에 없는 화면이거나, 수정이 막혀 있습니다. 설정·계정 역할이 있는 사람에게 역할을 요청해 주세요.</p>
      <Link href={home} className="btn btn-primary mt-6">
        내 화면으로
      </Link>
    </div>
  );
}
