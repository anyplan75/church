import * as CFB from "cfb";
import { extractDocx } from "./extract-docx";
import { extractHtml } from "./extract-html";
import { extractRtf } from "./extract-rtf";

const DOC_READ = "예전 워드 파일에서 글을 읽지 못했습니다.";
const DOC_PASSWORD = "암호가 걸린 워드 파일은 암호를 푼 뒤 올려 주세요.";

type Piece = {
  cpStart: number;
  cpEnd: number;
  unicode: boolean;
  text: string;
};

export async function extractLegacyDoc(data: Buffer): Promise<string> {
  const head = data.subarray(0, 8).toString("latin1");
  if (head.startsWith("{\\rtf")) return extractRtf(data);
  if (data.length >= 2 && data[0] === 0x50 && data[1] === 0x4b) return extractDocx(data);
  const trimmed = head.trimStart();
  if (trimmed.startsWith("<")) return extractHtml(data);
  return extractOleDoc(data);
}

function extractOleDoc(data: Buffer): string {
  let container: CFB.CFB$Container;
  try {
    container = CFB.read(data, { type: "buffer" });
  } catch {
    throw new Error(DOC_READ);
  }
  const word = readStream(container, "WordDocument");
  if (!word || word.length < 0x1a6 || word.readUInt16LE(0) !== 0xa5ec) throw new Error(DOC_READ);
  const flags = word.readUInt16LE(0x0a);
  if ((flags & 0x0100) !== 0) throw new Error(DOC_PASSWORD);
  const table = readStream(container, (flags & 0x0200) !== 0 ? "1Table" : "0Table");
  if (!table) throw new Error(DOC_READ);
  const pieces = readPieces(word, table, word.readUInt32LE(0x1a2));
  const text = cleanWord(bodyFromPieces(pieces, word.readUInt32LE(0x4c))).trim();
  if (!text) throw new Error(DOC_READ);
  return text;
}

function readStream(container: CFB.CFB$Container, name: string): Buffer | null {
  const entry = CFB.find(container, name);
  if (!entry?.content) return null;
  return Buffer.from(entry.content);
}

function readPieces(word: Buffer, table: Buffer, start: number): Piece[] {
  let pos = start;
  let guard = 0;
  while (pos < table.length && table[pos] === 1) {
    if (++guard > 1000 || pos + 3 > table.length) throw new Error(DOC_READ);
    const skip = table.readUInt16LE(pos + 1);
    pos += 3 + skip;
  }
  if (pos >= table.length || table[pos] !== 2) throw new Error(DOC_READ);
  pos += 1;
  const pieceTableSize = readUInt32(table, pos);
  pos += 4;
  const count = (pieceTableSize - 4) / 12;
  if (!Number.isInteger(count) || count < 1 || count > 100000) throw new Error(DOC_READ);
  const pieces: Piece[] = [];
  for (let index = 0; index < count; index += 1) {
    const cpStart = readUInt32(table, pos + index * 4);
    const cpEnd = readUInt32(table, pos + (index + 1) * 4);
    const descriptor = pos + (count + 1) * 4 + index * 8;
    let filePos = readUInt32(table, descriptor + 2);
    const unicode = (filePos & 0x40000000) === 0;
    if (!unicode) filePos = (filePos & ~0x40000000) / 2;
    const characters = cpEnd - cpStart;
    if (characters < 0) throw new Error(DOC_READ);
    const byteLength = unicode ? characters * 2 : characters;
    const slice = word.subarray(filePos, filePos + byteLength);
    const text = unicode ? slice.toString("utf16le") : new TextDecoder("euc-kr").decode(slice);
    pieces.push({ cpStart, cpEnd, unicode, text });
  }
  return pieces;
}

function bodyFromPieces(pieces: Piece[], ccpText: number): string {
  if (ccpText <= 0) return pieces.map((piece) => piece.text).join("");
  let remain = ccpText;
  let text = "";
  for (const piece of pieces) {
    const span = piece.cpEnd - piece.cpStart;
    if (span <= 0 || remain <= 0) continue;
    if (span <= remain) {
      text += piece.text;
      remain -= span;
      continue;
    }
    text += piece.unicode ? piece.text.slice(0, remain) : piece.text;
    break;
  }
  return text.trim() ? text : pieces.map((piece) => piece.text).join("");
}

function cleanWord(text: string): string {
  return text.replace(/\u0007/g, "\t").replace(/[\u000b\u000c\r\n]/g, "\n").replace(/[\u0000-\u0008\u000e-\u001f]/g, "");
}

function readUInt32(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > buffer.length) throw new Error(DOC_READ);
  return buffer.readUInt32LE(offset);
}
