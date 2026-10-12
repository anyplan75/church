import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { applyBulletin } from "./bulletin-apply.ts";
import { parseBulletin } from "./bulletin-parse.ts";
import { acceptReadyChecks, checkItems, missingRequired, type CheckContext } from "./checklist.ts";
import { extractUploadedText, textFromHwpxXml } from "./extract-text.ts";
import { dueAt, planReminders } from "./reminders.ts";
import { slidesFor } from "./slides.ts";
import type { Person, Service, Settings, Song } from "./types.ts";
import { normalizeService, templateItems } from "./worship.ts";

const LYRIC = "이것은 주보에 적힌 긴 가사 한 줄이라서 저장하면 안 된다";

const people: Person[] = [
  { id: "person-senior", name: "김은혜", roles: ["담임목사"], phone: "", active: true },
  { id: "person-elder", name: "이성실", roles: ["장로"], phone: "", active: true },
];

const settings: Settings = { churchName: "은혜교회", backgroundColor: "#1b3a32", backgroundFile: null, overlay: "bottom" };

function baseService(partial: Partial<Service> = {}): Service {
  return {
    id: "svc",
    title: "주일 1부 예배",
    date: "2026-10-18",
    time: "09:00",
    type: "sunday-1",
    place: "본당",
    preacherId: "person-senior",
    status: "planning",
    items: [],
    announcements: [],
    liveIndex: 0,
    startedAt: null,
    notes: "",
    checks: {},
    source: "manual",
    ...partial,
  };
}

describe("bulletin", () => {
  const text = `2026년 10월 18일 주일
1부 예배 오전 9:00
묵도
찬송 28장
${LYRIC}
사도신경
대표기도 이성실
성경봉독 히브리서 10:23-25
설교 다시 모인 자리에서 김은혜
봉헌
광고
- 새가족 환영회가 있습니다.
찬송 405장 이것은 아주 긴 가사처럼 보여서 곡명으로 저장하면 안 되는 줄
축도

2026년 10월 14일 수요일
수요 예배 오후 7:30
찬양
성경봉독 시편 23:1
말씀 기도의 자리 김은혜
축도`;

  it("reads every service in the week and drops lyrics", () => {
    const parsed = parseBulletin(text, people, "2026-10-12");
    assert.equal(parsed.services.length, 2);
    assert.ok(parsed.skippedLyrics >= 2);
    const sunday = parsed.services[0];
    assert.equal(sunday.date, "2026-10-18");
    assert.equal(sunday.time, "09:00");
    assert.equal(sunday.type, "sunday-1");
    assert.equal(sunday.items.find((item) => item.kind === "hymn")?.hymnNumber, "28");
    assert.equal(sunday.items.filter((item) => item.kind === "hymn")[1]?.songTitle, "");
    assert.equal(sunday.items.find((item) => item.title === "대표기도")?.personName, "이성실");
    assert.equal(sunday.items.find((item) => item.kind === "scripture")?.scripture, "히브리서 10:23-25");
    assert.equal(sunday.items.find((item) => item.kind === "sermon")?.note, "다시 모인 자리에서");
    assert.equal(sunday.preacherName, "김은혜");
    assert.deepEqual(sunday.announcements, ["새가족 환영회가 있습니다."]);
    assert.equal(JSON.stringify(parsed).includes(LYRIC), false);
    const wednesday = parsed.services[1];
    assert.equal(wednesday.type, "wednesday");
    assert.equal(wednesday.time, "19:30");
    assert.equal(wednesday.date, "2026-10-14");
  });

  it("stores titles and numbers only when applying a bulletin", () => {
    const db = {
      settings,
      people,
      songs: [{ id: "song-28", title: "복의 근원 강림하사", hymnNumber: "28", key: "F", license: "title-only" as const, permittedLine: "있으면 안 되는 가사" }],
      services: [baseService({ id: "service-sunday-1", status: "ready", source: "manual" })],
      reminders: [],
    };
    const result = applyBulletin(db, text, "2026-10-12");
    assert.equal(result.imported, 2);
    assert.equal(result.skippedLyrics >= 2, true);
    const sunday = db.services.find((service) => service.id === "service-sunday-1");
    assert.equal(sunday?.source, "bulletin");
    assert.equal(sunday?.status, "planning");
    assert.equal(sunday?.preacherId, "person-senior");
    const hymn = sunday?.items.find((item) => item.hymnNumber === undefined && item.kind === "hymn");
    assert.equal(hymn?.songId, "song-28");
    assert.equal(JSON.stringify(db).includes(LYRIC), false);
    assert.equal(JSON.stringify(sunday).includes("있으면 안 되는 가사"), false);
    const created = db.songs.find((song) => song.hymnNumber === "405");
    assert.equal(created?.license, "title-only");
    assert.equal(created?.permittedLine, "");
    assert.equal(created?.title, "찬송 405장");
  });
});

