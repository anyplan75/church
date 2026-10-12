import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { deflateSync } from "node:zlib";
import * as CFB from "cfb";
import JSZip from "jszip";
import { parseBulletin } from "./bulletin-parse.ts";
import { bulletinAccept, bulletinFormatNote, extractUploadedText } from "./extract-text.ts";
import { canReadKoreanImages } from "./extract-image.ts";

const LINE = "3부 예배 오후 2:00\n묵도";

function expectWorship(text: string) {
  assert.match(text, /3부 예배 오후 2:00/);
  assert.match(text, /묵도/);
  const parsed = parseBulletin(text, [], "2026-10-12");
  assert.equal(parsed.services.length, 1);
  assert.equal(parsed.services[0].type, "sunday-3");
  assert.equal(parsed.services[0].time, "14:00");
  assert.equal(parsed.services[0].items[0]?.title, "묵도");
}

function hwpRecord(tag: number, payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  const stored = payload.length < 4095 ? payload.length : 4095;
  header.writeUInt32LE((tag & 0x3ff) | (stored << 20), 0);
  if (payload.length < 4095) return Buffer.concat([header, payload]);
  const extra = Buffer.alloc(4);
  extra.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, extra, payload]);
}

function hwpParagraph(text: string, prefix = Buffer.alloc(0)): Buffer {
  const body = Buffer.concat([prefix, Buffer.from(`${text}\r`, "utf16le")]);
  const paraHeader = Buffer.alloc(8);
  paraHeader.writeUInt32LE([...text].length + prefix.length / 2 + 1, 0);
  return Buffer.concat([hwpRecord(0x42, paraHeader), hwpRecord(0x43, body)]);
}

function hwpFile(section: Buffer, compressed: boolean): Buffer {
  const header = Buffer.alloc(256);
  header.write("HWP Document File", 0, "ascii");
  header.writeUInt32LE(compressed ? 1 : 0, 36);
  const container = CFB.utils.cfb_new();
  CFB.utils.cfb_add(container, "FileHeader", header);
  CFB.utils.cfb_add(container, "DocInfo", compressed ? deflateSync(Buffer.alloc(0)) : Buffer.alloc(0));
  CFB.utils.cfb_add(container, "BodyText/Section0", compressed ? deflateSync(section) : section);
  return Buffer.from(CFB.write(container, { type: "buffer" }));
}

function wordFile(text: Buffer, characters: number, unicode: boolean): Buffer {
  const fib = Buffer.alloc(0x200);
  fib.writeUInt16LE(0xa5ec, 0);
  fib.writeUInt16LE(0x0200, 0x0a);
  const textAt = 0x200;
  fib.writeUInt32LE(textAt, 0x18);
  fib.writeUInt32LE(characters, 0x4c);
  fib.writeUInt32LE(0, 0x1a2);
  const table = Buffer.alloc(21);
  table.writeUInt8(2, 0);
  table.writeUInt32LE(16, 1);
  table.writeUInt32LE(0, 5);
  table.writeUInt32LE(characters, 9);
  const filePos = unicode ? textAt : (textAt * 2) | 0x40000000;
  table.writeUInt32LE(filePos, 15);
  const container = CFB.utils.cfb_new();
  CFB.utils.cfb_add(container, "WordDocument", Buffer.concat([fib, text]));
  CFB.utils.cfb_add(container, "1Table", table);
  return Buffer.from(CFB.write(container, { type: "buffer" }));
}

