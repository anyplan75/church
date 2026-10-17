import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bibleBook, emptyTemplate, fileMatchesQuery, fileSlides, folderStatusText, libraryMatchText, libraryQuery, nameContains, passageFromBook, previewLine, readableLines, savedFileText, scriptureKey, searchedLabel, SLIDE_LINE, splitSlides, textFileBody, twoLineSlides, verseSlides } from "./local-library.ts";
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
    const edited = savedFileText("하늘이 맑다\r\n들이 푸르다\r");
    assert.equal(edited, "하늘이 맑다\n들이 푸르다\n");
    assert.equal(edited.includes("찬송"), false);
    assert.deepEqual(fileSlides(hymn!, edited), ["하늘이 맑다\n들이 푸르다"]);
  });

  it("찾은 글이 있을 때만 그룹 안 슬라이드를 나눈다", () => {
    const db = buildSeed("2026-10-14");
    const service = db.services.find((item) => item.items.some((entry) => entry.songId))!;
    const songItem = service.items.find((item) => item.songId)!;
    const plain = buildDesk(service, db.people, db.songs);
    assert.equal(plain.groups.length, service.items.length);
    assert.equal(plain.slides.length, service.items.length);
    const songSlide = plain.slides.find((slide) => slide.itemId === songItem.id);
    assert.equal((songSlide?.lines.length ?? 0) > 0, true);
    songItem.screenCue = "자리에 앉으십시오";
    const cued = buildDesk(service, db.people, db.songs);
    assert.equal(cued.slides.find((slide) => slide.itemId === songItem.id)?.lines[1], "자리에 앉으십시오");
    const local = buildDesk(service, db.people, db.songs, { [songItem.id]: ["첫째 화면", "둘째 화면"] });
    const group = local.groups.find((item) => item.itemId === songItem.id)!;
    assert.equal(group.count, 2);
    assert.equal(local.slides[group.start + 1]?.lines[0], "둘째 화면");
  });
});

describe("폴더와 주보 줄", () => {
  it("책 파일과 찬송가 장과 제목으로 찾을 이름을 보여 주고 첫 줄만 남긴다", () => {
    assert.equal(bibleBook("신명기 32장 3-4절"), "신명기");
    assert.equal(bibleBook("삿20:29-48"), "삿");
    assert.equal(scriptureKey("이사야 40:28-31"), "이사야-40-28");
    const bible = libraryQuery({ kind: "scripture", title: "성경봉독", scripture: "신명기 32장 3-4절" }, null);
    assert.equal(bible?.kind, "bible");
    assert.equal(searchedLabel(bible!), "신명기.txt");
    assert.equal(fileMatchesQuery("신명기.txt", bible!), true);
    assert.equal(searchedLabel({ kind: "hymn", title: "찬송", hymnNumber: "455", scripture: "" }), "찬송가455장");
    assert.equal(fileMatchesQuery("찬송가 455장.txt", { kind: "hymn", title: "찬송", hymnNumber: "455", scripture: "" }), true);
    assert.equal(searchedLabel({ kind: "praise", title: "위드엘 찬양단", hymnNumber: "", scripture: "" }), "위드엘찬양단");
    assert.equal(previewLine("첫째 줄\n둘째 줄은 화면에 두지 않습니다\n"), "첫째 줄");
    assert.equal(previewLine("\n\n"), "");
    assert.equal(folderStatusText({ state: "connected", folderName: "성경", txtCount: 2, names: ["창세기.txt", "출애굽기.txt"] }), "연결됨 · 성경 · txt 2개 · 창세기.txt, 출애굽기.txt");
    assert.equal(folderStatusText({ state: "connected", folderName: "찬송가", txtCount: 0, names: [] }), "연결됨 · 찬송가 · txt 파일이 없습니다.");
    assert.equal(folderStatusText({ state: "reconnect", folderName: "찬양", txtCount: 0, names: [] }), "찬양 폴더 권한이 없습니다. 다시 연결해 주세요.");
    assert.equal(folderStatusText({ state: "idle", folderName: "", txtCount: 0, names: [] }), "아직 연결하지 않았습니다.");
  });
});

