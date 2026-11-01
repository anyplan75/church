import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BULLETIN_PART_MAX, fieldsFromBulletinText, sectionAssignBroken, servicesFromBulletinText } from "@/bulletin/intake";

const text = `2026년 10월 11일
주일찬양예배 오후 2:00
인도 최승원 목사
찬양 위드엘 찬양단
기도 구영준 안수집사
성경봉독 야고보서 3:1-6
설교 그것을 보면 살리라
찬송 455장 주님의 마음을 본받는 자
봉헌 인도자
축도 최승원 목사
교회소식
- 새가족을 환영합니다.
- 제직회는 예배 후에 있습니다.`;

describe("주보 글 나누기", () => {
  it("글에 있는 순서와 설교만 칸으로 나눕니다", () => {
    let n = 0;
    const fields = fieldsFromBulletinText(text, () => `id-${n++}`);
    assert.ok(fields);
    assert.equal(fields?.worshipDate, "2026-10-11");
    assert.equal(fields?.sermonTitle, "그것을 보면 살리라");
    assert.equal(fields?.scriptureText, "야고보서 3:1-6");
    assert.equal(fields?.preacher, "최승원");
    const order = fields?.blocks.find((block) => block.type === "order");
    assert.equal(order?.type === "order" ? order.items[0]?.label : "", "인도");
    assert.equal(order?.type === "order" ? order.items[0]?.detail : "", "최승원 목사");
    const praise = fields?.blocks.find((block) => block.type === "praise");
    assert.equal(praise?.type === "praise" ? praise.songs[0]?.title : "", "위드엘 찬양단");
    const news = fields?.blocks.find((block) => block.type === "announcement");
    assert.equal(news?.type === "announcement" ? news.body.includes("새가족을 환영합니다.") : false, true);
    assert.equal(JSON.stringify(fields).includes("가짜"), false);
    assert.equal(JSON.stringify(fields).includes("봉헌"), false);
  });

  it("십일조와 헌금은 순서와 광고에 넣지 않습니다", () => {
    let n = 0;
    const services = servicesFromBulletinText(
      `2026년 10월 18일
주일 2부 예배 오전 11:00
묵도
헌금
십일조 안내
설교 다시 모인 자리
축도
교회소식
- 십일조 봉투를 준비해 주세요.
- 새가족을 환영합니다.`,
      () => `id-${n++}`,
    );
    const text = JSON.stringify(services);
    assert.equal(text.includes("헌금"), false);
    assert.equal(text.includes("십일조"), false);
    assert.equal(text.includes("새가족을 환영합니다."), true);
    assert.equal(text.includes("다시 모인 자리"), true);
  });

  it("예배 구분이 없으면 칸을 만들지 않습니다", () => {
    assert.equal(fieldsFromBulletinText("1부\n묵도\n축도", () => "x"), null);
    assert.equal(fieldsFromBulletinText("", () => "x"), null);
    assert.equal(servicesFromBulletinText("1부\n묵도\n1부 정종옥 권사 2부 박준호 장로\n축도", () => "x").length, 0);
  });

  it("한 번 읽으면 그 주 예배를 함께 만들고 없는 순서는 넣지 않습니다", () => {
    let n = 0;
    const services = servicesFromBulletinText(
      `2026년 10월 18일 주일
1부 예배 오전 9:00
묵도
찬송 28장
축도
2부 예배 오전 11:00
설교 다시 모인 자리
축도
2026년 10월 21일
수요기도회 오후 7:00
기도 김순 집사
축도
4부 예배 오후 3:00`,
      () => `id-${n++}`,
    );
    assert.equal(BULLETIN_PART_MAX, 3);
    assert.deepEqual(
      services.map((service) => service.label),
      ["주일 1부 예배", "주일 2부 예배", "수요기도회"],
    );
    assert.deepEqual(
      services.map((service) => service.time),
      ["09:00", "11:00", "19:00"],
    );
    assert.equal(services[0]?.worshipDate, "2026-10-18");
    assert.equal(services[2]?.worshipDate, "2026-10-21");
    const firstOrder = services[0]?.blocks.find((block) => block.type === "order");
    const labels = firstOrder?.type === "order" ? firstOrder.items.map((item) => item.label) : [];
    assert.deepEqual(labels, ["묵도", "찬송", "축도"]);
    const secondOrder = services[1]?.blocks.find((block) => block.type === "order");
    const secondLabels = secondOrder?.type === "order" ? secondOrder.items.map((item) => item.label) : [];
    assert.deepEqual(secondLabels, ["설교", "축도"]);
    assert.equal(services[1]?.sermonTitle, "다시 모인 자리");
    assert.equal(services.some((service) => service.label.includes("4부")), false);
  });

  it("1부와 2부는 담당을 나누고 설교 본문은 설교 앞 봉독입니다", () => {
    let n = 0;
    const services = servicesFromBulletinText(
      `2026년 10월 11일
1부 예배 오전 09:00
인도 이종찬 목사
경배와 찬양 마하나임 찬양단
예배의 부름 신명기 32장 3-4절
찬송 44장 지난 이레 동안에
사도신경
영광의 찬송 250장 구주의 십자가 보혈로
대표기도 정종옥 권사
성도의 교제 사랑의 인사를 나눕시다
성경봉독 민수기 21장 4-9절
찬양 1남선교회
말씀 그것을 보면 살리라
결단의 찬양 하나님의 부르심
축도 이종찬 목사
2026년 10월 11일
2부 예배 오전 11:00
인도 이종찬 목사
경배와 찬양 케베스 실내악단
예배의 부름 신명기 32장 3-4절
대표기도 박준호 장로
성경봉독 민수기 21장 4-9절
찬양 시온찬양대
말씀 그것을 보면 살리라
축도 이종찬 목사
교회소식
- 새가족을 환영합니다.
- 오늘은 이웃을 위한 헌금 봉헌주일입니다.`,
      () => `id-${n++}`,
    );
    assert.deepEqual(
      services.map((service) => service.label),
      ["주일 1부 예배", "주일 2부 예배"],
    );
    const packed = JSON.stringify(services);
    assert.equal(packed.includes("십일조"), false);
    assert.equal(packed.includes("헌금"), false);
    assert.equal(packed.includes("봉헌"), false);
    assert.equal(services[0]?.sermonTitle, "그것을 보면 살리라");
    assert.equal(services[0]?.scriptureText, "민수기 21장 4-9절");
    assert.equal(services[1]?.scriptureText, "민수기 21장 4-9절");
    assert.equal(services[0]?.preacher, "이종찬");
    const first = orderLines(services[0]);
    const second = orderLines(services[1]);
    assert.equal(first.includes("경배와 찬양 마하나임 찬양단"), true);
    assert.equal(second.includes("경배와 찬양 케베스 실내악단"), true);
    assert.equal(first.includes("대표기도 정종옥 권사"), true);
    assert.equal(second.includes("대표기도 박준호 장로"), true);
    assert.equal(first.includes("찬양 1남선교회"), true);
    assert.equal(second.includes("찬양 시온찬양대"), true);
    assert.equal(first.includes("예배의 부름 신명기 32장 3-4절"), true);
    assert.equal(first.includes("성도의 교제 사랑의 인사를 나눕시다"), true);
    assert.equal(first.includes("결단의 찬양 하나님의 부르심"), true);
    assert.equal(sectionAssignBroken(`1부 예배\n대표기도 정종옥 권사\n2부 예배\n대표기도 박준호 장로`, services), false);
  });

  it("1부와 2부 담당이 한 예배에 섞이면 규칙이 깨진 것으로 봅니다", () => {
    const mixed = servicesFromBulletinText(
      `2026년 10월 11일
주일 예배 오전 11:00
대표기도 1부 정종옥 권사 2부 박준호 장로
축도`,
      () => "x",
    );
    assert.equal(sectionAssignBroken("대표기도 1부 정종옥 권사 2부 박준호 장로", mixed), true);
  });
});

function orderLines(service: { blocks: ReadonlyArray<{ type: string; items?: ReadonlyArray<{ label: string; detail: string }> }> } | undefined): string[] {
  const order = service?.blocks.find((block) => block.type === "order");
  if (!order || order.type !== "order" || !order.items) return [];
  return order.items.map((item) => [item.label, item.detail].filter(Boolean).join(" "));
}
