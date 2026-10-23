import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 교인 목록은 교회 관리자 탭 한곳에 둡니다. */
export default function RosterPage() {
  redirect("/account?tab=church");
}
