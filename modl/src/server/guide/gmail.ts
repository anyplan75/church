/**
 * 모들 제주 메일함의 새 편지를 읽습니다.
 * 갱신 열쇠가 있으면 그 열쇠를 쓰고, 없으면 이미 있는 구글 서비스 계정으로 그 메일함을 엽니다.
 * 열쇠 값은 기록으로 남기지 않습니다.
 */

import { createSign } from "node:crypto";
import { BULLETIN_UPLOAD_BYTES } from "@/bulletin/intake";
import {
  attachmentName,
  decodeBase64Url,
  messageIsGuide,
  parseGmailMessage,
  pickGuideAttachment,
  type ParsedMail,
} from "@/guide/mail";

export const GUIDE_MAILBOX = "modl.jeju@gmail.com";

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type GmailEnv = {
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  GOOGLE_SHEETS_SERVICE_ACCOUNT?: string;
  GOOGLE_SQL_ADMIN_CREDENTIALS?: string;
};

export type GuideFetchItem = {
  gmailMessageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  body: string;
  receivedAt: Date | null;
  guide: boolean;
  fileName: string;
  bytes: Buffer;
  tooBig: boolean;
};

export type GuideFetchResult =
  | { ok: true; items: GuideFetchItem[] }
  | { ok: false; reason: "unconfigured" | "mailbox" | "failed" };

type ServiceAccount = { clientEmail: string; privateKey: string };

export function gmailEnvFromProcess(): GmailEnv {
  return {
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
    GOOGLE_SHEETS_SERVICE_ACCOUNT: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT,
    GOOGLE_SQL_ADMIN_CREDENTIALS: process.env.GOOGLE_SQL_ADMIN_CREDENTIALS,
  };
}

