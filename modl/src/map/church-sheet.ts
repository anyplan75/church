/**
 * 교회 목록 엑셀의 첫 줄과 줄을 읽습니다.
 * 없는 교회는 만들지 않습니다.
 */

export const CHURCH_HEADERS = ["교회이름", "담임목사", "주소", "전화번호", "주일 예배시간", "메모"] as const;

export type ChurchInput = {
  name: string;
  pastorName: string;
  address: string;
  phone: string;
  serviceTime: string;
  memo: string;
};

export type ChurchPin = ChurchInput & {
  id: string;
  point: { lat: number; lon: number };
};

export type ChurchRecord = ChurchInput & {
  id: string;
  pinned: boolean;
};

function cell(row: readonly string[], index: number): string {
  return (row[index] ?? "").trim();
}

/** 첫 줄 칸 이름이 정해진 여섯 글자와 순서가 같아야 합니다. */
export function parseChurchRows(rows: readonly (readonly string[])[]): { ok: true; churches: ChurchInput[] } | { ok: false; message: string } {
  const header = rows[0];
  if (!header) return { ok: false, message: "엑셀 첫 줄에 칸 이름이 없습니다." };
  const names = CHURCH_HEADERS.map((_, index) => cell(header, index));
  if (names.some((name, index) => name !== CHURCH_HEADERS[index])) {
    return { ok: false, message: "첫 줄 칸 이름은 교회이름, 담임목사, 주소, 전화번호, 주일 예배시간, 메모 순서여야 합니다." };
  }
  const churches: ChurchInput[] = [];
  for (const row of rows.slice(1)) {
    const church = {
      name: cell(row, 0),
      pastorName: cell(row, 1),
      address: cell(row, 2),
      phone: cell(row, 3),
      serviceTime: cell(row, 4),
      memo: cell(row, 5),
    };
    if (!church.name && !church.pastorName && !church.address && !church.phone && !church.serviceTime && !church.memo) {
      continue;
    }
    if (!church.name) return { ok: false, message: "교회이름이 비어 있는 줄이 있습니다." };
    if (church.name.length > 80 || church.pastorName.length > 80 || church.phone.length > 40 || church.serviceTime.length > 80) {
      return { ok: false, message: "교회 이름, 목사, 전화번호, 예배 시간은 짧게 적어 주세요." };
    }
    if (church.address.length > 200 || church.memo.length > 500) {
      return { ok: false, message: "주소는 200자, 메모는 500자 안으로 적어 주세요." };
    }
    churches.push(church);
  }
  if (churches.length === 0) return { ok: false, message: "넣을 교회가 없습니다." };
  if (churches.length > 100) return { ok: false, message: "한 번에 100곳까지 넣습니다." };
  return { ok: true, churches };
}
