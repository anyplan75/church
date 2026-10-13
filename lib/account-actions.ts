import { deleteAccountError, roleChangeError, type Account } from "./account-rules";
import {
  currentUser,
  endLocalSession,
  listAccounts,
  loginWithPassword,
  readDb,
  removeLocalAccount,
  requireMutation,
  saveLocalAccount,
  type LocalAccount,
} from "./app-db";
import { firebaseSignUp } from "./firebase-auth";
import { go } from "./page-path";
import { ALL_ROLES, homeFor, normalizeRoles } from "./roles";
import { normalizeEmail, normalizePassword } from "./account-rules";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function linkedPersonId(value: string): string | null {
  const id = value.trim();
  if (!id) return null;
  const person = readDb().people.find((item) => item.id === id && item.active);
  return person ? person.id : null;
}

function asAccount(account: LocalAccount): Account {
  return account;
}

export async function setupAccount(formData: FormData) {
  if (listAccounts().length > 0) go("/login");
  const email = text(formData, "email");
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");
  if (!normalizeEmail(email)) go("/setup?error=email");
  if (!normalizePassword(password)) go("/setup?error=short");
  if (password.trim() !== confirm.trim()) go("/setup?error=confirm");
  const normalized = normalizeEmail(email)!;
  const created = await firebaseSignUp(normalized, password.trim());
  if (!created.ok && !created.taken) go("/setup?error=email");
  const account: LocalAccount = {
    id: created.ok ? created.localId : crypto.randomUUID(),
    email: normalized,
    passwordHash: "firebase",
    roles: ALL_ROLES,
    personId: null,
  };
  await saveLocalAccount(account, password.trim());
  const user = await loginWithPassword(normalized, password.trim());
  if (!user) go("/setup?error=email");
  go("/");
}

export async function login(formData: FormData) {
  const email = normalizeEmail(text(formData, "email"));
  const password = text(formData, "password");
  if (!email || !normalizePassword(password)) go("/login?error=1");
  const user = await loginWithPassword(email!, password.trim());
  if (!user) go("/login?error=1");
  go(homeFor(user!.roles));
}

export async function logout() {
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
  const created = await firebaseSignUp(normalized!, password.trim());
  if (!created.ok && !created.taken) go("/settings?accountError=email");
  await saveLocalAccount(
    {
      id: created.ok ? created.localId : crypto.randomUUID(),
      email: normalized!,
      passwordHash: "firebase",
      roles,
      personId: linkedPersonId(text(formData, "personId")),
    },
    password.trim(),
  );
  go("/settings?accountSaved=1");
}

export async function saveAccount(formData: FormData) {
  requireMutation("mutate.admin");
  const id = text(formData, "id").trim();
  const email = text(formData, "email");
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");
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
  const current = listAccounts().find((account) => account.id === id);
  if (!current) go(`/settings?accountError=email&account=${encodeURIComponent(id)}`);
  await saveLocalAccount(
    { ...current!, email: normalized!, roles, personId: linkedPersonId(text(formData, "personId")) },
    password.trim() || undefined,
  );
  go("/settings?accountSaved=1");
}

export async function removeAccount(formData: FormData) {
  requireMutation("mutate.admin");
  const id = text(formData, "id").trim();
  const error = deleteAccountError(listAccounts().map(asAccount), id);
  if (error) go(`/settings?accountError=${error.includes("마지막") ? "last-delete" : "email"}&account=${encodeURIComponent(id)}`);
  removeLocalAccount(id);
  if (currentUser()?.id === id) go("/login");
  go("/settings?accountSaved=1");
}
