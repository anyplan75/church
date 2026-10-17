import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chromeOutputLinks, chromeOutputUrl, outputLinks, WEB_OUTPUT_ORIGIN } from "./roles.ts";

describe("자막 링크", () => {
  it("크롬용 메인·오버레이 Surge 주소를 만든다", () => {
    const id = "service-1";
    const links = chromeOutputLinks(id, "192.168.0.10");
    assert.deepEqual(
      links.map((link) => link.label),
      ["크롬용 메인", "크롬용 오버레이"],
    );
    assert.equal(links[0]?.href, `${WEB_OUTPUT_ORIGIN}/services/${id}/output/?mode=main&from=192.168.0.10`);
    assert.equal(links[1]?.href, `${WEB_OUTPUT_ORIGIN}/services/${id}/output/?mode=overlay&from=192.168.0.10`);
    assert.equal(chromeOutputUrl(id, "main"), `${WEB_OUTPUT_ORIGIN}/services/${id}/output/?mode=main`);
    assert.equal(chromeOutputUrl(id, "overlay", "not-an-ip").includes("from="), false);
  });

  it("오버레이와 메인을 크롬과 로컬로 나눈다", () => {
    const id = "service-1";
    const links = outputLinks(id, "http://192.168.0.10:3000");
    assert.deepEqual(
      links.map((link) => link.label),
      ["크롬용 오버레이", "오버레이 로컬", "크롬용 메인", "메인 로컬"],
    );
    assert.equal(links[0]?.href, `${WEB_OUTPUT_ORIGIN}/services/${id}/output/?mode=overlay`);
    assert.equal(links[1]?.href, `http://192.168.0.10:3000/services/${id}/output/?mode=overlay`);
    assert.equal(links[2]?.href, `${WEB_OUTPUT_ORIGIN}/services/${id}/output/?mode=main`);
    assert.equal(links[3]?.href, `http://192.168.0.10:3000/services/${id}/output/?mode=main`);
    assert.equal(links.some((link) => link.href.includes("192.168") && link.label.includes("크롬")), false);
  });

  it("로컬 주소가 없으면 같은 경로만 남긴다", () => {
    const links = outputLinks("abc");
    assert.equal(links[1]?.href, "/services/abc/output?mode=overlay");
    assert.equal(links[3]?.href, "/services/abc/output?mode=main");
  });
});
