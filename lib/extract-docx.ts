import mammoth from "mammoth";

export async function extractDocx(data: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: data });
  const text = result.value.trim();
  if (!text) throw new Error("워드 파일에서 글을 읽지 못했습니다.");
  return result.value;
}
