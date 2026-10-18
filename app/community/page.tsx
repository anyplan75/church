"use client";

import { CommunityApp } from "@/components/community/community-app";
import { useChurch } from "@/components/church-state";
import { canUseCommunity } from "@/lib/community-access";

export default function CommunityPage() {
  const { ready, user } = useChurch();
  if (!ready) return null;

  if (!canUseCommunity(user)) {
    return (
      <div className="page">
        <h1 className="font-serif text-4xl">커뮤니티</h1>
        <p className="mt-2 text-muted">교회를 연 뒤에 커뮤니티를 이용해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="page !max-w-3xl !pb-8">
      <CommunityApp />
    </div>
  );
}
