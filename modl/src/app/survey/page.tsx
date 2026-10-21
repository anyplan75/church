import { redirect } from "next/navigation";
import { showsPeopleSettings } from "@/account/access";
import { BlockedScreen } from "@/components/blocked-screen";
import { loadAccountPage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function SurveyPage() {
  const account = await loadAccountPage();
  if (showsPeopleSettings(account.role)) redirect("/account");
  return <BlockedScreen />;
}
