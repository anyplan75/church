/** 교회 추가와 삭제 칸 안에서 이름으로만 고릅니다. 지도 검색과 따로입니다. */

export function filterByName<T extends { name: string }>(rows: readonly T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase("ko");
  if (!needle) return [];
  return rows.filter((row) => row.name.toLocaleLowerCase("ko").includes(needle));
}
