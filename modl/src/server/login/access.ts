import { loadPendingSignup } from "@/server/auth/oauth";
import { loadActor } from "@/server/auth/session";

/** 로그인하지 않은 손님인지 확인합니다. */
export async function viewerIsGuest(): Promise<boolean> {
  const actor = await loadActor();
  return actor.kind === "guest";
}

export { loadPendingSignup };
