const API_KEY = "AIzaSyDsYIaoKxRjNUUOnQvwyYLpPRvNy0WLRUM";

export type FirebaseSession = {
  localId: string;
  email: string;
  refreshToken: string;
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

export async function firebaseSignIn(email: string, password: string): Promise<FirebaseSession | null> {
  const result = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  if (!result.ok || !result.data.localId || !result.data.refreshToken) return null;
  return { localId: result.data.localId, email: result.data.email || email, refreshToken: result.data.refreshToken };
}

export async function firebaseSignUp(email: string, password: string): Promise<{ ok: true; localId: string } | { ok: false; taken: boolean }> {
  const result = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  if (!result.ok) return { ok: false, taken: result.message.includes("EMAIL_EXISTS") };
  return { ok: true, localId: result.data.localId };
}

export async function firebaseRefresh(refreshToken: string): Promise<boolean> {
  const result = await post(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return result.ok;
}
