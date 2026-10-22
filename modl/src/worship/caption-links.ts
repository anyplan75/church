/**
 * 예배 자막 언어와 실시간 번역기 링크 규칙입니다.
 * 데이터베이스에 접속하지 않습니다.
 */

export const CAPTION_LANGUAGES = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "영어" },
  { code: "zh", label: "중국어" },
  { code: "ja", label: "일본어" },
  { code: "vi", label: "베트남어" },
  { code: "id", label: "인도네시아어" },
  { code: "tl", label: "타갈로그어" },
  { code: "th", label: "태국어" },
  { code: "mn", label: "몽골어" },
  { code: "ru", label: "러시아어" },
] as const;

export type CaptionLanguageCode = (typeof CAPTION_LANGUAGES)[number]["code"];

const CODES = new Set<string>(CAPTION_LANGUAGES.map((item) => item.code));

export function isCaptionLanguage(value: string): value is CaptionLanguageCode {
  return CODES.has(value);
}

export function captionLanguageLabel(code: string): string {
  return CAPTION_LANGUAGES.find((item) => item.code === code)?.label ?? code;
}

/** 비어 있으면 그 언어를 쓰지 않습니다. 있으면 https 주소만 받습니다. */
export function captionUrlError(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return "자막 링크는 주소여야 합니다.";
  }
  if (url.protocol !== "https:") return "자막 링크는 https 주소만 됩니다.";
  if (url.username || url.password) return "자막 링크에 암호를 넣지 마세요.";
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "[::1]") {
    return "그 자막 링크는 연결할 수 없습니다.";
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    return "그 자막 링크는 연결할 수 없습니다.";
  }
  return null;
}

export type CaptionChoice = { code: CaptionLanguageCode; label: string };

/** 링크가 있는 언어만 고를 수 있습니다. */
export function selectableCaptionLanguages(links: readonly { code: string; url: string }[]): CaptionChoice[] {
  return CAPTION_LANGUAGES.flatMap((item) => {
    const saved = links.find((link) => link.code === item.code);
    if (!saved || captionUrlError(saved.url) !== null || !saved.url.trim()) return [];
    return [{ code: item.code, label: item.label }];
  });
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function linesFromJson(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.flatMap((item) => (typeof item === "string" ? [cleanLine(item)] : [])).filter(Boolean).slice(0, 4);
  }
  if (!data || typeof data !== "object") return [];
  const record = data as { lines?: unknown; text?: unknown; caption?: unknown };
  if (Array.isArray(record.lines)) return linesFromJson(record.lines);
  if (typeof record.text === "string") return [cleanLine(record.text)].filter(Boolean);
  if (typeof record.caption === "string") return [cleanLine(record.caption)].filter(Boolean);
  return [];
}

/** 번역기 링크가 돌려준 글에서 화면에 올릴 줄을 고릅니다. */
export function linesFromCaptionBody(body: string, contentType: string): string[] {
  const type = contentType.toLowerCase();
  if (type.includes("html")) return [];
  const trimmed = body.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[") || type.includes("json")) {
    try {
      return linesFromJson(JSON.parse(trimmed) as unknown);
    } catch {
      return [];
    }
  }
  return trimmed
    .split(/\n+/)
    .map((line) => cleanLine(line))
    .filter(Boolean)
    .slice(0, 4);
}
