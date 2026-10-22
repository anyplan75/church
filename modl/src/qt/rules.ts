/**
 * 말씀 트멍의 알림 범위, 은혜 횟수, 사진 글 읽기 설정입니다.
 * 데이터베이스에 접속하지 않습니다. 열쇠 값은 여기서 만들지 않습니다.
 */

export type ReflectionStamp = {
  id: string;
  qtId: string;
  memberId: string;
  createdAt: string;
};

/**
 * 내가 답을 저장한 시각보다 뒤에 올라온, 다른 사람의 같은 말씀 묵상만 알림으로 고릅니다.
 * 내 답이 없으면 알림은 비어 있습니다.
 */
export function reflectionsAfterOwnSubmit(
  reflections: readonly ReflectionStamp[],
  qtId: string,
  viewerMemberId: string,
): ReflectionStamp[] {
  const own = reflections
    .filter((item) => item.qtId === qtId && item.memberId === viewerMemberId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
  if (!own) return [];
  return reflections.filter(
    (item) => item.qtId === qtId && item.memberId !== viewerMemberId && item.createdAt > own.createdAt,
  );
}

/** 이미 은혜를 남겼으면 횟수를 그대로 두고, 처음이면 하나 올립니다. */
export function nextGraceCount(current: number, alreadyGiven: boolean): number {
  const safe = Number.isFinite(current) && current > 0 ? current : 0;
  if (alreadyGiven) return safe;
  return safe + 1;
}

/** 질문 칸에 한 줄씩 적은 글을 목록으로 만듭니다. */
export function questionLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * 글 읽기 열쇠 이름이 비어 있으면 설정을 없는 것으로 봅니다.
 * 호출하는 쪽에서 `QT_OCR_API_KEY` 칸만 넘겨 주세요.
 */
export function ocrConfigFromEnv(env: { QT_OCR_API_KEY?: string }): { apiKey: string } | null {
  const apiKey = env.QT_OCR_API_KEY?.trim() ?? "";
  if (!apiKey) return null;
  return { apiKey };
}

/**
 * 사진에서 읽은 글을 본문과 질문으로 나눕니다.
 * 물음표로 끝나는 줄만 질문입니다. 글이 없으면 빈 칸을 돌려주고, 문장을 지어내지 않습니다.
 */
export function questionsFromOcrText(text: string): { body: string; questions: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const questions = lines.filter((line) => line.endsWith("?") || line.endsWith("？"));
  const body = lines.filter((line) => !line.endsWith("?") && !line.endsWith("？")).join("\n");
  return { body, questions };
}
