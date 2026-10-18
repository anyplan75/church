"use client";

import { MemberApp } from "@/components/member/member-app";

/** 목회자·운영자용 기도함. 성도 앱의 받은기도 탭으로 엽니다. */
export default function PrayersPage() {
  return <MemberApp initialTab="inbox" />;
}
