import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeDb } from "./db-shape.ts";
import { cleanHost, directCandidate, directDescription, hostEntry, hostKey, isPrivateIpv4, numericAddressFromCandidate, outputSignalHost, savedOutputTarget } from "./output-host.ts";

describe("송출 컴퓨터 주소", () => {
  it("IP 주소만 받는다", () => {
    assert.equal(cleanHost("192.168.0.10"), "192.168.0.10");
    assert.equal(cleanHost(" 10.0.0.2 "), "10.0.0.2");
    assert.equal(cleanHost("127.0.0.1"), "127.0.0.1");
    assert.equal(cleanHost("http://192.168.0.10"), "");
    assert.equal(cleanHost("192.168.0.10/24"), "");
    assert.equal(cleanHost("192.168.0.10:3456"), "");
    assert.equal(cleanHost("192.168.0.256"), "");
    assert.equal(cleanHost("192.168.001.010"), "");
    assert.equal(cleanHost("1.2.3"), "");
    assert.equal(hostKey("192.168.0.10"), "192-168-0-10");
    assert.equal(hostKey("not-an-ip"), "");
    assert.equal(isPrivateIpv4("192.168.1.20"), true);
    assert.equal(isPrivateIpv4("10.1.2.3"), true);
    assert.equal(isPrivateIpv4("172.16.0.1"), true);
    assert.equal(isPrivateIpv4("172.31.255.255"), true);
    assert.equal(isPrivateIpv4("172.32.0.1"), false);
    assert.equal(isPrivateIpv4("8.8.8.8"), false);
    assert.equal(isPrivateIpv4("127.0.0.1"), false);
    assert.equal(isPrivateIpv4("169.254.1.1"), false);
  });

  it("응답의 로컬 이름만 지정한 주소로 바꾼다", () => {
    const sdp = "v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\na=candidate:1 1 udp 1 abcd.local 54000 typ host\r\n";
    const next = directDescription(sdp, "192.168.0.10");
    assert.equal(next.includes(".local"), false);
    assert.equal(next.includes("192.168.0.10 54000"), true);
    assert.equal(next.includes("\r\n"), true);
    assert.equal(directDescription(sdp, "not-an-ip"), sdp);
    assert.equal(directCandidate("candidate:1 1 udp 1 name.local 54000 typ host", "10.1.2.3"), "candidate:1 1 udp 1 10.1.2.3 54000 typ host");
    assert.equal(numericAddressFromCandidate("candidate:1 1 udp 1 8.8.8.8 9 typ srflx raddr 192.168.0.10 rport 2"), "192.168.0.10");
    assert.equal(numericAddressFromCandidate("candidate:1 1 udp 1 8.8.8.8 9 typ srflx raddr 0.0.0.0 rport 2"), "");
    assert.equal(numericAddressFromCandidate("candidate:1 1 udp 1 abcd.local 9 typ host"), "");
  });

  it("페이지 주소는 192.168 주소가 아니라고 가른다", () => {
    const page = "https://eunhye-church.surge.sh/services/e554924c-79ae-47ff-8374-b43f55338c8b/output/?mode=overlay";
    assert.equal(hostEntry(page).problem, "url");
    assert.equal(hostEntry(page).host, "");
    assert.equal(hostEntry("eunhye-church.surge.sh/services/x/output").problem, "url");
    assert.deepEqual(hostEntry("192.168.0.10"), { host: "192.168.0.10", problem: "" });
    assert.equal(hostEntry("").problem, "");
    assert.equal(hostEntry("송출컴퓨터").problem, "invalid");
  });

  it("껐다 켜도 설정에 저장한 IP로 다시 연결한다", () => {
    const db = normalizeDb({
      settings: { churchName: "교회", backgroundColor: "#1b3a32", backgroundFile: null, overlay: "bottom", outputHost: "192.168.0.10" },
    });
    assert.equal(db.settings.outputHost, "192.168.0.10");
    assert.equal(normalizeDb(db).settings.outputHost, "192.168.0.10");
    assert.deepEqual(savedOutputTarget(db.settings.outputHost, "", "service-1"), { host: "192.168.0.10", serviceId: "service-1" });
    assert.deepEqual(savedOutputTarget("", "192.168.0.10", "service-1"), { host: "192.168.0.10", serviceId: "service-1" });
    assert.equal(savedOutputTarget("192.168.0.10", "", ""), null);
    assert.equal(outputSignalHost(db.settings.outputHost, "", ""), "192.168.0.10");
  });

  it("설정에 넣은 송출 컴퓨터 IP를 자기 칸보다 먼저 쓴다", () => {
    assert.equal(outputSignalHost("192.168.0.10", "10.0.0.2", "10.1.1.1"), "192.168.0.10");
    assert.equal(outputSignalHost("", "10.0.0.2", "10.1.1.1"), "10.0.0.2");
    assert.equal(outputSignalHost("https://eunhye-church.surge.sh/output", "", "192.168.0.10"), "192.168.0.10");
    assert.equal(outputSignalHost("", "", ""), "");
  });
});
