"use client";

import { MemberApp } from "@/components/member/member-app";

/** 담당 목사 기도함. 성도 앱 `/member`의 받은기도 탭과 같습니다. */
export default function PrayersPage() {
  return <MemberApp initialTab="inbox" />;
}
