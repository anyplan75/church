const API_KEY = "AIzaSyDsYIaoKxRjNUUOnQvwyYLpPRvNy0WLRUM";

export type FirebaseSession = {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
};

type AuthError = { error?: { message?: string } };

async function post(url: string, body: unknown): Promise<{ ok: true; data: Record<string, string> } | { ok: false; message: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Record<string, string> & AuthError;
  if (!response.ok) return { ok: false, message: data.error?.message || "auth" };
  return { ok: true, data };
}

export function emailFromIdToken(idToken: string): string {
  const part = idToken.split(".")[1];
  if (!part) return "";
  try {
    const base = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base.padEnd(base.length + ((4 - (base.length % 4)) % 4), "=");
    const text = atob(padded);
    const payload = JSON.parse(text) as { email?: string };
    return String(payload.email || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function sessionFrom(data: Record<string, string>, fallbackEmail: string): FirebaseSession | null {
  const localId = data.localId || data.user_id;
  const idToken = data.idToken || data.id_token;
  const refreshToken = data.refreshToken || data.refresh_token;
  if (!localId || !idToken || !refreshToken) return null;
  const seconds = Number(data.expiresIn || data.expires_in || 3600);
  return {
    localId,
    email: (emailFromIdToken(idToken) || data.email || fallbackEmail).trim().toLowerCase(),
    idToken,
    refreshToken,
    expiresAt: Date.now() + Math.max(60, seconds - 120) * 1000,
  };
}

export async function firebaseSignIn(email: string, password: string): Promise<FirebaseSession | null> {
  const result = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  if (!result.ok) return null;
  return sessionFrom(result.data, email);
}

export async function firebaseSignUp(email: string, password: string): Promise<{ ok: true; session: FirebaseSession } | { ok: false; taken: boolean }> {
  const result = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  if (!result.ok) return { ok: false, taken: result.message.includes("EMAIL_EXISTS") };
  const session = sessionFrom(result.data, email);
  if (!session) return { ok: false, taken: false };
  return { ok: true, session };
}

export async function firebaseRefresh(refreshToken: string): Promise<FirebaseSession | null> {
  const result = await post(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (!result.ok) return null;
  return sessionFrom(result.data, "");
}

export async function firebaseUpdateAccount(
  idToken: string,
  patch: { email?: string; password?: string },
): Promise<{ ok: true; email: string; idToken: string } | { ok: false; message: string }> {
  const body: Record<string, string | boolean> = { idToken, returnSecureToken: true };
  if (patch.email) body.email = patch.email;
  if (patch.password) body.password = patch.password;
  const result = await post(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`, body);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, email: (result.data.email || patch.email || "").toLowerCase(), idToken: result.data.idToken || idToken };
}

export async function firebaseDeleteAccount(idToken: string): Promise<void> {
  await post(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`, { idToken });
}
