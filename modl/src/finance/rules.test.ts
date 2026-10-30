import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Actor, MemberRole } from "@/server/auth/actor";
import {
  budgetBar,
  canManageFinance,
  canManageFinanceRole,
  amountsFromSheet,
  financeEntriesForPlace,
  financeEntriesFromSheet,
  formatSheetAmount,
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

describe("시트 금액", () => {
  it("있는 금액만 고르고 빈 칸은 0으로 채우지 않습니다", () => {
    const parsed = amountsFromSheet([
      ["항목", "금액", "메모"],
      ["헌금", "", ""],
      ["후원", "1,200원", ""],
    ]);
    assert.deepEqual(parsed, {
      headers: ["항목", "금액", "메모"],
      rows: [["후원", "1,200원", ""]],
    });
    assert.equal(amountsFromSheet([["항목", "금액"], ["헌금", ""]]), null);
  });

  it("교회모들 칸으로 금액을 나누고 원 글자로 보여 줍니다", () => {
    const entries = financeEntriesFromSheet([
      ["교회모들", "날짜", "분류", "종류", "금액", "설명"],
      ["서귀포제일교회", "2026-10-05", "주일헌금", "수입", "1,250,000원", "주일 예배 헌금"],
      ["위미교회", "2026-10-05", "주일헌금", "수입", "", "빈 금액"],
      ["서귀포청년연합", "2026-10-11", "모임비", "수입", "95000", "청년 모임 회비"],
    ]);
    assert.deepEqual(entries, [
      {
        placeName: "서귀포제일교회",
        date: "2026-10-05",
        category: "주일헌금",
        type: "수입",
        amount: "1,250,000원",
        description: "주일 예배 헌금",
      },
      {
        placeName: "서귀포청년연합",
        date: "2026-10-11",
        category: "모임비",
        type: "수입",
        amount: "95,000원",
        description: "청년 모임 회비",
      },
    ]);
    assert.equal(financeEntriesForPlace(entries, "서귀포제일교회").length, 1);
    assert.equal(financeEntriesForPlace(entries, "위미교회").length, 0);
    assert.equal(formatSheetAmount("₩480,000"), "480,000원");
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
