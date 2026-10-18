"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GroupRoom } from "@/components/community/group-room";

/** 정적보내기에서도 동작하도록 /community/groups/?id=&region= 쿼리를 씁니다. */
function GroupRoomFromQuery() {
  const params = useSearchParams();
  const groupId = (params.get("id") || "").trim();
  const regionId = (params.get("region") || "").trim();

  if (!groupId) {
    return (
      <div className="rounded-2xl border border-line bg-card px-5 py-8 text-center">
        <p className="text-sm text-muted">모임 주소가 올바르지 않습니다.</p>
        <a href="/community/" className="mt-3 inline-block text-sm font-medium text-[#3b82f6]">
          커뮤니티로 돌아가기
        </a>
      </div>
    );
  }

  return <GroupRoom groupId={groupId} regionId={regionId} />;
}

export default function CommunityGroupPage() {
  return (
    <div className="page !max-w-4xl !pb-10">
      <Suspense fallback={<p className="text-sm text-muted">모임을 여는 중…</p>}>
        <GroupRoomFromQuery />
      </Suspense>
    </div>
  );
}
