/** 제품명과 교회명 표시 규칙. 로그인·스플래시만 제품명, 앱 안은 교회명. */

export const PRODUCT_NAME = "은혜로운 예배";
export const PRODUCT_REMOTE_NAME = "은혜로운 예배 Remote";

/** 교회가 정해진 뒤 헤더·히어로에 쓸 이름. 비어 있으면 우리 교회. */
export function displayChurchName(name: string | null | undefined): string {
  const trimmed = String(name || "").trim();
  return trimmed || "우리 교회";
}
