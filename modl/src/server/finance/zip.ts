/**
 * 영수증 사진을 기간에 맞게 모아 압축 파일로 만듭니다.
 * 사진이 없으면 빈 압축을 만들지 않습니다.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

function localPublicPath(value: string): string | null {
  let pathname = value;
  if (value.startsWith("https://") || value.startsWith("http://")) {
    try {
      pathname = new URL(value).pathname;
    } catch {
      return null;
    }
  } else if (!value.startsWith("/")) {
    return null;
  }
  if (pathname.includes("..")) return null;
  const root = path.resolve(process.cwd(), "public");
  const full = path.resolve(root, pathname.replace(/^\/+/, ""));
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) return null;
  return full;
}

function extensionOf(value: string): string {
  const clean = value.split("?")[0] ?? value;
  const match = clean.match(/(\.[a-zA-Z0-9]{1,5})$/);
  return match?.[1]?.toLowerCase() ?? ".bin";
}

async function readReceipt(value: string): Promise<Buffer | null> {
  const local = localPublicPath(value);
  if (local) {
    try {
      return await readFile(local);
    } catch {
      return null;
    }
  }
  if (!value.startsWith("https://") && !value.startsWith("http://")) return null;
  try {
    const response = await fetch(value);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/** 읽은 사진이 하나도 없으면 null 을 돌려줍니다. */
export async function zipReceiptFiles(urls: readonly string[]): Promise<Buffer | null> {
  if (urls.length === 0) return null;
  const zip = new JSZip();
  let added = 0;
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    if (!url) continue;
    const bytes = await readReceipt(url);
    if (!bytes || bytes.length === 0) continue;
    zip.file(`receipt-${index + 1}${extensionOf(url)}`, bytes);
    added += 1;
  }
  if (added === 0) return null;
  return zip.generateAsync({ type: "nodebuffer" });
}
