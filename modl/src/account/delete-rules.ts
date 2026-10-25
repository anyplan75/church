/** 계정 삭제 확인 문장입니다. 버튼만 눌러 지워지지 않게 합니다. */
export const ACCOUNT_DELETE_CONFIRM = "계정을 삭제합니다";

export function accountDeleteConfirmError(value: string): string | null {
  if (value.trim() === ACCOUNT_DELETE_CONFIRM) return null;
  return "확인 칸에 「계정을 삭제합니다」라고 적어 주세요.";
}
