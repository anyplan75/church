/**
 * 사진인지 파일 내용으로 가립니다.
 * 이름에 확장자가 없어도 사진이면 사진으로 받습니다.
 */

export type ImageKind = "jpg" | "png" | "webp" | "heic";

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "heif",
  "mif1",
  "msf1",
]);

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (isJpeg(bytes)) return "jpg";
  if (isPng(bytes)) return "png";
  if (isWebp(bytes)) return "webp";
  if (isHeic(bytes)) return "heic";
  return null;
}

export function imageExtension(kind: ImageKind): string {
  if (kind === "jpg") return ".jpg";
  if (kind === "png") return ".png";
  if (kind === "webp") return ".webp";
  return ".heic";
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  );
}

function isHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") return false;
  if (HEIC_BRANDS.has(ascii(bytes, 8, 4))) return true;
  const boxSize = readUint32(bytes, 0);
  const end = Math.min(bytes.length, boxSize >= 16 ? boxSize : Math.min(bytes.length, 64));
  for (let index = 16; index + 4 <= end; index += 4) {
    if (HEIC_BRANDS.has(ascii(bytes, index, 4))) return true;
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(bytes[start + index] ?? 0);
  }
  return text;
}

function readUint32(bytes: Uint8Array, start: number): number {
  return (
    ((bytes[start] ?? 0) << 24) |
    ((bytes[start + 1] ?? 0) << 16) |
    ((bytes[start + 2] ?? 0) << 8) |
    (bytes[start + 3] ?? 0)
  ) >>> 0;
}
