/**
 * 지메일 메시지에서 제목, 본문, 첨부를 고릅니다.
 * 주보·안내·큐시트 파일이나 예배 글이 있을 때만 안내로 봅니다.
 */

import { bulletinExtension } from "@/server/bulletin/read/store";

const CUE = /주보|안내|큐시트|예배|1부|2부|광고|설교/;

const MIME_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/haansofthwp": ".hwp",
  "application/x-hwp": ".hwp",
  "application/vnd.hancom.hwp": ".hwp",
  "application/vnd.hancom.hwpx": ".hwpx",
  "application/rtf": ".rtf",
  "text/rtf": ".rtf",
  "application/vnd.oasis.opendocument.text": ".odt",
  "text/plain": ".txt",
  "text/html": ".html",
  "text/markdown": ".md",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

export type MailAttachment = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
};

export type ParsedMail = {
  id: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  body: string;
  receivedAt: Date | null;
  attachments: MailAttachment[];
};

export function decodeBase64Url(value: string): Buffer {
  const trimmed = value.replace(/\s/g, "");
  const pad = trimmed.length % 4 === 0 ? "" : "=".repeat(4 - (trimmed.length % 4));
  return Buffer.from(trimmed.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function attachmentName(filename: string, mimeType: string): string {
  const name = filename.trim() || "attachment";
  if (bulletinExtension(name)) return name;
  const ext = MIME_EXTENSION[mimeType.toLowerCase()];
  return ext ? `${name}${ext}` : name;
}

export function guideFileScore(name: string): number {
  if (name.includes("주보")) return 3;
  if (name.includes("큐시트")) return 2;
  if (name.includes("안내")) return 1;
  return 0;
}

export function guideMailCue(text: string): boolean {
  return CUE.test(text);
}

/** 안내로 읽을 첨부 하나를 고릅니다. 없으면 null 입니다. */
export function pickGuideAttachment(attachments: readonly MailAttachment[]): MailAttachment | null {
  const ready = attachments.filter((item) => bulletinExtension(attachmentName(item.filename, item.mimeType)));
  if (ready.length === 0) return null;
  return ready.reduce((best, item) => {
    const score = guideFileScore(attachmentName(item.filename, item.mimeType));
    const bestScore = guideFileScore(attachmentName(best.filename, best.mimeType));
    return score > bestScore ? item : best;
  });
}

export function messageIsGuide(mail: Pick<ParsedMail, "subject" | "body" | "attachments">): boolean {
  const names = mail.attachments.map((item) => attachmentName(item.filename, item.mimeType));
  if (names.some((name) => bulletinExtension(name))) return true;
  return guideMailCue(`${mail.subject}\n${mail.body}\n${names.join("\n")}`);
}

function header(headers: unknown, name: string): string {
  if (!Array.isArray(headers)) return "";
  const found = headers.find((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as { name?: unknown };
    return typeof row.name === "string" && row.name.toLowerCase() === name.toLowerCase();
  }) as { value?: unknown } | undefined;
  return typeof found?.value === "string" ? found.value.trim() : "";
}

function parseFrom(value: string): { name: string; email: string } {
  const match = value.match(/<([^<>]+)>/);
  const email = (match?.[1] ?? value).trim().toLowerCase();
  const name = (match ? value.slice(0, match.index) : "").replace(/"/g, "").trim();
  return { name, email: email.includes("@") ? email : "" };
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function walkParts(part: unknown, bodies: { plain: string[]; html: string[] }, attachments: MailAttachment[]): void {
  if (!part || typeof part !== "object") return;
  const row = part as {
    mimeType?: unknown;
    filename?: unknown;
    headers?: unknown;
    body?: { data?: unknown; attachmentId?: unknown; size?: unknown };
    parts?: unknown;
  };
  const mimeType = typeof row.mimeType === "string" ? row.mimeType : "";
  const filename = typeof row.filename === "string" ? row.filename : "";
  const attachmentId = typeof row.body?.attachmentId === "string" ? row.body.attachmentId : "";
  const size = typeof row.body?.size === "number" ? row.body.size : 0;
  if (attachmentId && (filename || bulletinExtension(attachmentName(filename, mimeType)))) {
    attachments.push({ filename, mimeType, attachmentId, size });
  }
  const data = typeof row.body?.data === "string" ? row.body.data : "";
  if (data && !attachmentId) {
    const text = decodeBase64Url(data).toString("utf8");
    if (mimeType.startsWith("text/plain")) bodies.plain.push(text);
    else if (mimeType.startsWith("text/html")) bodies.html.push(text);
    else if (!mimeType && text.trim()) bodies.plain.push(text);
  }
  if (Array.isArray(row.parts)) {
    for (const child of row.parts) walkParts(child, bodies, attachments);
  }
}

/** 지메일 format=full 응답에서 편지 겉과 본문을 읽습니다. */
export function parseGmailMessage(value: unknown): ParsedMail | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { id?: unknown; internalDate?: unknown; payload?: unknown };
  if (typeof row.id !== "string" || !row.id) return null;
  const payload = row.payload;
  const headers = payload && typeof payload === "object" ? (payload as { headers?: unknown }).headers : [];
  const bodies = { plain: [] as string[], html: [] as string[] };
  const attachments: MailAttachment[] = [];
  walkParts(payload, bodies, attachments);
  const plain = bodies.plain.join("\n").trim();
  const body = plain || htmlToText(bodies.html.join("\n"));
  const receivedMs = typeof row.internalDate === "string" ? Number(row.internalDate) : Number.NaN;
  return {
    id: row.id,
    fromEmail: parseFrom(header(headers, "from")).email,
    fromName: parseFrom(header(headers, "from")).name,
    subject: header(headers, "subject"),
    body,
    receivedAt: Number.isFinite(receivedMs) ? new Date(receivedMs) : null,
    attachments,
  };
}
