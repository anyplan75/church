import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextGraceCount,
  ocrConfigFromEnv,
  questionLines,
  questionsFromOcrText,
  reflectionsAfterOwnSubmit,
  type ReflectionStamp,
} from "@/qt/rules";

const qtId = "qt-1";
const otherQt = "qt-2";

function stamp(id: string, memberId: string, createdAt: string, targetQt = qtId): ReflectionStamp {
  return { id, qtId: targetQt, memberId, createdAt };
}

describe("묵상 이후 알림", () => {
  const rows = [
    stamp("early", "member-2", "2026-10-20T00:00:00.000Z"),
    stamp("mine", "member-1", "2026-10-20T01:00:00.000Z"),
    stamp("same-time", "member-3", "2026-10-20T01:00:00.000Z"),
    stamp("later", "member-4", "2026-10-20T02:00:00.000Z"),
    stamp("other-qt", "member-5", "2026-10-20T03:00:00.000Z", otherQt),
  ];

  it("내 답이 없으면 알림이 비어 있습니다", () => {
    assert.deepEqual(reflectionsAfterOwnSubmit(rows, qtId, "member-9"), []);
  });

  it("내가 저장한 시각 이후의 다른 묵상만 보여 줍니다", () => {
    const notices = reflectionsAfterOwnSubmit(rows, qtId, "member-1");
    assert.deepEqual(
      notices.map((item) => item.id),
      ["later"],
    );
  });

  it("다른 말씀의 묵상은 알림에 넣지 않습니다", () => {
    const notices = reflectionsAfterOwnSubmit(rows, otherQt, "member-5");
    assert.deepEqual(notices, []);
  });
});

describe("은혜는 한 번만", () => {
  it("처음 누르면 1이 되고 다시 눌러도 그대로입니다", () => {
    const once = nextGraceCount(0, false);
    assert.equal(once, 1);
    assert.equal(nextGraceCount(once, true), 1);
  });
});

describe("사진 글 읽기", () => {
  it("열쇠가 없으면 설정을 만들지 않습니다", () => {
    assert.equal(ocrConfigFromEnv({}), null);
    assert.equal(ocrConfigFromEnv({ QT_OCR_API_KEY: "   " }), null);
  });

  it("열쇠 글자가 있으면 그 값만 설정을 만듭니다", () => {
    assert.deepEqual(ocrConfigFromEnv({ QT_OCR_API_KEY: "present" }), { apiKey: "present" });
  });

  it("읽은 글이 없으면 본문과 질문을 지어내지 않습니다", () => {
    assert.deepEqual(questionsFromOcrText("  \n"), { body: "", questions: [] });
  });

  it("물음표 줄만 질문으로 나누고 나머지는 본문으로 둡니다", () => {
    const parsed = questionsFromOcrText("본문 한 줄\n오늘 무엇을 지키겠습니까?\n다음 줄");
    assert.equal(parsed.body, "본문 한 줄\n다음 줄");
    assert.deepEqual(parsed.questions, ["오늘 무엇을 지키겠습니까?"]);
  });

  it("질문 입력은 빈 줄을 버립니다", () => {
    assert.deepEqual(questionLines("첫째\n\n둘째"), ["첫째", "둘째"]);
  });
});
