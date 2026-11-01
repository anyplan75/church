import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachmentName,
  decodeBase64Url,
  messageIsGuide,
  parseGmailMessage,
  pickGuideAttachment,
} from "@/guide/mail";

function encoded(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

describe("안내 메일 본문", () => {
  it("본문과 한글 첨부를 읽습니다", () => {
    const parsed = parseGmailMessage({
      id: "m1",
      internalDate: "1761292800000",
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "From", value: "김집사 <kim@example.com>" },
          { name: "Subject", value: "서귀포제일교회 주보" },
        ],
        parts: [
          { mimeType: "text/plain", body: { data: encoded("1부 예배 순서") } },
          {
            mimeType: "application/octet-stream",
            filename: "TalkFile_서귀포제일_주보.hwp",
            body: { attachmentId: "att-1", size: 1200 },
          },
        ],
      },
    });
    assert.ok(parsed);
    assert.equal(parsed?.fromEmail, "kim@example.com");
    assert.equal(parsed?.fromName, "김집사");
    assert.equal(parsed?.subject, "서귀포제일교회 주보");
    assert.match(parsed?.body ?? "", /1부 예배 순서/);
    assert.equal(parsed?.attachments[0]?.attachmentId, "att-1");
    assert.equal(messageIsGuide(parsed!), true);
    assert.equal(pickGuideAttachment(parsed!.attachments)?.filename, "TalkFile_서귀포제일_주보.hwp");
  });

  it("확장자가 없어도 PDF 종류면 안내 파일로 봅니다", () => {
    const name = attachmentName("주보", "application/pdf");
    assert.equal(name, "주보.pdf");
    const picked = pickGuideAttachment([
      { filename: "사진", mimeType: "image/png", attachmentId: "p", size: 10 },
      { filename: "주보", mimeType: "application/pdf", attachmentId: "b", size: 10 },
    ]);
    assert.equal(picked?.attachmentId, "b");
  });

  it("예배 글이 없는 알림은 안내로 보지 않습니다", () => {
    const parsed = parseGmailMessage({
      id: "m2",
      payload: {
        mimeType: "text/plain",
        headers: [
          { name: "From", value: "no-reply@accounts.google.com" },
          { name: "Subject", value: "보안 알림" },
        ],
        body: { data: encoded("새 로그인을 확인하세요.") },
      },
    });
    assert.ok(parsed);
    assert.equal(messageIsGuide(parsed!), false);
  });

  it("첨부가 없어도 본문에 예배가 있으면 안내입니다", () => {
    const parsed = parseGmailMessage({
      id: "m3",
      payload: {
        mimeType: "text/html",
        headers: [{ name: "Subject", value: "이번 주" }],
        body: { data: encoded("<p>주일 1부 예배</p><p>설교</p>") },
      },
    });
    assert.match(parsed?.body ?? "", /주일 1부 예배/);
    assert.equal(messageIsGuide(parsed!), true);
    assert.equal(decodeBase64Url(encoded("가")).toString("utf8"), "가");
  });
});
