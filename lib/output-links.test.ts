import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { operatorComputerHref, outputComputerHref, overlayComputerHref, outputLinks, WEB_OUTPUT_ORIGIN } from "./roles.ts";

describe("자막 링크", () => {
  it("오버레이와 메인을 웹과 로컬로 나눈다", () => {
    const id = "service-1";
    const links = outputLinks(id, "http://192.168.0.10:3000");
    assert.deepEqual(
      links.map((link) => link.label),
      ["오버레이 웹", "오버레이 로컬", "메인 웹", "메인 로컬"],
    );
    assert.equal(links[0]?.href, `${WEB_OUTPUT_ORIGIN}/services/${id}/output?mode=overlay`);
    assert.equal(links[1]?.href, `http://192.168.0.10:3000/services/${id}/output?mode=overlay`);
    assert.equal(links[2]?.href, `${WEB_OUTPUT_ORIGIN}/services/${id}/output?mode=main`);
    assert.equal(links[3]?.href, `http://192.168.0.10:3000/services/${id}/output?mode=main`);
    assert.equal(links.some((link) => link.href.includes("192.168") && link.label.includes("웹")), false);
  });

  it("송출 컴퓨터 링크는 설정의 IP 칸 옆에 두는 주소다", () => {
    assert.equal(outputComputerHref(), `${WEB_OUTPUT_ORIGIN}/output-computer`);
    assert.equal(outputComputerHref().includes("mode="), false);
    assert.equal(operatorComputerHref(), `${WEB_OUTPUT_ORIGIN}/operator`);
    assert.equal(overlayComputerHref(), `${WEB_OUTPUT_ORIGIN}/overlay`);
  });

  it("로컬 주소가 없으면 같은 경로만 남긴다", () => {
    const links = outputLinks("abc");
    assert.equal(links[1]?.href, "/services/abc/output?mode=overlay");
    assert.equal(links[3]?.href, "/services/abc/output?mode=main");
  });
});
