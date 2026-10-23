/** 지도 검색에서 교회와 모들 이름만 고릅니다. 없는 장소는 만들지 않습니다. */

export const directoryEmptyNote = "교회나 모들로 찾은 결과가 없습니다.";

export type DirectoryHit = {
  kind: "church" | "gathering";
  id: string;
  name: string;
  address: string;
};

export function directoryHits(
  query: string,
  churches: readonly { id: string; name: string; address: string }[],
  gatherings: readonly { id: string; name: string; address: string }[],
): DirectoryHit[] {
  const needle = query.trim().toLocaleLowerCase("ko-KR");
  if (!needle) return [];
  const take = (kind: DirectoryHit["kind"], rows: readonly { id: string; name: string; address: string }[]) =>
    rows
      .filter((row) => `${row.name} ${row.address}`.toLocaleLowerCase("ko-KR").includes(needle))
      .slice(0, 8)
      .map((row) => ({ kind, id: row.id, name: row.name, address: row.address }));
  return [...take("church", churches), ...take("gathering", gatherings)];
}
