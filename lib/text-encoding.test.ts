import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeLocalText } from "./text-encoding.ts";

const SAMPLE = "한글 확인";
const CP949 = Uint8Array.from([0xc7, 0xd1, 0xb1, 0xdb, 0x20, 0xc8, 0xae, 0xc0, 0xce]);

describe("로컬 텍스트 인코딩", () => {
  it("UTF-8이 아니면 CP949로 읽고 대체문자는 남기지 않는다", () => {
    assert.equal(decodeLocalText(CP949), SAMPLE);
    assert.equal(decodeLocalText(CP949).includes("\uFFFD"), false);
    assert.equal(decodeLocalText(new TextEncoder().encode("찬송 150")), "찬송 150");
  });

  it("CP949로도 읽히지 않으면 UTF-16으로 읽는다", () => {
    const utf16 = Uint8Array.from([0xff, 0xfe, 0x5c, 0xd5, 0x00, 0xae, 0x20, 0x00, 0x55, 0xd6, 0x78, 0xc7]);
    assert.equal(decodeLocalText(utf16), SAMPLE);
    const bare = utf16.subarray(2);
    assert.equal(decodeLocalText(bare), SAMPLE);
    assert.equal(decodeLocalText(Uint8Array.from([0xff, 0x80, 0x81])).includes("\uFFFD"), false);
  });
});
