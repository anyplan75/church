/**
 * 올린 사진과 문서를 서버 공개 폴더에 저장합니다.
 * 파일 이름만 주소로 남기고, 원본 이름은 쓰지 않습니다.
 */

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

const MAX_BYTES = 5 * 1024 * 1024;

export async function saveUpload(file: { type: string; size: number; bytes: Buffer }): Promise<string> {
  if (file.size <= 0 || file.bytes.length === 0) {
    throw new Error("파일을 골라 주세요.");
  }
  if (file.size > MAX_BYTES || file.bytes.length > MAX_BYTES) {
    throw new Error("파일은 5MB보다 작아야 합니다.");
  }
  const ext = ALLOWED[file.type as keyof typeof ALLOWED];
  if (!ext) {
    throw new Error("사진(jpg, png, webp) 또는 PDF만 올릴 수 있습니다.");
  }
  const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), file.bytes);
  return `/uploads/${name}`;
}
