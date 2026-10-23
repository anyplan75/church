import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
});
