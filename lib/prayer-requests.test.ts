import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPrayerRequest,
  canManagePrayers,
  canSeePastorInbox,
  cleanPrayerText,
  prayerCreateError,
  prayerFromRaw,
  prayerPath,
  prayerStatusLabel,
  prayersFromMap,
} from "./prayer-requests.ts";

describe("prayer-requests", () => {
  it("cleans text and rejects too-short prayer", () => {
    assert.equal(cleanPrayerText("  가족   건강  "), "가족 건강");
    assert.equal(prayerCreateError("아"), "기도제목을 두 글자 이상 적어 주세요.");
    assert.equal(prayerCreateError("가족 건강을 위해"), null);
  });

  it("builds a create payload under church path helpers", () => {
    const row = buildPrayerRequest({
      authorUid: "uid-1",
      authorEmail: "Member@Church.ORG",
      authorName: "김성도",
      pastorUid: "pastor-1",
      pastorName: "김목사",
      text: "  환우를 위해 기도해 주세요.  ",
      serviceId: "svc-1",
      serviceTitle: "주일예배",
      createdAt: 1_700_000_000_000,
    });
    assert.equal(row.authorEmail, "member@church.org");
    assert.equal(row.text, "환우를 위해 기도해 주세요.");
    assert.equal(row.pastorUid, "pastor-1");
    assert.equal(row.status, "new");
    assert.match(row.id, /^pr_/);
    assert.equal(prayerPath("cabc123", row.id), `churches/cabc123/prayerRequests/${row.id}`);
  });

  it("parses map and sorts newest first", () => {
    const list = prayersFromMap({
      pr_old123456: {
        authorUid: "a",
        authorEmail: "a@c.org",
        text: "오래된 기도",
        createdAt: 100,
        updatedAt: 100,
        status: "prayed",
      },
      pr_new123456: {
        authorUid: "b",
        authorEmail: "b@c.org",
        text: "새 기도제목",
        createdAt: 200,
        updatedAt: 200,
        status: "new",
      },
      bad: { text: "x" },
    });
    assert.equal(list.length, 2);
    assert.equal(list[0]?.id, "pr_new123456");
    assert.equal(list[1]?.status, "prayed");
    assert.equal(prayerFromRaw("nope", null), null);
  });

  it("limits pastor inbox roles and labels status", () => {
    assert.equal(canManagePrayers(["view"]), false);
    assert.equal(canManagePrayers(["admin"]), true);
    assert.equal(canManagePrayers(["prepare", "view"]), true);
    assert.equal(canManagePrayers(["run"]), true);
    assert.equal(prayerStatusLabel("new"), "새 기도");
    assert.equal(prayerStatusLabel("prayed"), "기도함");
    const row = buildPrayerRequest({
      authorUid: "m1",
      authorEmail: "m@c.org",
      pastorUid: "p1",
      text: "건강을 위해",
    });
    assert.equal(canSeePastorInbox({ id: "p1", roles: ["view"] }, row), true);
    assert.equal(canSeePastorInbox({ id: "other", roles: ["admin"] }, row), false);
    assert.equal(canSeePastorInbox({ id: "admin1", roles: ["admin"] }, row, "admin1"), false);
    assert.equal(
      canSeePastorInbox({ id: "admin1", roles: ["admin"] }, { ...row, pastorUid: "" }, "admin1"),
      true,
    );
  });
});
