/**
 * 사진 속 글을 읽습니다.
 * 열쇠가 있으면 그 열쇠로 읽고, 없거나 비면 이 서버에서 읽습니다.
 * 읽기에 실패하면 빈 글만 돌려줍니다. 문장을 만들지 않습니다.
 */

import type { ImageKind } from "@/server/bulletin/read/image-kind";

export async function readBulletinImage(bytes: Buffer, kind: ImageKind, apiKey: string): Promise<string> {
  if (bytes.length === 0) return "";
  let prepared = bytes;
  try {
    if (kind === "heic") prepared = await heicToJpeg(bytes);
  } catch {
    return "";
  }
  if (prepared.length === 0) return "";
  const key = apiKey.trim();
  if (key) {
    const cloud = await readWithVision(prepared, key);
    if (cloud.trim()) return cloud;
  }
  return readLocally(prepared);
}

async function heicToJpeg(bytes: Buffer): Promise<Buffer> {
  const imported = await import("heic-convert");
  const convert = imported.default;
  const output = await convert({ buffer: bytes, format: "JPEG", quality: 0.9 });
  return Buffer.from(output);
}

async function readWithVision(bytes: Buffer, apiKey: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: bytes.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    });
  } catch {
    return "";
  }
  if (!response.ok) return "";
  const data = (await response.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
  };
  return data.responses?.[0]?.fullTextAnnotation?.text ?? "";
}

async function readLocally(bytes: Buffer): Promise<string> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("kor+eng", 1, {
      cachePath: "/tmp/modl-tesseract",
      errorHandler: () => undefined,
    });
    try {
      const result = await worker.recognize(bytes);
      return result.data.text ?? "";
    } finally {
      await worker.terminate();
    }
  } catch {
    return "";
  }
}
