/**
 * 사진 속 글을 읽습니다.
 * 열쇠가 없거나 읽기에 실패하면 빈 글만 돌려줍니다. 문장을 만들지 않습니다.
 */

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function readBulletinImage(bytes: Buffer, ext: string, apiKey: string): Promise<string> {
  const type = MIME[ext];
  const key = apiKey.trim();
  if (!type || !key || bytes.length === 0) return "";
  let response: Response;
  try {
    response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
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
