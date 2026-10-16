import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cueLines, keepSlideSeq, outputHoldText, readSlideMessage, readSlidePacket, slideMessage } from "./output-cue.ts";

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
    const numbered = slideMessage("service-1", ["하늘이 맑다", "강이 잔잔하다"], 2);
    assert.equal(JSON.parse(numbered).seq, 2);
    assert.deepEqual(readSlidePacket(numbered, "service-1"), { seq: 2, lines: ["하늘이 맑다", "강이 잔잔하다"] });
    assert.deepEqual(keepSlideSeq(0, 2), { keep: true, seen: 2 });
    assert.deepEqual(keepSlideSeq(2, 2), { keep: true, seen: 2 });
    assert.deepEqual(keepSlideSeq(2, 1), { keep: false, seen: 2 });
    assert.deepEqual(keepSlideSeq(2, 0), { keep: false, seen: 2 });
  });

  it("송출 화면에는 실패 문장을 남기지 않는다", () => {
    for (const status of ["waiting", "retry", "direct", "no-ip", "no-signal", "unreachable"] as const) {
      const text = outputHoldText(status);
      assert.equal(text, "");
      assert.equal(text.includes("미리보기"), false);
      assert.equal(text.includes("받지 못했습니다"), false);
      assert.equal(text.includes("연결되었습니다"), false);
      assert.equal(text.includes("폴더"), false);
    }
  });
});
