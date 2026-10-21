import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySharedCaptionsToDb,
  isModuleId,
  makeModuleId,
  normalizeSharedBulletin,
  normalizeSharedCaptions,
  shouldApplySharedBulletin,
} from "./modules.ts";
import type { Db, Service } from "./types.ts";

function service(partial: Partial<Service>): Service {
  return {
    id: partial.id ?? "svc",
    title: partial.title ?? "예배",
    date: partial.date ?? "2026-10-21",
    time: partial.time ?? "11:00",
    place: partial.place ?? "본당",
    notes: "",
    type: "sunday-2",
    preacherId: null,
    status: partial.status ?? "planning",
    items: [],
    announcements: [],
    liveIndex: 0,
    startedAt: null,
    checks: {},
    source: "manual",
    outputLines: partial.outputLines,
  };
}

function emptyDb(services: Service[]): Db {
  return {
    settings: { churchName: "A교회", backgroundColor: "#1b3a32", backgroundFile: null, overlay: "bottom" },
    people: [],
    songs: [],
    services,
    reminders: [],
    departments: [],
    attendance: [],
    supplies: [],
    activity: [],
    visits: [],
  };
}

describe("모들(교회 연결)", () => {
  it("모들 ID는 m으로 시작한다", () => {
    assert.equal(isModuleId("mabcdef12"), true);
    assert.equal(isModuleId("cabcdef12"), false);
    assert.equal(isModuleId(makeModuleId()), true);
  });

  it("다른 교회 자막은 진행 중 예배에 반영한다", () => {
    const db = emptyDb([service({ id: "live", status: "live", outputLines: ["옛줄"] })]);
    const result = applySharedCaptionsToDb(
      db,
      {
        lines: ["새줄", "둘째"],
        serviceId: "other",
        serviceTitle: "예배",
        serviceDate: "2026-10-21",
        sourceChurchId: "cpeer0001",
        updatedAt: 10,
      },
      "cself0001",
    );
    assert.equal(result.changed, true);
    assert.deepEqual(db.services[0].outputLines, ["새줄", "둘째"]);
  });

  it("자기 교회가 올린 자막은 다시 받지 않는다", () => {
    const db = emptyDb([service({ id: "live", status: "live", outputLines: ["유지"] })]);
    const result = applySharedCaptionsToDb(
      db,
      {
        lines: ["무시"],
        serviceId: "live",
        serviceTitle: "예배",
        serviceDate: "2026-10-21",
        sourceChurchId: "cself0001",
        updatedAt: 10,
      },
      "cself0001",
    );
    assert.equal(result.changed, false);
    assert.deepEqual(db.services[0].outputLines, ["유지"]);
  });

  it("공유 주보는 새 시각일 때만 적용한다", () => {
    const shared = normalizeSharedBulletin({
      text: "주일 예배",
      sourceChurchId: "cpeer0001",
      updatedAt: 200,
    });
    assert.ok(shared);
    assert.equal(shouldApplySharedBulletin(shared!, "cself0001", 100), true);
    assert.equal(shouldApplySharedBulletin(shared!, "cself0001", 200), false);
    assert.equal(shouldApplySharedBulletin(shared!, "cpeer0001", 0), false);
  });

  it("공유 자막 정규화가 두 줄만 남긴다", () => {
    const captions = normalizeSharedCaptions({
      lines: [" 하나 ", "둘", "셋"],
      serviceId: "s1",
      serviceTitle: "예배",
      serviceDate: "2026-10-21",
      sourceChurchId: "cpeer0001",
      updatedAt: 1,
    });
    assert.deepEqual(captions?.lines, ["하나", "둘"]);
  });
});
