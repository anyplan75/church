import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyTemplate, fileMatchesQuery, scriptureKey, splitSlides, textFileBody, libraryQuery } from "./local-library.ts";
import { buildDesk } from "./slide-show.ts";
import { buildSeed } from "./seed.ts";

describe("교회 컴퓨터 텍스트", () => {
  it("장 번호와 장절로 파일 이름을 맞추고 본문은 비워 둔다", () => {
    assert.equal(scriptureKey("이사야 40:28-31"), "이사야-40-28");
    assert.equal(fileMatchesQuery("찬송-28.txt", { kind: "hymn", title: "복의 근원", hymnNumber: "28", scripture: "" }), true);
    assert.equal(fileMatchesQuery("bible-이사야-40-28.txt", { kind: "bible", title: "성경봉독", hymnNumber: "", scripture: "이사야 40:28-31" }), true);
    assert.equal(fileMatchesQuery("다른노래.txt", { kind: "hymn", title: "복의 근원", hymnNumber: "28", scripture: "" }), false);
    const template = emptyTemplate({ kind: "bible", title: "성경봉독", hymnNumber: "", scripture: "히브리서 10:23-25" });
    assert.equal(template.bodyLabel, "본문");
    assert.equal(template.caption, "히브리서 10:23-25");
    const hymn = libraryQuery({ kind: "hymn", title: "찬송", scripture: "" }, { title: "복의 근원 강림하사", hymnNumber: "28" });
    assert.equal(hymn?.kind, "hymn");
    assert.equal(textFileBody(hymn!, "").includes("강림하사\n\n\n"), true);
  });

  it("찾은 글이 있을 때만 그룹 안 슬라이드를 나눈다", () => {
    const db = buildSeed("2026-10-14");
    const service = db.services.find((item) => item.items.some((entry) => entry.songId))!;
    const songItem = service.items.find((item) => item.songId)!;
    const plain = buildDesk(service, db.people, db.songs);
    assert.equal(plain.groups.length, service.items.length);
    assert.equal(plain.slides.length, service.items.length);
    const local = buildDesk(service, db.people, db.songs, { [songItem.id]: ["첫째 화면", "둘째 화면"] });
    const group = local.groups.find((item) => item.itemId === songItem.id)!;
    assert.equal(group.count, 2);
    assert.equal(local.slides[group.start + 1]?.lines[0], "둘째 화면");
  });
});

describe("슬라이드 나누기", () => {
  it("빈 줄로만 슬라이드를 나누고 본문을 만들지 않는다", () => {
    assert.deepEqual(splitSlides("첫째\n\n둘째"), ["첫째", "둘째"]);
    assert.deepEqual(splitSlides("   "), []);
  });
});
