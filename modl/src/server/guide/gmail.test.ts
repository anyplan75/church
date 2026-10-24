import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { GUIDE_INTAKE_ADDRESS, GUIDE_MAILBOX } from "@/guide/mailbox";
import { fetchGuideMail, type GmailEnv } from "@/server/guide/gmail";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" });
const serviceAccount = JSON.stringify({
  client_email: "guide@example.iam.gserviceaccount.com",
  private_key: typeof pem === "string" ? pem : pem.toString(),
});

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe("안내 메일함 읽기", () => {
  it("열쇠가 없으면 메일함을 열지 않습니다", async () => {
    let called = false;
    const result = await fetchGuideMail({}, new Set(), async () => {
      called = true;
      return json({});
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "unconfigured");
    assert.equal(called, false);
  });

  it("서비스 계정으로 그 메일함의 첨부를 읽습니다", async () => {
    const env: GmailEnv = { GOOGLE_SHEETS_SERVICE_ACCOUNT: serviceAccount };
    const result = await fetchGuideMail(env, new Set(["old"]), async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        const assertion = new URLSearchParams(String(init?.body ?? "")).get("assertion") ?? "";
        const payload = JSON.parse(Buffer.from(assertion.split(".")[1] ?? "", "base64url").toString("utf8")) as {
          sub?: string;
          scope?: string;
        };
        assert.equal(payload.sub, GUIDE_MAILBOX);
        assert.match(payload.scope ?? "", /gmail\.readonly/);
        return json({ access_token: "fixture-token" });
      }
      if (url.endsWith("/profile")) return json({ emailAddress: GUIDE_MAILBOX });
      if (url.includes("/messages?")) return json({ messages: [{ id: "m1" }, { id: "old" }] });
      if (url.includes("/attachments/")) {
        return json({ data: Buffer.from("주일 1부 예배", "utf8").toString("base64url") });
      }
      if (url.includes("/messages/m1")) {
        return json({
          id: "m1",
          internalDate: "1761292800000",
          payload: {
            mimeType: "multipart/mixed",
            headers: [
              { name: "From", value: "사무실 <office@example.com>" },
              { name: "Subject", value: "서귀포제일교회 주보" },
            ],
            parts: [
              { mimeType: "text/plain", body: { data: Buffer.from("첨부합니다", "utf8").toString("base64url") } },
              {
                filename: "서귀포제일_주보.txt",
                mimeType: "text/plain",
                body: { attachmentId: "att-1", size: 20 },
              },
            ],
          },
        });
      }
      return json({ error: "missing" }, 404);
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.guide, true);
    assert.equal(result.items[0]?.fileName, "서귀포제일_주보.txt");
    assert.equal(result.items[0]?.bytes.toString("utf8"), "주일 1부 예배");
    assert.equal(result.items[0]?.fromEmail, "office@example.com");
  });

  it("modl.jeju 편지함만 읽습니다", async () => {
    assert.equal(GUIDE_MAILBOX, "modl.jeju@gmail.com");
    assert.equal(GUIDE_INTAKE_ADDRESS, GUIDE_MAILBOX);
    const result = await fetchGuideMail({ GOOGLE_SQL_ADMIN_CREDENTIALS: serviceAccount }, new Set(), async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) return json({ access_token: "fixture-token" });
      if (url.endsWith("/profile")) return json({ emailAddress: "anyplan.me@gmail.com" });
      return json({}, 404);
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "mailbox");
  });
});
