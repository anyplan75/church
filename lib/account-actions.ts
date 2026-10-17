import { deleteAccountError, normalizeEmail, normalizePassword, roleChangeError, type Account } from "./account-rules";
import {
  currentUser,
  endLocalSession,
  listAccounts,
  loginWithPassword,
  readDb,
  registerChurchMember,
  removeLocalAccount,
  requireMutation,
  updateChurchMember,
  updateDb,
} from "./app-db";
import { isMobileOperatorApp, MOBILE_REMOTE_HOME } from "./mobile-app";
import { go } from "./page-path";
import { stopOperatorLink } from "./output-link";
import { closeVisit } from "./simple";
import { homeFor, normalizeRoles } from "./roles";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function linkedPersonId(value: string): string | null {
  const id = value.trim();
  if (!id) return null;
  const person = readDb().people.find((item) => item.id === id && item.active);
  return person ? person.id : null;
}

function asAccount(account: { id: string; email: string; roles: Account["roles"]; passwordHash: string }): Account {
  return account;
}

export async function setupAccount() {
  go("/login");
}

export async function login(formData: FormData) {
  const email = normalizeEmail(text(formData, "email"));
  const password = text(formData, "password");
  if (!email || !normalizePassword(password)) go("/login?error=1");
  const user = await loginWithPassword(email!, password.trim());
  if (!user) go("/login?error=1");
  if (user!.kind === "platform" && !user!.churchId) go("/platform");
  if (isMobileOperatorApp()) go(MOBILE_REMOTE_HOME);
  go(homeFor(user!.roles));
}

export async function logout() {
  stopOperatorLink();
  const user = currentUser();
  if (user?.churchId) {
    updateDb((current) => {
      current.visits = closeVisit(current.visits ?? [], user.email);
    });
  }
  endLocalSession();
  go("/login");
}

export async function createAccount(formData: FormData) {
  requireMutation("mutate.admin");
  const email = text(formData, "email");
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");
  const roles = normalizeRoles(formData.getAll("roles").map(String));
  const normalized = normalizeEmail(email);
  if (!normalized) go("/settings?accountError=email");
  if (!normalizePassword(password)) go("/settings?accountError=short");
  if (password.trim() !== confirm.trim()) go("/settings?accountError=confirm");
  if (roles.length === 0) go("/settings?accountError=roles");
  if (listAccounts().some((account) => account.email === normalized)) go("/settings?accountError=taken");
  try {
    await registerChurchMember(normalized!, password.trim(), roles, linkedPersonId(text(formData, "personId")));
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "";
    go(`/settings?accountError=${message.includes("이미") ? "taken" : "email"}`);
  }
  go("/settings?accountSaved=1");
}

export async function saveAccount(formData: FormData) {
  requireMutation("mutate.admin");
  const id = text(formData, "id").trim();
  const email = text(formData, "email");
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");
  const currentPassword = text(formData, "currentPassword");
  const roles = normalizeRoles(formData.getAll("roles").map(String));
  const accounts = listAccounts().map(asAccount);
  const normalized = normalizeEmail(email);
  if (!normalized) go(`/settings?accountError=email&account=${encodeURIComponent(id)}`);
  if (password.trim() || confirm.trim()) {
    if (!normalizePassword(password)) go(`/settings?accountError=short&account=${encodeURIComponent(id)}`);
    if (password.trim() !== confirm.trim()) go(`/settings?accountError=confirm&account=${encodeURIComponent(id)}`);
  }
  const roleError = roleChangeError(accounts, id, roles);
  if (roleError) {
    const code = roleError.includes("마지막") ? "last" : roleError.includes("역할") ? "roles" : "email";
    go(`/settings?accountError=${code}&account=${encodeURIComponent(id)}`);
  }
  if (accounts.some((account) => account.email === normalized && account.id !== id)) {
    go(`/settings?accountError=taken&account=${encodeURIComponent(id)}`);
  }
  try {
    await updateChurchMember(id, {
      email: normalized!,
      roles,
      personId: linkedPersonId(text(formData, "personId")),
      currentPassword: currentPassword.trim(),
      password: password.trim() || undefined,
    });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "";
    const code = message.includes("현재 비밀번호") ? "confirm" : message.includes("맞지") ? "confirm" : "email";
    go(`/settings?accountError=${code}&account=${encodeURIComponent(id)}`);
  }
  go("/settings?accountSaved=1");
}

export async function removeAccount(formData: FormData) {
  requireMutation("mutate.admin");
  const id = text(formData, "id").trim();
  const error = deleteAccountError(listAccounts().map(asAccount), id);
  if (error) go(`/settings?accountError=${error.includes("마지막") ? "last-delete" : "email"}&account=${encodeURIComponent(id)}`);
  await removeLocalAccount(id);
  if (currentUser()?.id === id) go("/login");
  go("/settings?accountSaved=1");
}
