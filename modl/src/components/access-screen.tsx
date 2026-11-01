import { BlockedScreen } from "@/components/blocked-screen";
import { LoginGuide } from "@/components/login-guide";
import { viewerIsGuest } from "@/server/login/access";

/** 손님은 로그인으로 안내하고, 로그인한 뒤 권한이 없으면 막힌 안내만 보여 줍니다. */
export async function AccessScreen() {
  if (await viewerIsGuest()) return <LoginGuide />;
  return <BlockedScreen />;
}
