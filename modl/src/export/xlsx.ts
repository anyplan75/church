/**
 * 교적, 출석, 재정 시트를 엑셀 파일로 만듭니다.
 */

import ExcelJS from "exceljs";

export async function buildXlsx(sheetName: string, headers: string[], rows: string[][]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(sheetName);
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  const out = await book.xlsx.writeBuffer();
  return Buffer.from(out);
}

export const ROSTER_HEADERS = ["이름", "전화", "역할", "상태"] as const;
export const ATTENDANCE_HEADERS = ["날짜", "모임", "이름", "상태"] as const;
export const FINANCE_HEADERS = ["날짜", "분류", "종류", "금액", "설명", "영수증"] as const;

export function rosterRows(people: Array<{ name: string; phone: string | null; role: string; status: string }>): string[][] {
  return people.map((person) => [person.name, person.phone ?? "", person.role, person.status]);
}

export function attendanceRows(
  records: Array<{ sessionDate: string; title: string; name: string; status: string }>,
): string[][] {
  return records.map((record) => [record.sessionDate, record.title, record.name, record.status]);
}

export function financeRows(
  records: Array<{
    transactionDate: string;
    categoryName: string;
    type: string;
    amount: string;
    description: string;
    receiptImageUrls: readonly string[];
  }>,
): string[][] {
  return records.map((record) => [
    record.transactionDate,
    record.categoryName,
    record.type,
    record.amount,
    record.description,
    record.receiptImageUrls.join(" "),
  ]);
}
