/**
 * 주보 파일에서 글을 읽습니다.
 * 한글, 워드, PDF, 사진은 은혜로운 예배의 lib/extract-text.ts 와 같은 순서로 읽습니다.
 * 확장자가 없어도 내용이 사진이면 그 사진 읽기를 탑니다.
 */

import { extractLegacyDoc } from "@/server/bulletin/read/extract-doc";
import { extractDocx } from "@/server/bulletin/read/extract-docx";
import { extractHtml } from "@/server/bulletin/read/extract-html";
import { extractHwp } from "@/server/bulletin/read/extract-hwp";
import { extractOdt } from "@/server/bulletin/read/extract-odt";
import { extractPdf } from "@/server/bulletin/read/extract-pdf";
import { extractRtf } from "@/server/bulletin/read/extract-rtf";
import JSZip from "jszip";
import { sniffImage, type ImageKind } from "@/server/bulletin/read/image-kind";

export type FileRead = { kind: "text"; text: string } | { kind: "empty" };

export async function readBulletinFile(
  name: string,
  data: Buffer,
  imageText: (bytes: Buffer, kind: ImageKind) => Promise<string>,
): Promise<FileRead> {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  const image = sniffImage(data);
  if (image === "jpg" || image === "png" || image === "webp") {
    return textOrEmpty(await imageText(data, image));
  }
  if (ext === ".txt" || ext === ".text" || ext === ".md") return textOrEmpty(data.toString("utf8"));
  if (ext === ".docx") return textOrEmpty(await extractDocx(data));
  if (ext === ".doc") return textOrEmpty(await extractLegacyDoc(data));
  if (ext === ".hwpx") return textOrEmpty(await extractHwpx(data));
  if (ext === ".hwp") return textOrEmpty(data.length >= 2 && data[0] === 0x50 && data[1] === 0x4b ? await extractHwpx(data) : await extractHwp(data));
  if (ext === ".pdf") return textOrEmpty(await extractPdf(data));
  if (ext === ".rtf") return textOrEmpty(extractRtf(data));
  if (ext === ".odt") return textOrEmpty(await extractOdt(data));
  if (ext === ".html" || ext === ".htm") return textOrEmpty(extractHtml(data));
  return { kind: "empty" };
}

function textOrEmpty(value: string): FileRead {
  const text = value.replace(/\r/g, "").trim();
  return text ? { kind: "text", text } : { kind: "empty" };
}

const HWPX_READ = "한글 파일에서 글을 읽지 못했습니다. HWPX가 맞는지 확인해 주세요.";

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
