/**
 * 주보 파일에서 글을 읽습니다.
 * 사진 열쇠가 없거나 글을 못 읽으면 빈 글만 돌려주고, 문장을 만들지 않습니다.
 */

import { extractLegacyDoc } from "@/server/bulletin/read/extract-doc";
import { extractDocx } from "@/server/bulletin/read/extract-docx";
import { extractHtml } from "@/server/bulletin/read/extract-html";
import { extractHwp } from "@/server/bulletin/read/extract-hwp";
import { extractOdt } from "@/server/bulletin/read/extract-odt";
import { extractPdf } from "@/server/bulletin/read/extract-pdf";
import { extractRtf } from "@/server/bulletin/read/extract-rtf";
import JSZip from "jszip";

const IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export type FileRead = { kind: "text"; text: string } | { kind: "empty" };

export async function readBulletinFile(name: string, data: Buffer, imageText: (bytes: Buffer, ext: string) => Promise<string>): Promise<FileRead> {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  try {
    if (ext === ".txt" || ext === ".text" || ext === ".md") return textOrEmpty(data.toString("utf8"));
    if (ext === ".docx") return textOrEmpty(await extractDocx(data));
    if (ext === ".doc") return textOrEmpty(await extractLegacyDoc(data));
    if (ext === ".hwpx") return textOrEmpty(await extractHwpx(data));
    if (ext === ".hwp") return textOrEmpty(data.length >= 2 && data[0] === 0x50 && data[1] === 0x4b ? await extractHwpx(data) : await extractHwp(data));
    if (ext === ".pdf") return textOrEmpty(await extractPdf(data));
    if (ext === ".rtf") return textOrEmpty(extractRtf(data));
    if (ext === ".odt") return textOrEmpty(await extractOdt(data));
    if (ext === ".html" || ext === ".htm") return textOrEmpty(extractHtml(data));
    if (IMAGE.has(ext)) return textOrEmpty(await imageText(data, ext));
  } catch {
    return { kind: "empty" };
  }
  return { kind: "empty" };
}

function textOrEmpty(value: string): FileRead {
  const text = value.replace(/\r/g, "").trim();
  return text ? { kind: "text", text } : { kind: "empty" };
}

async function extractHwpx(data: Buffer): Promise<string> {
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) return "";
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
  return chunks.join("\n");
}

function textFromHwpxXml(xml: string): string {
  return xml
    .split(/<\/hp:p>/i)
    .map((paragraph) =>
      [...paragraph.matchAll(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/gi)]
        .map((match) => decodeXml(match[1] ?? ""))
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
