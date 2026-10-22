import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captionUrlError, linesFromCaptionBody, selectableCaptionLanguages } from "@/worship/caption-links";

describe("예배 자막 링크", () => {
  it("링크가 없는 언어는 고를 수 없습니다", () => {
    const choices = selectableCaptionLanguages([
      { code: "ko", url: "" },
      { code: "en", url: "https://caption.example/en.json" },
      { code: "zh", url: "http://caption.example/zh" },
    ]);
    assert.deepEqual(
      choices.map((item) => item.code),
      ["en"],
    );
  });

  it("https 가 아닌 주소와 집 안 주소는 거절합니다", () => {
    assert.equal(captionUrlError(""), null);
    assert.equal(captionUrlError("http://caption.example/ko"), "자막 링크는 https 주소만 됩니다.");
    assert.equal(captionUrlError("https://localhost/ko"), "그 자막 링크는 연결할 수 없습니다.");
    assert.equal(captionUrlError("https://192.168.0.8/ko"), "그 자막 링크는 연결할 수 없습니다.");
  });

  it("번역기 응답의 줄만 자막으로 씁니다", () => {
    assert.deepEqual(linesFromCaptionBody('{"lines":["  하나  ","둘"]}', "application/json"), ["하나", "둘"]);
    assert.deepEqual(linesFromCaptionBody("<p>숨김</p>", "text/html"), []);
  });
});
