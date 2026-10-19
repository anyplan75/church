import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_ROLES, can, canOpenPath, type Role } from "./roles.ts";
import { buildDesk } from "./slide-show.ts";
import { buildSeed } from "./seed.ts";
import {
  cueFromSlide,
  neighborSlides,
  presenterHref,
  presenterServiceChoices,
  resolvePresenterServiceId,
} from "./presenter.ts";

describe("프레젠터 예배 고르기", () => {
  it("진행 중 예배를 먼저 잡고, id가 맞으면 그 예배를 씁니다", () => {
    const db = buildSeed("2026-10-14");
    const live = db.services.find((service) => service.status !== "done")!;
    live.status = "live";
    assert.equal(resolvePresenterServiceId(db.services, "", "2026-10-14"), live.id);
    assert.equal(resolvePresenterServiceId(db.services, live.id, "2026-10-14"), live.id);
    assert.equal(resolvePresenterServiceId(db.services, "없는-id", "2026-10-14"), live.id);
    const choices = presenterServiceChoices(db.services, "2026-10-14");
    assert.equal(choices.some((service) => service.id === live.id), true);
    assert.equal(choices.every((service) => service.status !== "done"), true);
  });

  it("주소는 예배 id가 있을 때만 service 쿼리를 붙입니다", () => {
    assert.equal(presenterHref(), "/presenter/");
    assert.equal(presenterHref("service-sunday-2"), "/presenter/?service=service-sunday-2");
  });
});

describe("프레젠터 이전·다음 슬라이드", () => {
  it("목록·현재·다음·이전 큐가 송출용 lines와 맞습니다", () => {
    const db = buildSeed("2026-10-14");
    const service = db.services.find((item) => item.items.length > 2)!;
    const songItem = service.items.find((item) => item.songId);
    const local = songItem ? { [songItem.id]: ["첫째 화면\n둘째 줄", "다음 화면"] } : {};
    const desk = buildDesk(service, db.people, db.songs, local);
    assert.ok(desk.slides.length >= 2);

    const at0 = neighborSlides(desk.slides, 0);
    assert.equal(at0.prev, undefined);
    assert.equal(at0.current?.flat, 0);
    assert.ok(at0.next);
    assert.deepEqual(cueFromSlide(at0.next!), {
      groupIndex: at0.next!.groupIndex,
      inGroup: at0.next!.inGroup,
      lines: at0.next!.lines,
    });

    const at1 = neighborSlides(desk.slides, 1);
    assert.equal(at1.prev?.flat, 0);
    assert.equal(at1.current?.flat, 1);
    assert.equal(at1.next?.flat, 2);

    const lastFlat = desk.slides[desk.slides.length - 1]!.flat;
    const atEnd = neighborSlides(desk.slides, lastFlat);
    assert.equal(atEnd.next, undefined);
    assert.equal(atEnd.current?.flat, lastFlat);
    assert.ok(atEnd.prev);
  });
});

describe("프레젠터 권한", () => {
  it("진행 역할만 /presenter 를 열고, 보기만으로는 막습니다", () => {
    assert.equal(can(["run"] satisfies Role[], "screen.live"), true);
    assert.equal(canOpenPath(["run"], "/presenter"), true);
    assert.equal(canOpenPath(["run"], "/presenter/"), true);
    assert.equal(can(["view"] satisfies Role[], "screen.live"), false);
    assert.equal(canOpenPath(["view"], "/presenter"), false);
    assert.equal(canOpenPath(["output"], "/presenter"), false);
    assert.equal(canOpenPath(["prepare"], "/presenter"), false);
    assert.equal(canOpenPath(ALL_ROLES, "/presenter"), true);
  });
});