describe("예배 폴더", () => {
  it("책 파일에서 주보의 장절만 고르고 맞는 파일은 준비됨으로 표시한다", () => {
    const book = "1장\n1 다른장\n3장\n1 삼장하나\n2 삼장둘\n4장\n1 끝";
    assert.deepEqual(passageFromBook(book, "야고보서 3:1-2"), ["삼장하나", "삼장둘"]);
    assert.deepEqual(passageFromBook("3:1 하나\n3:2 둘\n4:1 셋", "야고보서 3:1-2"), ["하나", "둘"]);
    assert.deepEqual(passageFromBook("32장\n3 가\n4 나\n33장\n1 다", "신명기 32장 3-4절"), ["가", "나"]);
    assert.deepEqual(passageFromBook("신32:3 하늘\n신32:4 바다\n신33:1 산", "신명기 32장 3-4절"), ["하늘", "바다"]);
    assert.deepEqual(passageFromBook("32장 3절 하늘\n32장 4절 바다", "신명기 32장 3-4절"), ["하늘", "바다"]);
    assert.deepEqual(passageFromBook("32장\n<3> 하늘\n<4> 바다\n33장\n<1> 산", "신명기 32장 3-4절"), ["하늘", "바다"]);
    const query = { kind: "bible" as const, title: "성경봉독", hymnNumber: "", scripture: "야고보서 3:1-2" };
    assert.deepEqual(fileSlides(query, book), ["삼장하나", "삼장둘"]);
    const longVerse = "가".repeat(SLIDE_LINE * 2 + 4);
    const verseBook = `3장\n1 ${longVerse}\n2 산이 높다`;
    const verseSlidesOut = fileSlides(query, verseBook);
    assert.equal(verseSlidesOut.length, 3);
    assert.equal(verseSlidesOut[verseSlidesOut.length - 1], "산이 높다");
    assert.equal(verseSlidesOut.slice(0, -1).every((slide) => slide.includes("산이") === false), true);
    assert.equal(verseSlidesOut.every((slide) => slide.split("\n").length <= 2), true);
    assert.deepEqual(verseSlides(["하늘이 맑다", "들이 푸르다"]), ["하늘이 맑다", "들이 푸르다"]);
    assert.deepEqual(fileSlides({ kind: "hymn", title: "찬송", hymnNumber: "44", scripture: "" }, "하늘이 맑다\n들이 푸르다\n강이 흐른다\n산이 높다"), ["하늘이 맑다\n들이 푸르다", "강이 흐른다\n산이 높다"]);
    const wrapped = "가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하";
    assert.equal(readableLines(wrapped).length >= 3, true);
    assert.equal(readableLines(wrapped).every((line) => line.length <= SLIDE_LINE), true);
    assert.equal(twoLineSlides(wrapped).length > 1, true);
    assert.equal(twoLineSlides(wrapped).every((slide) => slide.split("\n").length <= 2), true);
    assert.deepEqual(fileSlides({ kind: "praise", title: "찬양", hymnNumber: "", scripture: "" }, "하늘이 맑다\n들이 푸르다\n강이 흐른다"), ["하늘이 맑다\n들이 푸르다", "강이 흐른다"]);
    assert.equal(libraryMatchText("찬송가44장.txt", "찬송가44장"), "찬송가44장.txt · 준비됨");
    assert.equal(libraryMatchText(null, "신명기.txt"), "파일 없음 · 신명기.txt");
  });
});

describe("파일 이름 포함", () => {
  const bible = { kind: "bible" as const, title: "성경봉독", hymnNumber: "", scripture: "창세기 1:1" };
  const hymn = { kind: "hymn" as const, title: "찬송", hymnNumber: "150", scripture: "" };
  const praise = { kind: "praise" as const, title: "주님은 왕", hymnNumber: "", scripture: "" };
  it("앞의 숫자가 있어도 찾는 글자가 들어 있으면 맞는다", () => {
    assert.equal(fileMatchesQuery("01 창세기.txt", bible), true);
    assert.equal(fileMatchesQuery("001_창세기.txt", bible), true);
    assert.equal(fileMatchesQuery("150 찬송가150장.txt", hymn), true);
    assert.equal(fileMatchesQuery("0150 찬송가 150장.txt", hymn), true);
    assert.equal(fileMatchesQuery("01 주님은 왕.txt", praise), true);
    assert.equal(nameContains("001_창세기.txt", "창세기"), true);
    assert.equal(fileMatchesQuery("다른노래.txt", { kind: "hymn", title: "복의 근원", hymnNumber: "28", scripture: "" }), false);
    assert.equal(fileMatchesQuery("찬송가15장.txt", hymn), false);
  });
});

describe("슬라이드 나누기", () => {
  it("빈 줄로만 슬라이드를 나누고 본문을 만들지 않는다", () => {
    assert.deepEqual(splitSlides("첫째\n\n둘째"), ["첫째", "둘째"]);
    assert.deepEqual(splitSlides("   "), []);
  });
});
