export function extractHtml(data: Buffer): string {
  const text = textFromHtml(decodeHtml(data)).trim();
  if (!text) throw new Error("HTML 파일에서 글을 읽지 못했습니다.");
  return text;
}

export function textFromHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote|table|header|footer)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function decodeHtml(data: Buffer): string {
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) return data.subarray(3).toString("utf8");
  const head = data.subarray(0, 800).toString("latin1");
  const charset = head.match(/charset\s*=\s*["']?\s*([\w.-]+)/i)?.[1] ?? "";
  if (/euc-kr|cp949|ks_c_5601|windows-949/i.test(charset)) return new TextDecoder("euc-kr").decode(data);
  const utf8 = data.toString("utf8");
  if (utf8.includes("\uFFFD") && /[\x80-\xff]/.test(head)) return new TextDecoder("euc-kr").decode(data);
  return utf8;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
