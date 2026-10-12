import JSZip from "jszip";
import mammoth from "mammoth";

const HWP_MESSAGE = "한글 파일은 HWPX로 저장하거나, 워드(DOCX) 또는 텍스트(TXT)로 올려 주세요.";

export async function extractUploadedText(name: string, data: Buffer): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".text") || lower.endsWith(".md")) return data.toString("utf8");
  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: data });
    const text = result.value.trim();
    if (!text) throw new Error("워드 파일에서 글을 읽지 못했습니다.");
    return result.value;
  }
  if (lower.endsWith(".doc")) throw new Error("예전 워드 파일은 DOCX로 저장한 뒤 올려 주세요.");
  if (lower.endsWith(".hwpx") || lower.endsWith(".hwp")) return extractHwpx(data);
  throw new Error("텍스트, 워드(DOCX), 한글(HWPX) 파일만 받을 수 있습니다.");
}

async function extractHwpx(data: Buffer): Promise<string> {
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) throw new Error(HWP_MESSAGE);
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
    if (chunks.length === 0) throw new Error(HWP_MESSAGE);
    return chunks.join("\n");
  } catch (error) {
    if (error instanceof Error && error.message === HWP_MESSAGE) throw error;
    throw new Error(HWP_MESSAGE);
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
