"use client";

import { CommunityBoard } from "@/components/community-board";
import { useChurch } from "@/components/church-state";

export default function CommunityPage() {
  const { ready, user } = useChurch();
  if (!ready) return null;

  if (!user || user.kind !== "church") {
    return (
      <div className="page">
        <h1 className="font-serif text-4xl">커뮤니티</h1>
        <p className="mt-2 text-muted">교회 계정으로 로그인한 뒤 이용해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">커뮤니티</h1>
      <p className="mt-2 text-muted">같은 지역의 교회와 공지·질문·나눔을 나누고, 자료 링크와 행사 홍보를 올립니다.</p>
      <CommunityBoard />
    </div>
  );
}
