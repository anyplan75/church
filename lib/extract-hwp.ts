import { inflateRawSync, inflateSync } from "zlib";
import * as CFB from "cfb";

const HWP_READ = "한글 파일에서 글을 읽지 못했습니다.";
const HWP_PASSWORD = "암호가 걸린 한글 파일은 암호를 푼 뒤 올려 주세요.";
const HWP_OLD = "너무 오래된 한글 3.0 파일은 읽지 못합니다. HWPX나 텍스트로 저장한 뒤 올려 주세요.";
const PARA_TEXT = 0x43;

export async function extractHwp(data: Buffer): Promise<string> {
  if (data.length >= 17 && data.subarray(0, 17).toString("latin1") === "HWP Document File") throw new Error(HWP_OLD);
  let container: CFB.CFB$Container;
  try {
    container = CFB.read(data, { type: "buffer" });
  } catch {
    throw new Error(HWP_READ);
  }
  const header = readStream(container, "FileHeader");
  if (!header || header.subarray(0, 17).toString("latin1") !== "HWP Document File") throw new Error(HWP_READ);
  if (header.length > 36 && (header[36] & 0x02) !== 0) throw new Error(HWP_PASSWORD);
  const compressed = header.length > 36 && (header[36] & 0x01) !== 0;
  const sections = container.FullPaths.filter((path) => /BodyText\/Section\d+$/.test(path)).sort((left, right) => sectionNumber(left) - sectionNumber(right));
  const paragraphs: string[] = [];
  for (const path of sections) {
    const raw = readStream(container, path);
    if (!raw) continue;
    const body = compressed ? inflateHwp(raw) : raw;
    paragraphs.push(...paragraphsFromRecords(body));
  }
  const text = paragraphs.join("\n").trim();
  if (!text) throw new Error(HWP_READ);
  return text;
}

function sectionNumber(path: string): number {
  return Number(path.match(/Section(\d+)$/)?.[1] ?? 0);
}

function readStream(container: CFB.CFB$Container, name: string): Buffer | null {
  const entry = CFB.find(container, name) ?? CFB.find(container, name.startsWith("/") ? name : `/${name}`);
  if (!entry?.content) return null;
  return Buffer.from(entry.content);
}

function inflateHwp(data: Buffer): Buffer {
  try {
    return inflateSync(data);
  } catch {
    try {
      return inflateRawSync(data);
    } catch {
      throw new Error(HWP_READ);
    }
  }
}

function paragraphsFromRecords(data: Buffer): string[] {
  const paragraphs: string[] = [];
  let offset = 0;
  while (offset + 4 <= data.length) {
    const value = data.readUInt32LE(offset);
    const tag = value & 0x3ff;
    let size = (value >> 20) & 0xfff;
    offset += 4;
    if (size === 4095) {
      if (offset + 4 > data.length) break;
      size = data.readUInt32LE(offset);
      offset += 4;
    }
    if (size < 0 || offset + size > data.length) break;
    if (tag === PARA_TEXT && size > 0) {
      const text = paragraphText(data.subarray(offset, offset + size));
      if (text) paragraphs.push(text);
    }
    offset += size;
  }
  return paragraphs;
}

function paragraphText(buf: Buffer): string {
  let text = "";
  let index = 0;
  while (index + 1 < buf.length) {
    const code = buf.readUInt16LE(index);
    if (code < 32) {
      if (code === 9) {
        text += "\t";
        index += 2;
        continue;
      }
      if (code === 10 || code === 13) {
        text += "\n";
        index += 2;
        continue;
      }
      if (code === 30 || code === 31) {
        text += " ";
        index += 2;
        continue;
      }
      if (code === 0 || code >= 24) {
        index += 2;
        continue;
      }
      index += 16;
      continue;
    }
    text += String.fromCharCode(code);
    index += 2;
  }
  return text.replace(/\n+$/g, "").trim();
}
