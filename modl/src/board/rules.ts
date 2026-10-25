/**
 * 교회·모들 게시판 글입니다.
 * 그곳을 구독한 구성원만 쓰고, 본인 글만 고치거나 지웁니다.
 */

export type BoardPlaceKind = "church" | "gathering";

export function cleanBoardPost(title: string, body: string): { ok: true; title: string; body: string } | { ok: false; message: string } {
  const cleanedTitle = title.trim();
  const cleanedBody = body.trim();
  if (!cleanedTitle || !cleanedBody) return { ok: false, message: "제목과 내용을 함께 적어 주세요." };
  if (cleanedTitle.length > 80) return { ok: false, message: "제목은 80자 안으로 적어 주세요." };
  if (cleanedBody.length > 2000) return { ok: false, message: "내용은 2000자 안으로 적어 주세요." };
  return { ok: true, title: cleanedTitle, body: cleanedBody };
}

export function memberCanWrite(
  kind: BoardPlaceKind,
  id: string,
  churchIds: ReadonlySet<string>,
  groupIds: ReadonlySet<string>,
): boolean {
  return kind === "church" ? churchIds.has(id) : groupIds.has(id);
}
