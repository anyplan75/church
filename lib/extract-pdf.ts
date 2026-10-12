import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdf(data: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const result = await extractText(pdf, { mergePages: true });
    const text = (Array.isArray(result.text) ? result.text.join("\n") : result.text).replace(/\r/g, "").trim();
    if (!text) throw new Error("PDF에서 글을 읽지 못했습니다. 글자가 들어 있는 PDF로 올려 주세요.");
    return text;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PDF에서")) throw error;
    throw new Error("PDF에서 글을 읽지 못했습니다.");
  }
}
