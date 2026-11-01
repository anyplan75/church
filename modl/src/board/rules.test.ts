import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanBoardPost, memberCanWrite } from "@/board/rules";

describe("게시판 글", () => {
  it("제목과 내용이 있으면 글을 받습니다", () => {
    const result = cleanBoardPost("  이번 주 나눔  ", "  식사는 본당 앞에서 합니다.  ");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.title, "이번 주 나눔");
    assert.equal(result.body, "식사는 본당 앞에서 합니다.");
  });

  it("제목만 있으면 받지 않습니다", () => {
    const result = cleanBoardPost("제목", "  ");
    assert.equal(result.ok, false);
  });

  it("구성원만 그 교회와 그 모들에 글을 씁니다", () => {
    const churches = new Set(["church-1"]);
    const gatherings = new Set(["group-1"]);
    assert.equal(memberCanWrite("church", "church-1", churches, gatherings), true);
    assert.equal(memberCanWrite("church", "church-2", churches, gatherings), false);
    assert.equal(memberCanWrite("gathering", "group-1", churches, gatherings), true);
    assert.equal(memberCanWrite("gathering", "group-2", churches, gatherings), false);
  });
});
