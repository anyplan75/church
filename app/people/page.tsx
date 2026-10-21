"use client";

import { ReplacePage } from "@/components/replace-page";

/** 조작 앱에서는 사람(성도) 명단을 쓰지 않습니다. 예배 목록으로 보냅니다. */
export default function PeoplePage() {
  return <ReplacePage href="/services" />;
}