describe("slides", () => {
  const songs: Song[] = [
    { id: "song-28", title: "복의 근원 강림하사", hymnNumber: "28", key: "F", license: "title-only", permittedLine: "비밀 가사 한 줄" },
    { id: "song-ok", title: "짧은 후렴", hymnNumber: "", key: "", license: "permitted", permittedLine: "허가된 한 줄" },
  ];

  it("never shows an unlicensed line", () => {
    const service = baseService({
      items: [
        {
          id: "h1",
          kind: "hymn",
          title: "찬송",
          note: "",
          scripture: "",
          scriptureText: "본문이면 안 됨",
          scriptureLicensed: false,
          screenCue: "",
          personId: null,
          songId: "song-28",
        },
        {
          id: "p1",
          kind: "praise",
          title: "찬양",
          note: "",
          scripture: "",
          scriptureText: "",
          scriptureLicensed: false,
          screenCue: "",
          personId: null,
          songId: "song-ok",
        },
        {
          id: "s1",
          kind: "scripture",
          title: "성경봉독",
          note: "",
          scripture: "히브리서 10:23-25",
          scriptureText: "직접 확인한 짧은 본문",
          scriptureLicensed: true,
          screenCue: "",
          personId: "person-elder",
          songId: null,
        },
      ],
    });
    const slides = slidesFor(service, people, songs);
    assert.equal(JSON.stringify(slides[0]).includes("비밀 가사"), false);
    assert.equal(JSON.stringify(slides[0]).includes("본문이면 안 됨"), false);
    assert.equal(slides[0].heading, "28장 복의 근원 강림하사");
    assert.deepEqual(slides[0].lines, []);
    assert.equal(slides[0].footer, "가사 없이 제목만 표시");
    assert.equal(slides[1].lines[0], "허가된 한 줄");
    assert.equal(slides[2].heading, "히브리서 10:23-25");
    assert.equal(slides[2].lines[0], "직접 확인한 짧은 본문");
    assert.equal(slides[2].overlay.includes("직접 확인한"), false);
  });
});

describe("checklist", () => {
  it("keeps manual checks empty until a person marks them", () => {
    const items = templateItems("dawn").map((item, index) => ({ ...item, id: `i${index}` }));
    items[0] = { ...items[0], songId: "song-1" };
    items[1] = { ...items[1], personId: "person-elder" };
    items[2] = { ...items[2], scripture: "시편 5:3", personId: "person-elder" };
    items[3] = { ...items[3], personId: "person-senior", scripture: "시편 5:3", note: "아침의 기도" };
    items[4] = { ...items[4], personId: "person-senior" };
    const service = baseService({
      id: "dawn",
      type: "dawn",
      time: "05:30",
      source: "bulletin",
      preacherId: "person-senior",
      items,
    });
    const songs: Song[] = [{ id: "song-1", title: "찬송 1장", hymnNumber: "1", key: "", license: "title-only", permittedLine: "" }];
    const reminders = planReminders(service, people, "은혜교회", new Date("2026-10-12T00:00:00Z"));
    const ctx: CheckContext = { people, songs, settings, reminders };
    const states = checkItems(service, ctx);
    assert.equal(states.find((item) => item.id === "sound")?.ready, false);
    assert.equal(states.find((item) => item.id === "sermon")?.ready, true);
    assert.equal(states.find((item) => item.id === "remind-day")?.ready, true);
    const accepted = acceptReadyChecks(service, ctx);
    assert.equal(accepted.sound, undefined);
    assert.equal(accepted["remind-hour"], true);
    assert.equal(accepted.preview, undefined);
    assert.ok(missingRequired({ ...service, checks: accepted }, ctx).includes("음향"));
    assert.equal(missingRequired({ ...service, checks: { ...accepted, sound: true, music: true, display: true, ushers: true, preview: true } }, ctx).length, 0);
  });
});

describe("reminders", () => {
  it("schedules one day before and one hour before in Seoul time", () => {
    const service = baseService({ preacherId: "person-senior", items: [] });
    assert.equal(dueAt("2026-10-18", "09:00", 24), "2026-10-17T00:00:00.000Z");
    assert.equal(dueAt("2026-10-18", "09:00", 1), "2026-10-17T23:00:00.000Z");
    const planned = planReminders(service, people, "은혜교회", new Date("2026-10-12T00:00:00Z"));
    assert.equal(planned.length, 2);
    assert.equal(planned.every((reminder) => reminder.status === "scheduled"), true);
    assert.equal(JSON.stringify(planned).includes("장 "), false);
    const due = planReminders(service, people, "은혜교회", new Date("2026-10-17T00:00:00Z"));
    assert.equal(due.find((reminder) => reminder.kind === "day-before")?.status, "due");
    assert.equal(due.find((reminder) => reminder.kind === "hour-before")?.status, "scheduled");
  });
});

describe("files", () => {
  it("reads hwpx paragraphs and rejects a binary hwp", async () => {
    const xml = "<hp:p><hp:t>1부 예배</hp:t><hp:t> 오전 9:00</hp:t></hp:p><hp:p><hp:t>묵도</hp:t></hp:p>";
    assert.equal(textFromHwpxXml(xml), "1부 예배 오전 9:00\n묵도");
    const zip = new JSZip();
    zip.file("Contents/section0.xml", xml);
    const hwpx = await zip.generateAsync({ type: "nodebuffer" });
    assert.match(await extractUploadedText("주보.hwpx", hwpx), /묵도/);
    await assert.rejects(extractUploadedText("주보.hwp", Buffer.from("HWP Document File")), /HWPX/);
    const docx = new JSZip();
    docx.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    );
    docx.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    );
    docx.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>1부 예배 오전 9:00</w:t></w:r></w:p><w:p><w:r><w:t>묵도</w:t></w:r></w:p></w:body></w:document>`,
    );
    const word = await docx.generateAsync({ type: "nodebuffer" });
    assert.match(await extractUploadedText("주보.docx", word), /묵도/);
  });
});

describe("normalize", () => {
  it("drops scripture text that was not marked usable", () => {
    const normalized = normalizeService({
      ...baseService(),
      items: [
        {
          id: "s",
          kind: "scripture",
          title: "성경봉독",
          note: "",
          scripture: "요한복음 3:16",
          scriptureText: "본문 전문",
          scriptureLicensed: false,
          screenCue: "",
          personId: null,
          songId: null,
        },
      ],
    });
    assert.equal(normalized.items[0].scriptureText, "");
    assert.equal(normalized.items[0].scripture, "요한복음 3:16");
  });
});