function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  let json = trimmed;
  if (!trimmed.startsWith("{")) {
    try {
      json = Buffer.from(trimmed, "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(json) as { client_email?: unknown; private_key?: unknown };
    if (typeof parsed.client_email !== "string" || !parsed.client_email.includes("@")) return null;
    if (typeof parsed.private_key !== "string" || !parsed.private_key.includes("PRIVATE KEY")) return null;
    const privateKey = parsed.private_key.includes("\n")
      ? parsed.private_key
      : parsed.private_key.replace(/\\n/g, "\n");
    return { clientEmail: parsed.client_email, privateKey };
  } catch {
    return null;
  }
}

function serviceAssertion(account: ServiceAccount): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const claim = Buffer.from(
    JSON.stringify({
      iss: account.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      sub: GUIDE_MAILBOX,
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(account.privateKey).toString("base64url")}`;
}

async function tokenFromRefresh(env: GmailEnv, fetchImpl: FetchLike): Promise<string | null> {
  const clientId = env.GMAIL_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GMAIL_CLIENT_SECRET?.trim() ?? "";
  const refreshToken = env.GMAIL_REFRESH_TOKEN?.trim() ?? "";
  if (!clientId || !clientSecret || !refreshToken) return null;
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { access_token?: unknown };
  return typeof payload.access_token === "string" && payload.access_token ? payload.access_token : null;
}

async function tokenFromServiceAccount(account: ServiceAccount, fetchImpl: FetchLike): Promise<string | null> {
  let assertion = "";
  try {
    assertion = serviceAssertion(account);
  } catch {
    return null;
  }
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { access_token?: unknown };
  return typeof payload.access_token === "string" && payload.access_token ? payload.access_token : null;
}

async function profileEmail(token: string, fetchImpl: FetchLike): Promise<string | null> {
  const response = await fetchImpl("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { emailAddress?: unknown };
  return typeof payload.emailAddress === "string" ? payload.emailAddress.trim().toLowerCase() : null;
}

async function mailboxToken(env: GmailEnv, fetchImpl: FetchLike): Promise<{ token: string } | { reason: "unconfigured" | "mailbox" | "failed" }> {
  const accounts = [parseServiceAccount(env.GOOGLE_SHEETS_SERVICE_ACCOUNT), parseServiceAccount(env.GOOGLE_SQL_ADMIN_CREDENTIALS)].filter(
    (item): item is ServiceAccount => item !== null,
  );
  const refreshReady = Boolean(env.GMAIL_CLIENT_ID?.trim() && env.GMAIL_CLIENT_SECRET?.trim() && env.GMAIL_REFRESH_TOKEN?.trim());
  if (!refreshReady && accounts.length === 0) return { reason: "unconfigured" };
  let denied = false;
  let threw = false;
  const attempts: Array<() => Promise<string | null>> = [];
  if (refreshReady) attempts.push(() => tokenFromRefresh(env, fetchImpl));
  for (const account of accounts) attempts.push(() => tokenFromServiceAccount(account, fetchImpl));
  for (const attempt of attempts) {
    try {
      const token = await attempt();
      if (!token) {
        denied = true;
        continue;
      }
      const email = await profileEmail(token, fetchImpl);
      if (email === GUIDE_MAILBOX) return { token };
      denied = true;
    } catch {
      threw = true;
    }
  }
  if (threw && !denied) return { reason: "failed" };
  return { reason: "mailbox" };
}

async function gmailJson(url: string, token: string, fetchImpl: FetchLike): Promise<unknown | null> {
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) return null;
  return response.json();
}

async function attachmentBytes(messageId: string, attachmentId: string, token: string, fetchImpl: FetchLike): Promise<Buffer | null> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
  const payload = (await gmailJson(url, token, fetchImpl)) as { data?: unknown } | null;
  if (!payload || typeof payload.data !== "string" || !payload.data) return null;
  return decodeBase64Url(payload.data);
}

function skipItem(mail: ParsedMail): GuideFetchItem {
  return {
    gmailMessageId: mail.id,
    fromEmail: mail.fromEmail,
    fromName: mail.fromName,
    subject: mail.subject,
    body: "",
    receivedAt: mail.receivedAt,
    guide: false,
    fileName: "",
    bytes: Buffer.alloc(0),
    tooBig: false,
  };
}

/** 아직 처리하지 않은 받은편지함 메일과 안내 첨부를 가져옵니다. */
export async function fetchGuideMail(
  env: GmailEnv,
  knownIds: ReadonlySet<string>,
  fetchImpl: FetchLike = fetch,
): Promise<GuideFetchResult> {
  const opened = await mailboxToken(env, fetchImpl);
  if (!("token" in opened)) return { ok: false, reason: opened.reason };
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", "in:inbox newer_than:30d");
  listUrl.searchParams.set("maxResults", "20");
  let listed: unknown;
  try {
    listed = await gmailJson(listUrl.toString(), opened.token, fetchImpl);
  } catch {
    return { ok: false, reason: "failed" };
  }
  if (!listed) return { ok: false, reason: "failed" };
  const ids = Array.isArray((listed as { messages?: unknown }).messages)
    ? ((listed as { messages: Array<{ id?: unknown }> }).messages
        .map((item) => (typeof item.id === "string" ? item.id : ""))
        .filter((id) => id && !knownIds.has(id)))
    : [];
  const items: GuideFetchItem[] = [];
  let analyzed = 0;
  for (const id of ids) {
    if (analyzed >= 8) break;
    let parsed: ParsedMail | null = null;
    try {
      const full = await gmailJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
        opened.token,
        fetchImpl,
      );
      parsed = parseGmailMessage(full);
    } catch {
      continue;
    }
    if (!parsed) continue;
    if (!messageIsGuide(parsed)) {
      items.push(skipItem(parsed));
      continue;
    }
    analyzed += 1;
    const chosen = pickGuideAttachment(parsed.attachments);
    if (!chosen) {
      items.push({ ...skipItem(parsed), guide: true, body: parsed.body });
      continue;
    }
    const fileName = attachmentName(chosen.filename, chosen.mimeType);
    if (chosen.size > BULLETIN_UPLOAD_BYTES) {
      items.push({ ...skipItem(parsed), guide: true, body: parsed.body, fileName, tooBig: true });
      continue;
    }
    let bytes: Buffer | null = null;
    try {
      bytes = await attachmentBytes(id, chosen.attachmentId, opened.token, fetchImpl);
    } catch {
      continue;
    }
    if (!bytes) continue;
    const tooBig = bytes.length > BULLETIN_UPLOAD_BYTES;
    items.push({
      ...skipItem(parsed),
      guide: true,
      body: parsed.body,
      fileName,
      bytes: tooBig ? Buffer.alloc(0) : bytes,
      tooBig,
    });
  }
  return { ok: true, items };
}
