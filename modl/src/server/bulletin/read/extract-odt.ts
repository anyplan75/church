import JSZip from "jszip";

export async function extractOdt(data: Buffer): Promise<string> {
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) throw new Error("ODT 파일에서 글을 읽지 못했습니다.");
  try {
    const zip = await JSZip.loadAsync(data);
    const name = Object.keys(zip.files).find((file) => /(^|\/)content\.xml$/i.test(file));
    if (!name) throw new Error("ODT 파일에서 글을 읽지 못했습니다.");
    const xml = await zip.files[name].async("string");
    const text = textFromOdtXml(xml).trim();
    if (!text) throw new Error("ODT 파일에서 글을 읽지 못했습니다.");
    return text;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("ODT")) throw error;
    throw new Error("ODT 파일에서 글을 읽지 못했습니다.");
  }
}

export function textFromOdtXml(xml: string): string {
  const body = xml.match(/<office:body[\s\S]*<\/office:body>/i)?.[0] ?? xml;
  return body
    .replace(/<text:tab\b[^>]*\/>/gi, "\t")
    .replace(/<text:line-break\b[^>]*\/>/gi, "\n")
    .replace(/<text:s\b([^>]*)\/>/gi, (_, attrs: string) => {
      const count = Number(attrs.match(/\bc="(\d+)"/)?.[1] ?? 1);
      return " ".repeat(Number.isFinite(count) && count > 0 ? Math.min(count, 40) : 1);
    })
    .split(/<\/text:(?:p|h)>/i)
    .map((chunk) => decodeXml(chunk.replace(/<[^>]+>/g, "")).replace(/\u00a0/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
