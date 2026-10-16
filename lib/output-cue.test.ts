import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cueLines, outputHoldText, readSlideMessage, slideMessage } from "./output-cue.ts";

describe("송출 두 줄", () => {
  it("지금 내보내는 두 줄만 남긴다", () => {
    assert.deepEqual(cueLines(["  하늘이 맑다  ", "들이 푸르다", "강이 흐른다"]), ["하늘이 맑다", "들이 푸르다"]);
    assert.deepEqual(cueLines(["", "  "]), []);
    assert.equal(cueLines(["가".repeat(120)])[0]?.length, 80);
  });

  it("직접 연결 메시지는 지금 슬라이드의 두 줄만 담는다", () => {
    const raw = slideMessage("service-1", ["하늘이 맑다", "들이 푸르다", "강은 보내지 않는다"]);
    assert.deepEqual(JSON.parse(raw), { serviceId: "service-1", lines: ["하늘이 맑다", "들이 푸르다"] });
    assert.equal(raw.includes("강은"), false);
    assert.deepEqual(readSlideMessage(raw, "service-1"), ["하늘이 맑다", "들이 푸르다"]);
    assert.equal(readSlideMessage(raw, "other"), null);
    assert.equal(readSlideMessage("not-json", "service-1"), null);
  });

  it("연결 전에는 이유만 짧게 보여 주고 폴더를 요구하지 않는다", () => {
    const waiting = outputHoldText("waiting");
    const retry = outputHoldText("retry");
    assert.equal(waiting.includes("미리보기"), false);
    assert.equal(retry.includes("미리보기"), false);
    assert.equal(waiting.includes("폴더"), false);
    assert.equal(retry.includes("폴더"), false);
    assert.equal(waiting.includes("직접 연결"), true);
    assert.equal(retry.includes("다시 연결"), true);
  });
});
