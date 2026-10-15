const BROKEN = "\uFFFD";

export function decodeLocalText(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const marked = byteOrderMark(bytes);
  if (marked) return clean(decode(bytes.subarray(marked.skip), marked.encoding));
  if (isUtf8(bytes)) return clean(decode(bytes, "utf-8"));
  const cp949 = decode(bytes, "euc-kr");
  if (cp949Accepted(bytes, cp949)) return clean(cp949);
  return clean(utf16Text(bytes));
}

function byteOrderMark(bytes: Uint8Array): { encoding: string; skip: number } | null {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { encoding: "utf-8", skip: 3 };
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return { encoding: "utf-16le", skip: 2 };
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return { encoding: "utf-16be", skip: 2 };
  return null;
}

function isUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function decode(bytes: Uint8Array, encoding: string): string {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return "";
  }
}

function cp949Accepted(bytes: Uint8Array, text: string): boolean {
  if (!text || text.includes(BROKEN)) return false;
  const zeros = count(bytes, 0);
  if (bytes.length > 8 && zeros / bytes.length > 0.15 && hangul(utf16Text(bytes)) > hangul(text)) return false;
  return true;
}

function utf16Text(bytes: Uint8Array): string {
  const little = decode(bytes, "utf-16le");
  const big = decode(bytes, "utf-16be");
  return hangul(little) >= hangul(big) ? little : big;
}

function hangul(text: string): number {
  return text.match(/[가-힣]/g)?.length ?? 0;
}

function count(bytes: Uint8Array, value: number): number {
  let total = 0;
  for (const byte of bytes) if (byte === value) total += 1;
  return total;
}

function clean(text: string): string {
  return text.replace(/\uFEFF/g, "").replaceAll(BROKEN, "");
}
