"use client";

import { MemberApp } from "@/components/member/member-app";

/** 담당 목사 기도함. 성도 앱 탭이 아니라 `/prayers` 전용 화면입니다. */
export default function PrayersPage() {
  return <MemberApp initialTab="inbox" />;
}
