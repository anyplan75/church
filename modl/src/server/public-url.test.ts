import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sameOriginPath } from "@/server/public-url";

describe("공개 통로 되돌림", () => {
  it("전달된 공개 주소를 유지하고 로컬 주소를 브라우저에 주지 않습니다", () => {
    const request = new Request("https://localhost:3210/finance/receipts", {
      headers: {
        "x-forwarded-host": "cube-excuse-endif-moisture.trycloudflare.com",
        "x-forwarded-proto": "https",
      },
    });
    const url = sameOriginPath(request, "/finance?note=no_receipts");
    assert.equal(url.hostname, "cube-excuse-endif-moisture.trycloudflare.com");
    assert.equal(url.protocol, "https:");
    assert.equal(url.searchParams.get("note"), "no_receipts");
  });
});
