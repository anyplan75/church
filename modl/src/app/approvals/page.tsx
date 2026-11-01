import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 승인은 교회 관리자 탭 한곳에 둡니다. */
export default function ApprovalsPage() {
  redirect("/account?tab=church");
}
