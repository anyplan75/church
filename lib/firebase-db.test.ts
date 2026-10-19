import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDatabaseUrl } from "./firebase-db";

describe("firebase-db 공개 읽기 URL", () => {
  it("토큰이 없으면 auth 쿼리를 붙이지 않습니다", () => {
    assert.equal(buildDatabaseUrl("https://example.test/church/churchIndex.json", ""), "https://example.test/church/churchIndex.json");
  });

  it("토큰이 있으면 auth 쿼리를 붙입니다", () => {
    assert.equal(
      buildDatabaseUrl("https://example.test/church/churchIndex.json", "tok"),
      "https://example.test/church/churchIndex.json?auth=tok",
    );
  });

  it("공개 shallow 조회는 auth 없이 shallow 만 붙입니다", () => {
    assert.equal(
      buildDatabaseUrl("https://example.test/church/churches.json", "", "shallow=true"),
      "https://example.test/church/churches.json?shallow=true",
    );
  });
});
