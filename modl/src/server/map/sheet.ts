/**
 * 엑셀 첫 장을 교회 목록 줄로 읽습니다.
 * 칸이 비어 있으면 빈 문자열입니다. 없는 교회를 채우지 않습니다.
 */

import ExcelJS from "exceljs";

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  if (typeof value === "object" && "result" in value) return cellText(value.result as ExcelJS.CellValue);
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? "").join("").trim();
  }
  return "";
}

export async function readChurchSheet(bytes: Uint8Array): Promise<string[][]> {
  const book = new ExcelJS.Workbook();
  const data = Buffer.from(bytes) as unknown as Parameters<ExcelJS.Xlsx["load"]>[0];
  await book.xlsx.load(data);
  const sheet = book.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values = row.values as ExcelJS.CellValue[];
    rows.push([1, 2, 3, 4, 5, 6].map((index) => cellText(values[index] ?? null)));
  });
  return rows;
}
