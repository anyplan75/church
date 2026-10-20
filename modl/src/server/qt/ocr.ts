/**
 * 사진 속 글을 읽습니다.
 * 열쇠가 있을 때만 이 파일을 부릅니다. 열쇠와 요청 주소는 기록하지 않습니다.
 */

import { questionsFromOcrText } from "@/qt/rules";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type OcrRead =
  | { kind: "text"; body: string; questions: string[] }
  | { kind: "skip"; message: string };

export async function readImageText(file: { type: string; bytes: Buffer }, apiKey: string): Promise<OcrRead> {
  if (!IMAGE_TYPES.has(file.type)) {
    return {
      kind: "skip",
      message: "이 열쇠는 사진만 읽습니다. 본문과 질문을 직접 적어 주세요.",
    };
  }
  let response: Response;
  try {
    response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: file.bytes.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    });
  } catch {
    return { kind: "skip", message: "사진에서 글을 읽지 못했습니다. 본문과 질문을 직접 적어 주세요." };
  }
  if (!response.ok) {
    return { kind: "skip", message: "사진에서 글을 읽지 못했습니다. 본문과 질문을 직접 적어 주세요." };
  }
  const data = (await response.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
  };
  const parsed = questionsFromOcrText(data.responses?.[0]?.fullTextAnnotation?.text ?? "");
  if (!parsed.body && parsed.questions.length === 0) {
    return { kind: "skip", message: "사진에서 글을 찾지 못했습니다. 본문과 질문을 직접 적어 주세요." };
  }
  return { kind: "text", body: parsed.body, questions: parsed.questions };
}
