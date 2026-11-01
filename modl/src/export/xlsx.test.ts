import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import { ATTENDANCE_HEADERS, buildXlsx, financeRows, rosterRows } from "@/export/xlsx";

describe("엑셀 내려받기", () => {
  it("교적 줄을 엑셀에서 다시 읽습니다", async () => {
    const rows = rosterRows([{ name: "김사역", phone: "01099998888", role: "PASTOR", status: "ACTIVE" }]);
    const buffer = await buildXlsx("교적", ["이름", "전화", "역할", "상태"], rows);
    assert.equal(buffer.subarray(0, 2).toString(), "PK");
    const book = new ExcelJS.Workbook();
    const view = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    await book.xlsx.load(view as ArrayBuffer);
    const sheet = book.getWorksheet("교적");
    assert.equal(sheet?.getCell("A2").value, "김사역");
    assert.equal(sheet?.getCell("C2").value, "PASTOR");
  });

  it("출석과 재정 머리글이 비어 있지 않습니다", () => {
    assert.equal(ATTENDANCE_HEADERS.length, 4);
    const rows = financeRows([
      {
        transactionDate: "2026-10-20",
        categoryName: "청년부",
        type: "EXPENSE",
        amount: "5000",
        description: "다과",
        receiptImageUrls: ["https://example.com/a.jpg"],
      },
    ]);
    assert.equal(rows[0]?.[5], "https://example.com/a.jpg");
  });
});
