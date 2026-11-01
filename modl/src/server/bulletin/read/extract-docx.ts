import mammoth from "mammoth";

export async function extractDocx(data: Buffer): Promise<string> {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  // Node reads buffer. The browser build of mammoth only reads arrayBuffer.
  const result = await mammoth.extractRawText({ buffer: data, arrayBuffer } as { buffer: Buffer });
  const text = result.value.trim();
  if (!text) throw new Error("워드 파일에서 글을 읽지 못했습니다.");
  return result.value;
}
