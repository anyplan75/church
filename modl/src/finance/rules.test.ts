import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Actor, MemberRole } from "@/server/auth/actor";
import {
  budgetBar,
  canManageFinance,
  canManageFinanceRole,
  googleSheetsConfigFromEnv,
  receiptsInRange,
  sheetsAppendRequest,
} from "@/finance/rules";

function user(role: MemberRole): Actor {
  return {
    kind: "user",
    userId: "user-1",
    memberships: [
      {
        communityId: "community-a",
        memberId: "member-1",
        role,
        currentGroupId: "group-1",
        leaderGroupIds: role === "CELL_LEADER" ? ["group-1"] : [],
      },
    ],
    pendingCommunityIds: [],
  };
}

describe("임원만 재정", () => {
  it("사역자와 임원만 재정을 다루고 구성원과 테우리는 다루지 않습니다", () => {
    assert.equal(canManageFinanceRole("PASTOR"), true);
    assert.equal(canManageFinanceRole("EXECUTIVE"), true);
    assert.equal(canManageFinanceRole("CELL_LEADER"), false);
    assert.equal(canManageFinanceRole("MEMBER"), false);
    assert.equal(canManageFinance(user("EXECUTIVE"), "community-a"), true);
    assert.equal(canManageFinance(user("PASTOR"), "community-a"), true);
    assert.equal(canManageFinance(user("MEMBER"), "community-a"), false);
    assert.equal(canManageFinance(user("CELL_LEADER"), "community-a"), false);
    assert.equal(canManageFinance(user("EXECUTIVE"), "community-b"), false);
  });
});

describe("예산 막대", () => {
  it("지출을 예산으로 나누고 막대는 100을 넘기지 않습니다", () => {
    assert.deepEqual(budgetBar(5000, 10000), {
      spent: 5000,
      budget: 10000,
      percent: 50,
      width: 50,
      hasBudget: true,
    });
    const over = budgetBar(15000, 10000);
    assert.equal(over.percent, 150);
    assert.equal(over.width, 100);
  });

  it("예산이 없으면 비율을 100으로 꾸미지 않습니다", () => {
    assert.equal(budgetBar(3000, 0).hasBudget, false);
    assert.equal(budgetBar(3000, 0).percent, 0);
  });
});

describe("기간 안 영수증", () => {
  const rows = [
    { transactionDate: "2026-10-01", receiptImageUrls: ["https://example.com/before.jpg"] },
    { transactionDate: "2026-10-10", receiptImageUrls: ["https://example.com/inside.jpg", "  "] },
    { transactionDate: "2026-10-20", receiptImageUrls: ["https://example.com/end.jpg"] },
    { transactionDate: "2026-10-21", receiptImageUrls: ["https://example.com/after.jpg"] },
  ];

  it("시작일과 종료일 사이 영수증만 고릅니다", () => {
    assert.deepEqual(receiptsInRange(rows, "2026-10-10", "2026-10-20"), [
      "https://example.com/inside.jpg",
      "https://example.com/end.jpg",
    ]);
  });
});

describe("구글 시트 설정", () => {
  it("이름 네 개가 모두 있을 때만 설정을 만듭니다", () => {
    assert.equal(googleSheetsConfigFromEnv({}), null);
    assert.equal(
      googleSheetsConfigFromEnv({
        GOOGLE_SHEETS_CLIENT_ID: "id",
        GOOGLE_SHEETS_CLIENT_SECRET: "secret",
        GOOGLE_SHEETS_REFRESH_TOKEN: "",
        GOOGLE_SHEETS_SPREADSHEET_ID: "sheet",
      }),
      null,
    );
    const ready = googleSheetsConfigFromEnv({
      GOOGLE_SHEETS_CLIENT_ID: "id",
      GOOGLE_SHEETS_CLIENT_SECRET: "secret",
      GOOGLE_SHEETS_REFRESH_TOKEN: "refresh",
      GOOGLE_SHEETS_SPREADSHEET_ID: "sheet",
    });
    assert.equal(ready?.spreadsheetId, "sheet");
  });

  it("보내는 주소에 열쇠를 넣지 않습니다", () => {
    const request = sheetsAppendRequest({
      spreadsheetId: "sheet",
      sheetName: "살림",
      rows: [["날짜", "금액"]],
    });
    assert.equal(request.method, "POST");
    assert.equal(request.url.includes("secret"), false);
    assert.deepEqual(request.body.values, [["날짜", "금액"]]);
  });
});