function pdfFile(text: string): Buffer {
  const mapping = new Map<string, string>();
  let y = 760;
  const ops = ["BT", "/F1 18 Tf"];
  for (const line of text.split("\n")) {
    const hex = [...line]
      .map((char) => {
        const code = char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
        mapping.set(code, code);
        return code;
      })
      .join("");
    ops.push(`1 0 0 1 72 ${y} Tm <${hex}> Tj`);
    y -= 28;
  }
  ops.push("ET");
  const stream = ops.join("\n");
  const pairs = [...mapping.keys()].map((code) => `<${code}> <${code}>`).join("\n");
  const cmap = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${mapping.size} beginbfchar
${pairs}
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type0 /BaseFont /Hangul /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 7 0 R >>",
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Hangul /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 8 0 R /DW 1000 /CIDToGIDMap /Identity >>",
    `<< /Length ${Buffer.byteLength(cmap)} >>\nstream\n${cmap}\nendstream`,
    "<< /Type /FontDescriptor /FontName /Hangul /Flags 4 /FontBBox [0 -200 1000 800] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

describe("new bulletin files", () => {
  it("reads a minimal hwp, including a compressed file and an inline control", async () => {
    const section = Buffer.concat(LINE.split("\n").map((line) => hwpParagraph(line)));
    expectWorship(await extractUploadedText("주보.hwp", hwpFile(section, false)));
    expectWorship(await extractUploadedText("주보.hwp", hwpFile(section, true)));
    const control = Buffer.alloc(16);
    control.writeUInt16LE(0x0b, 0);
    const withControl = hwpParagraph("묵도", control);
    assert.match(await extractUploadedText("주보.hwp", hwpFile(Buffer.concat([hwpParagraph("3부 예배 오후 2:00"), withControl]), true)), /묵도/);
  });

  it("reads a minimal unicode doc and a cp949 doc", async () => {
    const unicode = Buffer.from(LINE.replace(/\n/g, "\r"), "utf16le");
    expectWorship(await extractUploadedText("주보.doc", wordFile(unicode, unicode.length / 2, true)));
    const cp949 = Buffer.from("33bace20bfb9b9e820bfc0c8c420323a30300db9acb5b50d", "hex");
    expectWorship(await extractUploadedText("주보.doc", wordFile(cp949, cp949.length, false)));
  });

  it("reads a minimal pdf", async () => {
    expectWorship(await extractUploadedText("주보.pdf", pdfFile(LINE)));
  });

  it("reads a minimal rtf without the font table", async () => {
    const unicode = "{\\rtf1\\ansi\\uc1{\\fonttbl{\\f0 Gulim;}}\\pard 3\\u48512? \\u50696?\\u48176? \\u50724?\\u54980? 2:00\\par\\u47925?\\u46020?\\par}";
    const cp949 = "{\\rtf1\\ansi\\ansicpg949\\uc1{\\fonttbl{\\f0 Gulim;}}\\pard\\'33\\'ba\\'ce \\'bf\\'b9\\'b9\\'e8 \\'bf\\'c0\\'c8\\'c4 2:00\\par\\'b9\\'ac\\'b5\\'b5\\par}";
    const fromUnicode = await extractUploadedText("주보.rtf", Buffer.from(unicode, "ascii"));
    const fromCp949 = await extractUploadedText("주보.rtf", Buffer.from(cp949, "ascii"));
    expectWorship(fromUnicode);
    expectWorship(fromCp949);
    assert.equal(fromUnicode.includes("Gulim"), false);
  });

  it("reads a minimal odt", async () => {
    const zip = new JSZip();
    zip.file(
      "content.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
        <office:body><office:text>
          <text:p>3부 예배 오후 2:00</text:p>
          <text:p>묵도</text:p>
        </office:text></office:body>
      </office:document-content>`,
    );
    expectWorship(await extractUploadedText("주보.odt", await zip.generateAsync({ type: "nodebuffer" })));
  });

  it("reads a minimal html file and ignores the title and script", async () => {
    const html = `<!DOCTYPE html><html><head><title>숨김</title><style>p{}</style></head><body><script>비밀가사</script><p>3부 예배 오후 2:00</p><p>묵도</p></body></html>`;
    const text = await extractUploadedText("주보.html", Buffer.from(html, "utf8"));
    expectWorship(text);
    assert.equal(text.includes("숨김"), false);
    assert.equal(text.includes("비밀가사"), false);
    const encoded = Buffer.concat([
      Buffer.from('<html><head><meta charset="euc-kr"></head><body><p>', "ascii"),
      Buffer.from("33bace20bfb9b9e820bfc0c8c420323a3030", "hex"),
      Buffer.from("</p><p>", "ascii"),
      Buffer.from("b9acb5b5", "hex"),
      Buffer.from("</p></body></html>", "ascii"),
    ]);
    expectWorship(await extractUploadedText("주보.htm", encoded));
  });

  it("lists the formats the screen can actually open", () => {
    const note = bulletinFormatNote();
    const accept = bulletinAccept();
    for (const format of ["TXT", "DOC", "DOCX", "HWP", "HWPX", "PDF", "RTF", "ODT", "HTML"]) assert.match(note, new RegExp(format));
    assert.match(accept, /\.pdf/);
    assert.match(accept, /\.hwp/);
    assert.match(accept, /\.doc[,\s]/);
    if (canReadKoreanImages()) {
      assert.match(note, /JPG, PNG, WEBP/);
      assert.match(accept, /\.webp/);
    } else {
      assert.equal(note.includes("JPG"), false);
      assert.equal(accept.includes(".png"), false);
    }
  });

  it("reads a worship line from jpg, png, and webp when local korean ocr exists", async () => {
    if (!canReadKoreanImages()) return;
    const dir = path.join(import.meta.dirname, "fixtures");
    expectWorship(await extractUploadedText("주보.png", readFileSync(path.join(dir, "worship-line.png"))));
    expectWorship(await extractUploadedText("주보.jpg", readFileSync(path.join(dir, "worship-line.jpg"))));
    expectWorship(await extractUploadedText("주보.webp", readFileSync(path.join(dir, "worship-line.webp"))));
  });
});
