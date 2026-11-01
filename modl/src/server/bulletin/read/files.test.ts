import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as CFB from "cfb";
import { servicesFromBulletinText } from "@/bulletin/intake";
import { readBulletinFile } from "@/server/bulletin/read/files";
import { sniffImage } from "@/server/bulletin/read/image-kind";
import { resolveBulletinExtension, saveBulletinFile } from "@/server/bulletin/read/store";
import { unlink } from "node:fs/promises";
import path from "node:path";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]);

function heic(brand: string): Buffer {
  const bytes = Buffer.alloc(20);
  bytes.writeUInt32BE(20, 0);
  bytes.write("ftyp", 4, "ascii");
  bytes.write(brand, 8, "ascii");
  return bytes;
}

describe("주보 파일 읽기", () => {
  it("텍스트 파일의 글을 그대로 돌려줍니다", async () => {
    const read = await readBulletinFile("주보.txt", Buffer.from("주일예배\n묵도\n축도", "utf8"), async () => "없는 문장");
    assert.equal(read.kind, "text");
    if (read.kind === "text") assert.match(read.text, /묵도/);
  });

  it("사진에서 빈 글이 오면 문장을 만들지 않습니다", async () => {
    const read = await readBulletinFile("주보.png", png, async () => "");
    assert.deepEqual(read, { kind: "empty" });
  });

  it("사진에서 읽은 글만 사용합니다", async () => {
    const read = await readBulletinFile("주보.jpg", jpeg, async () => "주일예배\n설교 본문");
    assert.equal(read.kind, "text");
    if (read.kind === "text") assert.equal(read.text, "주일예배\n설교 본문");
  });

  it("확장자가 없는 275307도 사진이면 거절하지 않고 글을 읽습니다", async () => {
    assert.equal(sniffImage(jpeg), "jpg");
    assert.equal(resolveBulletinExtension("275307", jpeg), ".jpg");
    let seen = "";
    const read = await readBulletinFile("275307", jpeg, async (_bytes, kind) => {
      seen = kind;
      return "주일 2부 예배\n묵도\n축도";
    });
    assert.equal(seen, "jpg");
    assert.equal(read.kind, "text");
    if (read.kind === "text") assert.match(read.text, /묵도/);
  });

  it("png, webp, heic는 내용으로 사진이라고 판단합니다", () => {
    assert.equal(resolveBulletinExtension("사진없음", png), ".png");
    assert.equal(resolveBulletinExtension("사진없음", webp), ".webp");
    assert.equal(resolveBulletinExtension("275307", heic("heic")), ".heic");
    assert.equal(resolveBulletinExtension("예배.heif", heic("mif1")), ".heic");
    assert.equal(resolveBulletinExtension("275307", Buffer.from("주일예배")), null);
  });

  it("사진이 아닌 275307은 저장하지 않습니다", async () => {
    await assert.rejects(
      () => saveBulletinFile("275307", Buffer.from("주일예배")),
      /사진만 올릴 수 있습니다/,
    );
  });

  it("확장자 없는 사진은 jpg로 저장합니다", async () => {
    const href = await saveBulletinFile("275307", jpeg);
    assert.match(href, /^\/uploads\/\d+-[a-f0-9]+\.jpg$/);
    await unlink(path.join(process.cwd(), "public", href));
  });

  it("TalkFile_ 접두와 .hwp.hwp 이름을 한글로 읽고 십일조는 뺍니다", async () => {
    const name = "TalkFile_서귀포제일_주보_20261011_오순절 후 스무번째 주일.hwp.hwp";
    const lines = [
      "2026년 10월 11일",
      "주일 2부 예배 오전 11:00",
      "찬송 44장 지난 이레 동안에",
      "찬송 250장 구주의 십자가 보혈로",
      "신앙고백 사도신경",
      "성경봉독 민수기 21장 4-9절",
      "찬양 시온찬양대",
      "말씀 그것을 보면 살리라",
      "봉헌 150장 길보리산 위에",
      "축도 이종찬 목사",
      "교회소식",
      "- 새가족을 진심으로 환영합니다.",
      "- 정기제직회는 주일 2부예배 후에 있습니다.",
      "- 오늘은 이웃을 위한 헌금 봉헌주일입니다.",
    ];
    const file = hwpFile(Buffer.concat(lines.map((line) => hwpParagraph(line))));
    assert.equal(resolveBulletinExtension(name, file), ".hwp");
    const read = await readBulletinFile(name, file, async () => "없는 문장");
    assert.equal(read.kind, "text");
    if (read.kind !== "text") return;
    assert.match(read.text, /찬송 44장/);
    assert.match(read.text, /민수기 21장 4-9절/);
    let serial = 0;
    const services = servicesFromBulletinText(read.text, () => `id-${serial++}`);
    const packed = JSON.stringify(services);
    assert.match(packed, /주일 2부 예배/);
    assert.match(packed, /44장/);
    assert.match(packed, /250장/);
    assert.match(packed, /민수기 21장 4-9절/);
    assert.match(packed, /새가족을 진심으로 환영합니다/);
    assert.match(packed, /정기제직회는 주일 2부예배 후에 있습니다/);
    assert.equal(packed.includes("선한 목자"), false);
    assert.equal(packed.includes("십일조"), false);
    assert.equal(packed.includes("헌금"), false);
    assert.equal(packed.includes("봉헌"), false);
  });

  it("글이 아닌 .hwp.hwp 는 한글 읽기 실패로 돌려줍니다", async () => {
    await assert.rejects(
      () => readBulletinFile("TalkFile_주보.hwp.hwp", Buffer.from("not-a-hwp-file"), async () => ""),
      /한글 파일에서 글을 읽지 못했습니다/,
    );
  });
});

function hwpRecord(tag: number, payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  const stored = payload.length < 4095 ? payload.length : 4095;
  header.writeUInt32LE((tag & 0x3ff) | (stored << 20), 0);
  if (payload.length < 4095) return Buffer.concat([header, payload]);
  const extra = Buffer.alloc(4);
  extra.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, extra, payload]);
}

function hwpParagraph(text: string): Buffer {
  const body = Buffer.from(`${text}\r`, "utf16le");
  const paraHeader = Buffer.alloc(8);
  paraHeader.writeUInt32LE([...text].length + 1, 0);
  return Buffer.concat([hwpRecord(0x42, paraHeader), hwpRecord(0x43, body)]);
}

function hwpFile(section: Buffer): Buffer {
  const header = Buffer.alloc(256);
  header.write("HWP Document File", 0, "ascii");
  header.writeUInt32LE(0, 36);
  const container = CFB.utils.cfb_new();
  CFB.utils.cfb_add(container, "FileHeader", header);
  CFB.utils.cfb_add(container, "DocInfo", Buffer.alloc(0));
  CFB.utils.cfb_add(container, "BodyText/Section0", section);
  CFB.utils.cfb_add(container, "BinData/BIN0001", Buffer.alloc(8192, 1));
  return Buffer.from(CFB.write(container, { type: "buffer" }));
}
