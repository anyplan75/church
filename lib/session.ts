import { cookies } from "next/headers";
import { findAccountById, type Account } from "./accounts";
import { accountIdForToken, createSession, dropSession } from "./sessions";

export const SESSION_COOKIE = "worship_session";

export type CurrentUser = Pick<Account, "id" | "email" | "roles">;

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const accountId = accountIdForToken(token);
  if (!accountId) return null;
  const account = findAccountById(accountId);
  if (!account) return null;
  return { id: account.id, email: account.email, roles: account.roles };
}

export async function startSession(accountId: string) {
  const { token, expiresAt } = createSession(accountId);
  const maxAge = Math.max(1, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) dropSession(token);
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
