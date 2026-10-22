/**
 * 주보로 올린 파일을 공개 폴더에 저장합니다.
 * 원본 이름은 주소에 넣지 않습니다.
 */

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BULLETIN_UPLOAD_BYTES } from "@/bulletin/intake";

const EXTENSIONS = new Set([
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
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

export function bulletinExtension(name: string): string | null {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  return EXTENSIONS.has(ext) ? ext : null;
}

export async function saveBulletinFile(name: string, bytes: Buffer): Promise<string> {
  const ext = bulletinExtension(name);
  if (!ext) throw new Error("텍스트, 워드, 한글, PDF, RTF, ODT, HTML, 사진만 올릴 수 있습니다.");
  if (bytes.length === 0) throw new Error("파일을 골라 주세요.");
  if (bytes.length > BULLETIN_UPLOAD_BYTES) throw new Error("파일은 16MB 이하로 올려 주세요.");
  const stored = `${Date.now()}-${randomBytes(8).toString("hex")}${ext === ".jpeg" ? ".jpg" : ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), bytes);
  return `/uploads/${stored}`;
}
