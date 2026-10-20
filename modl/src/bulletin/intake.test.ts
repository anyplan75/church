import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fieldsFromBulletinText } from "@/bulletin/intake";

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
    assert.equal(order?.type === "order" ? order.items[0]?.detail : "", "최승원");
    const praise = fields?.blocks.find((block) => block.type === "praise");
    assert.equal(praise?.type === "praise" ? praise.songs[0]?.title : "", "위드엘 찬양단");
    const news = fields?.blocks.find((block) => block.type === "announcement");
    assert.equal(news?.type === "announcement" ? news.body.includes("새가족을 환영합니다.") : false, true);
    assert.equal(JSON.stringify(fields).includes("가짜"), false);
  });

  it("예배 구분이 없으면 칸을 만들지 않습니다", () => {
    assert.equal(fieldsFromBulletinText("1부\n묵도\n축도", () => "x"), null);
    assert.equal(fieldsFromBulletinText("", () => "x"), null);
  });
});
