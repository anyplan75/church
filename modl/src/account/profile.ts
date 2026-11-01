/** 계정에 저장하는 성별과 전화번호입니다. 비밀 열쇠가 아닙니다. */

export type AccountGender = "male" | "female";

/** 남, 여만 받습니다. 카카오 male/female, 네이버 M/F 도 같은 값으로 바꿉니다. */
export function parseAccountGender(value: unknown): AccountGender | null {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  if (text === "male" || text === "m" || text === "남") return "male";
  if (text === "female" || text === "f" || text === "여") return "female";
  return null;
}

/** 숫자만 모아 길이를 보고, 화면에는 적은 그대로 저장합니다. */
export function parseAccountPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, 30);
  const digits = text.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return text;
}
