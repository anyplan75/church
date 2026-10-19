import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createBlock,
  kakaoConfigFromEnv,
  moveBlock,
  nextShareState,
  parseBlocks,
  publicShareFields,
  safeScoreUrl,
} from "@/bulletin/blocks";

const order = createBlock("order", "order-1");
const sermon = createBlock("sermon", "sermon-1");
const announcement = createBlock("announcement", "news-1");

describe("블록 순서", () => {
  it("한 칸 아래로 옮기면 두 블록의 자리가 바뀝니다", () => {
    const moved = moveBlock([order, sermon, announcement], 0, 1);
    assert.deepEqual(
      moved.map((block) => block.id),
      ["sermon-1", "order-1", "news-1"],
    );
    assert.deepEqual(
      [order, sermon, announcement].map((block) => block.id),
      ["order-1", "sermon-1", "news-1"],
    );
  });

  it("맨 위에서는 더 올라가지 않고 맨 아래에서는 더 내려가지 않습니다", () => {
    const blocks = [order, announcement];
    assert.deepEqual(
      moveBlock(blocks, 0, -1).map((block) => block.id),
      ["order-1", "news-1"],
    );
    assert.deepEqual(
      moveBlock(blocks, 1, 1).map((block) => block.id),
      ["order-1", "news-1"],
    );
  });

  it("저장한 배열 순서를 그대로 읽습니다", () => {
    const parsed = parseBlocks([
      { id: "b", type: "announcement", body: "점심" },
      { id: "a", type: "order", items: [{ id: "i", label: "입례", detail: "" }] },
    ]);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(
      parsed.blocks.map((block) => block.type),
      ["announcement", "order"],
    );
  });
});

describe("블록 검사", () => {
  it("모르는 종류와 주소 아닌 악보는 거절합니다", () => {
    assert.equal(parseBlocks([{ id: "x", type: "tree", body: "안 됨" }]).ok, false);
    const badScore = parseBlocks([
      { id: "p", type: "praise", songs: [{ id: "s", title: "찬양", scoreUrl: "javascript:alert(1)" }] },
    ]);
    assert.equal(badScore.ok, false);
    assert.equal(safeScoreUrl("https://example.com/score.png"), "https://example.com/score.png");
    assert.equal(safeScoreUrl("javascript:alert(1)"), null);
  });
});

describe("공개 주소", () => {
  const bulletin = {
    sermonTitle: "은혜의 주",
    worshipDate: "2026-10-25",
    preacher: "김사역",
    scriptureText: "요한복음 1:1",
    isPublic: true,
    shareToken: "token-public",
  };

  it("공개이고 표식이 같으면 제목과 설명을 줍니다", () => {
    const fields = publicShareFields(bulletin, "token-public");
    assert.equal(fields?.title, "은혜의 주");
    assert.match(fields?.description ?? "", /2026-10-25/);
    assert.match(fields?.description ?? "", /김사역/);
  });

  it("표식이 없거나 다르거나 비공개면 내용을 주지 않습니다", () => {
    assert.equal(publicShareFields(null, "token-public"), null);
    assert.equal(publicShareFields(bulletin, ""), null);
    assert.equal(publicShareFields(bulletin, "other"), null);
    assert.equal(publicShareFields({ ...bulletin, isPublic: false }, "token-public"), null);
    assert.equal(publicShareFields({ ...bulletin, shareToken: null, isPublic: true }, "token-public"), null);
  });
});

describe("발행 표식", () => {
  it("저장은 표식을 만들지 않고 발행할 때 한 번만 만듭니다", () => {
    const draft = nextShareState({ isPublic: false, shareToken: null }, "save", () => "new-token");
    assert.deepEqual(draft, { isPublic: false, shareToken: null });
    const published = nextShareState(draft, "publish", () => "new-token");
    assert.deepEqual(published, { isPublic: true, shareToken: "new-token" });
    const again = nextShareState(published, "publish", () => "another-token");
    assert.equal(again.shareToken, "new-token");
    const hidden = nextShareState(again, "unpublish", () => "ignored");
    assert.deepEqual(hidden, { isPublic: false, shareToken: "new-token" });
  });
});

describe("카카오 공유 설정", () => {
  it("키가 없으면 카카오 공유가 없다고 봅니다", () => {
    assert.equal(kakaoConfigFromEnv({}), null);
    assert.equal(kakaoConfigFromEnv({ KAKAO_JAVASCRIPT_KEY: "  " }), null);
  });

  it("키가 있으면 그 키만 쓰고 템플릿이 숫자가 아니면 템플릿은 비웁니다", () => {
    assert.deepEqual(kakaoConfigFromEnv({ KAKAO_JAVASCRIPT_KEY: " js-key " }), {
      javascriptKey: "js-key",
      templateId: null,
    });
    assert.deepEqual(
      kakaoConfigFromEnv({ KAKAO_JAVASCRIPT_KEY: "js-key", KAKAO_SHARE_TEMPLATE_ID: "12034" }),
      { javascriptKey: "js-key", templateId: "12034" },
    );
    assert.equal(
      kakaoConfigFromEnv({ KAKAO_JAVASCRIPT_KEY: "js-key", KAKAO_SHARE_TEMPLATE_ID: "abc" })?.templateId,
      null,
    );
  });
});
