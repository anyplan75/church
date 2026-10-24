import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 초대는 교회 관리자 탭 한곳에 둡니다. */
export default function InvitePage() {
  redirect("/account?tab=church");
}
