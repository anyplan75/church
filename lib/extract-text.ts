import JSZip from "jszip";
import { extractLegacyDoc } from "./extract-doc";
import { extractDocx } from "./extract-docx";
import { extractHtml } from "./extract-html";
import { canReadKoreanImages, extractImage } from "./extract-image";
import { extractHwp } from "./extract-hwp";
import { extractOdt } from "./extract-odt";
import { extractPdf } from "./extract-pdf";
import { extractRtf } from "./extract-rtf";

const HWPX_READ = "한글 파일에서 글을 읽지 못했습니다. HWPX가 맞는지 확인해 주세요.";

export const BULLETIN_UPLOAD_BYTES = 16 * 1024 * 1024;

export async function extractUploadedText(name: string, data: Buffer): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".text") || lower.endsWith(".md")) return data.toString("utf8");
  if (lower.endsWith(".docx")) return extractDocx(data);
  if (lower.endsWith(".doc")) return extractLegacyDoc(data);
  if (lower.endsWith(".hwpx")) return extractHwpx(data);
  if (lower.endsWith(".hwp")) return data.length >= 2 && data[0] === 0x50 && data[1] === 0x4b ? extractHwpx(data) : extractHwp(data);
  if (lower.endsWith(".pdf")) return extractPdf(data);
  if (lower.endsWith(".rtf")) return extractRtf(data);
  if (lower.endsWith(".odt")) return extractOdt(data);
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return extractHtml(data);
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp")) return extractImage(data);
  throw new Error(unsupportedUploadMessage());
}

export function bulletinFormatNote(): string {
  const images = canReadKoreanImages() ? ", 사진(JPG, PNG, WEBP)" : "";
  return `붙여 넣은 글, 텍스트(TXT), 워드(DOC, DOCX), 한글(HWP, HWPX), PDF, RTF, ODT, HTML${images}을 받습니다. 한 주에 들어 있는 예배를 모두 준비합니다.`;
}

export function bulletinAccept(): string {
  const types = [
    ".txt",
    ".text",
    ".md",
    ".doc",
    ".docx",
    ".hwp",
    ".hwpx",
    ".pdf",
    ".rtf",
    ".odt",
    ".html",
    ".htm",
    "text/plain",
    "text/html",
    "application/pdf",
    "application/rtf",
    "application/vnd.oasis.opendocument.text",
  ];
  if (canReadKoreanImages()) types.push(".jpg", ".jpeg", ".png", ".webp", "image/jpeg", "image/png", "image/webp");
  return types.join(",");
}

function unsupportedUploadMessage(): string {
  const images = canReadKoreanImages() ? ", 사진(JPG, PNG, WEBP)" : "";
  return `텍스트, 워드(DOC, DOCX), 한글(HWP, HWPX), PDF, RTF, ODT, HTML${images} 파일만 받을 수 있습니다.`;
}

async function extractHwpx(data: Buffer): Promise<string> {
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) throw new Error(HWPX_READ);
  try {
    const zip = await JSZip.loadAsync(data);
    const names = Object.keys(zip.files)
      .filter((file) => /section\d+\.xml$/i.test(file))
      .sort();
    const chunks: string[] = [];
    for (const file of names) {
      const xml = await zip.files[file].async("string");
      const text = textFromHwpxXml(xml);
      if (text) chunks.push(text);
    }
    if (chunks.length === 0) throw new Error(HWPX_READ);
    return chunks.join("\n");
  } catch (error) {
    if (error instanceof Error && error.message === HWPX_READ) throw error;
    throw new Error(HWPX_READ);
  }
}

export function textFromHwpxXml(xml: string): string {
  return xml
    .split(/<\/hp:p>/i)
    .map((paragraph) =>
      [...paragraph.matchAll(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/gi)]
        .map((match) => decodeXml(match[1]))
        .join(""),
    )
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
