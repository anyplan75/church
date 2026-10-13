import fs from "fs";
import path from "path";
import { dataDir } from "./data-dir";
import { hashPassword } from "./passwords";
import { ALL_ROLES, normalizeRoles, type Role } from "./roles";
import { dropSessionsForAccount } from "./sessions";

export type Account = {
  id: string;
  email: string;
  passwordHash: string;
  roles: Role[];
};

type AccountFile = { accounts: Account[] };

export function accountsFile(): string {
  return path.join(dataDir(), "accounts.json");
}

function writeAccounts(accounts: Account[]) {
  const file = accountsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  const body: AccountFile = { accounts };
  fs.writeFileSync(temporary, JSON.stringify(body, null, 2));
  fs.renameSync(temporary, file);
}

export function readAccounts(): Account[] {
  const file = accountsFile();
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<AccountFile> | null;
  const list = Array.isArray(parsed?.accounts) ? parsed.accounts : [];
  return list.map(normalizeAccount).filter((account): account is Account => account !== null);
}

export function hasAnyAccount(): boolean {
  return readAccounts().length > 0;
}

export function findAccountByEmail(email: string): Account | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return readAccounts().find((account) => account.email === normalized) ?? null;
}

export function findAccountById(id: string): Account | null {
  return readAccounts().find((account) => account.id === id) ?? null;
}

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

export function createFirstAccount(email: string, password: string): Account {
  if (readAccounts().length > 0) throw new Error("이미 계정이 있습니다.");
  const account = buildAccount(email, password, ALL_ROLES);
  if (readAccounts().length > 0) throw new Error("이미 계정이 있습니다.");
  writeAccounts([account]);
  return account;
}

export function addAccount(email: string, password: string, roles: readonly string[]): Account {
  const account = buildAccount(email, password, normalizeRoles(roles));
  const accounts = readAccounts();
  if (accounts.some((item) => item.email === account.email)) throw new Error("이미 있는 이메일입니다.");
  writeAccounts([...accounts, account]);
  return account;
}

export function updateAccount(
  id: string,
  input: { email: string; roles: readonly string[]; password?: string },
): Account {
  const accounts = readAccounts();
  const current = accounts.find((account) => account.id === id);
  if (!current) throw new Error("계정을 찾을 수 없습니다.");
  const email = normalizeEmail(input.email);
  if (!email) throw new Error("이메일 형식을 확인해 주세요.");
  if (accounts.some((account) => account.email === email && account.id !== id)) throw new Error("이미 있는 이메일입니다.");
  const roles = normalizeRoles(input.roles);
  const roleError = roleChangeError(accounts, id, roles);
  if (roleError) throw new Error(roleError);
  let passwordHash = current.passwordHash;
  const nextPassword = input.password?.trim() ?? "";
  if (nextPassword) {
    const password = normalizePassword(nextPassword);
    if (!password) throw new Error("비밀번호는 8자 이상으로 입력해 주세요.");
    passwordHash = hashPassword(password);
    dropSessionsForAccount(id);
  }
  const next: Account = { ...current, email, roles, passwordHash };
  writeAccounts(accounts.map((account) => (account.id === id ? next : account)));
  return next;
}

export function deleteAccount(id: string) {
  const accounts = readAccounts();
  const error = deleteAccountError(accounts, id);
  if (error) throw new Error(error);
  writeAccounts(accounts.filter((account) => account.id !== id));
  dropSessionsForAccount(id);
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

function buildAccount(email: string, password: string, roles: readonly Role[]): Account {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("이메일 형식을 확인해 주세요.");
  const normalizedPassword = normalizePassword(password);
  if (!normalizedPassword) throw new Error("비밀번호는 8자 이상으로 입력해 주세요.");
  if (roles.length === 0) throw new Error("역할을 하나 이상 선택해 주세요.");
  return {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash: hashPassword(normalizedPassword),
    roles: normalizeRoles(roles),
  };
}

function normalizeAccount(value: Partial<Account> | null | undefined): Account | null {
  if (!value || typeof value.email !== "string" || typeof value.passwordHash !== "string") return null;
  const email = normalizeEmail(value.email);
  if (!email || !value.passwordHash.startsWith("scrypt$")) return null;
  const roles = normalizeRoles(Array.isArray(value.roles) ? value.roles.map(String) : []);
  if (roles.length === 0) return null;
  return {
    id: typeof value.id === "string" && value.id ? value.id : crypto.randomUUID(),
    email,
    passwordHash: value.passwordHash,
    roles,
  };
}
