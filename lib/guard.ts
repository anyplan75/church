import { redirect } from "next/navigation";
import { hasAnyAccount } from "./accounts";
import { can, type Capability } from "./roles";
import { getCurrentUser, type CurrentUser } from "./session";

export async function requireUser(): Promise<CurrentUser> {
  if (!hasAnyAccount()) redirect("/setup");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireScreen(capability: Capability): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.roles, capability)) redirect("/denied");
  return user;
}

export async function requireMutation(capability: Capability): Promise<CurrentUser> {
  return requireScreen(capability);
}

export async function mutationUser(capability: Capability): Promise<{ ok: true; user: CurrentUser } | { ok: false; message: string }> {
  if (!hasAnyAccount()) return { ok: false, message: "로그인이 필요합니다." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  if (!can(user.roles, capability)) return { ok: false, message: "권한이 없습니다." };
  return { ok: true, user };
}

export async function denyApi(capabilities: Capability[]): Promise<Response | null> {
  if (!hasAnyAccount()) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!capabilities.some((capability) => can(user.roles, capability))) {
    return Response.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  return null;
}
