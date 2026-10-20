/**
 * 기도 쪽지의 수신 이름과 함께 기도 횟수입니다.
 * 누가 글을 볼 수 있는지는 server/auth/prayer-visibility 가 결정합니다.
 */

/** 익명 글이면 보낸 기별 목록에 작성자 이름을 넣지 않습니다. */
export function letterRecipientLabel(input: { isAnonymous: boolean; authorName: string }): string | null {
  if (input.isAnonymous) return null;
  const name = input.authorName.trim();
  return name.length > 0 ? name : null;
}

/** 이미 함께 기도했으면 횟수를 그대로 두고, 처음이면 하나 올립니다. */
export function nextPrayTogetherCount(current: number, alreadyPrayed: boolean): number {
  const safe = Number.isFinite(current) && current > 0 ? current : 0;
  if (alreadyPrayed) return safe;
  return safe + 1;
}
