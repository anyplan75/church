import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readBulletinFile } from "@/server/bulletin/read/files";

describe("주보 파일 읽기", () => {
  it("텍스트 파일의 글을 그대로 돌려줍니다", async () => {
    const read = await readBulletinFile("주보.txt", Buffer.from("주일예배\n묵도\n축도", "utf8"), async () => "없는 문장");
    assert.equal(read.kind, "text");
    if (read.kind === "text") assert.match(read.text, /묵도/);
  });

  it("사진에서 빈 글이 오면 문장을 만들지 않습니다", async () => {
    const read = await readBulletinFile("주보.png", Buffer.from([1, 2, 3]), async () => "");
    assert.deepEqual(read, { kind: "empty" });
  });

  it("사진에서 읽은 글만 사용합니다", async () => {
    const read = await readBulletinFile("주보.jpg", Buffer.from([1, 2, 3]), async () => "주일예배\n설교 본문");
    assert.equal(read.kind, "text");
    if (read.kind === "text") assert.equal(read.text, "주일예배\n설교 본문");
  });
});
