import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canDecideGuide, matchGuidePlace, type GuidePlace } from "@/guide/match";

const church: GuidePlace = {
  kind: "church",
  id: "church-1",
  communityId: "community-1",
  name: "서귀포제일교회",
  creatorEmail: "pastor@example.com",
};

const other: GuidePlace = {
  kind: "church",
  id: "church-2",
  communityId: "community-1",
  name: "위미교회",
  creatorEmail: "wimi@example.com",
};

const gathering: GuidePlace = {
  kind: "gathering",
  id: "group-1",
  communityId: "community-1",
  name: "서귀포청년연합",
  creatorEmail: null,
};

describe("안내 메일 교회 맞추기", () => {
  it("제목에 교회 이름이 있으면 그 교회입니다", () => {
    const found = matchGuidePlace({
      subject: "서귀포제일교회 주보",
      body: "",
      fileName: "",
      fromEmail: "person@example.com",
      places: [church, other, gathering],
    });
    assert.equal(found?.id, church.id);
  });

  it("파일 이름에 교회 줄기만 있어도 그 교회입니다", () => {
    const found = matchGuidePlace({
      subject: "이번 주",
      body: "",
      fileName: "TalkFile_서귀포제일_주보.hwp",
      fromEmail: "",
      places: [church, other],
    });
    assert.equal(found?.id, church.id);
  });

  it("모들 이름이 본문에 있으면 그 모들입니다", () => {
    const found = matchGuidePlace({
      subject: "큐시트",
      body: "서귀포청년연합 순서",
      fileName: "queue.txt",
      fromEmail: "",
      places: [church, gathering],
    });
    assert.equal(found?.id, gathering.id);
  });

  it("두 교회 이름이 같이 있으면 맞추지 않습니다", () => {
    const found = matchGuidePlace({
      subject: "한라교회 위미교회",
      body: "",
      fileName: "",
      fromEmail: "",
      places: [
        { ...other, name: "한라교회", id: "church-3" },
        other,
      ],
    });
    assert.equal(found, null);
  });

  it("짧은 이름만으로는 맞추지 않습니다", () => {
    const found = matchGuidePlace({
      subject: "교회 주보",
      body: "",
      fileName: "",
      fromEmail: "",
      places: [{ ...other, name: "교회", id: "short" }],
    });
    assert.equal(found, null);
  });

  it("보낸 사람이 한 곳의 담당이면 그 곳입니다", () => {
    const found = matchGuidePlace({
      subject: "파일",
      body: "예배 순서",
      fileName: "note.txt",
      fromEmail: "Wimi@example.com",
      places: [church, other],
    });
    assert.equal(found?.id, other.id);
  });

  it("이름과 보낸 사람이 서로 다른 곳이면 맞추지 않습니다", () => {
    const found = matchGuidePlace({
      subject: "서귀포제일교회 주보",
      body: "",
      fileName: "",
      fromEmail: "wimi@example.com",
      places: [church, other],
    });
    assert.equal(found, null);
  });
});

describe("안내 승인 권한", () => {
  it("운영자는 못 맞춘 메일도 승인합니다", () => {
    assert.equal(canDecideGuide({ operator: true, creator: false, matched: false }), true);
  });

  it("담당은 맞춰진 곳만 승인합니다", () => {
    assert.equal(canDecideGuide({ operator: false, creator: true, matched: true }), true);
    assert.equal(canDecideGuide({ operator: false, creator: true, matched: false }), false);
    assert.equal(canDecideGuide({ operator: false, creator: false, matched: true }), false);
  });
});
