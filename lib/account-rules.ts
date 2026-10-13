import type { Role } from "./roles";

export type Account = {
  id: string;
  email: string;
  passwordHash: string;
  roles: Role[];
};

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 120) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function normalizePassword(value: string): string | null {
  const password = value.trim();
  if (password.length < 8 || password.length > 200) return null;
  return password;
}

export function roleChangeError(accounts: readonly Account[], id: string, roles: readonly Role[]): string | null {
  if (!accounts.some((account) => account.id === id)) return "계정을 찾을 수 없습니다.";
  if (roles.length === 0) return "역할을 하나 이상 선택해 주세요.";
  const others = accounts.filter((account) => account.id !== id && account.roles.includes("admin")).length;
  if (others + (roles.includes("admin") ? 1 : 0) === 0) return "마지막 설정·계정 역할은 뺄 수 없습니다.";
  return null;
}

export function deleteAccountError(accounts: readonly Account[], id: string): string | null {
  const account = accounts.find((item) => item.id === id);
  if (!account) return "계정을 찾을 수 없습니다.";
  const others = accounts.filter((item) => item.id !== id && item.roles.includes("admin")).length;
  if (account.roles.includes("admin") && others === 0) return "마지막 설정·계정 계정은 삭제할 수 없습니다.";
  return null;
}
