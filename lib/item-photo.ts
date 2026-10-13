import { isItemPhoto } from "./supplies";

export async function readItemPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("사진은 JPG, PNG, WEBP로 올려 주세요.");
  if (file.size > 8 * 1024 * 1024) throw new Error("사진은 8MB 이하로 올려 주세요.");
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진을 읽지 못했습니다.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.82);
  if (!isItemPhoto(url)) throw new Error("사진을 읽지 못했습니다.");
  return url;
}
