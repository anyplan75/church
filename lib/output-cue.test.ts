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

  it("연결 전에는 이유만 짧게 보여 주고 폴더를 요구하지 않는다", () => {
    const waiting = outputHoldText("waiting");
    const retry = outputHoldText("retry");
    assert.equal(waiting.includes("미리보기"), false);
    assert.equal(retry.includes("미리보기"), false);
    assert.equal(waiting.includes("폴더"), false);
    assert.equal(retry.includes("폴더"), false);
    assert.equal(waiting.includes("직접 연결"), true);
    assert.equal(retry.includes("다시 연결"), true);
    assert.equal(retry.includes("끊"), false);
    const linked = outputHoldText("direct");
    assert.equal(linked.includes("두 줄"), true);
    assert.equal(linked.includes("연결되었습니다"), false);
    assert.equal(linked.includes("끊"), false);
    assert.equal(linked.includes("미리보기"), false);
    for (const status of ["no-ip", "no-signal", "unreachable"] as const) {
      const reason = outputHoldText(status);
      assert.equal(reason.includes("미리보기"), false);
      assert.equal(reason.includes("끊"), false);
      assert.equal(reason.split("\n").length, 1);
      assert.equal(reason.length > 0, true);
    }
    assert.equal(outputHoldText("no-ip").includes("설정에 송출 컴퓨터 IP"), true);
    assert.equal(outputHoldText("no-signal").includes("신호를 보내지 못했습니다"), true);
    assert.equal(outputHoldText("unreachable").includes("송출 컴퓨터 IP로 연결하지 못했습니다"), true);
  });
});
