"use server";

import { redirect } from "next/navigation";
import {
  addAccount,
  createFirstAccount,
  deleteAccount,
  findAccountByEmail,
  hasAnyAccount,
  normalizeEmail,
  normalizePassword,
  updateAccount,
} from "./accounts";
import { dummyPasswordHash, verifyPassword } from "./passwords";
import { requireMutation } from "./guard";
import { homeFor, normalizeRoles } from "./roles";
import { endSession, startSession } from "./session";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

export async function setupAccount(formData: FormData) {
  if (hasAnyAccount()) redirect("/login");
  const email = text(formData, "email");
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");
  if (!normalizeEmail(email)) redirect("/setup?error=email");
  if (!normalizePassword(password)) redirect("/setup?error=short");
  if (password.trim() !== confirm.trim()) redirect("/setup?error=confirm");
  try {
    const account = createFirstAccount(email, password);
    await startSession(account.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("이미")) redirect("/login");
    redirect("/setup?error=email");
  }
  redirect("/");
}

export async function login(formData: FormData) {
  if (!hasAnyAccount()) redirect("/setup");
  const email = text(formData, "email");
  const password = text(formData, "password");
  const account = findAccountByEmail(email);
  const hash = account?.passwordHash ?? dummyPasswordHash();
  const matches = verifyPassword(password, hash);
  if (!account || !matches) redirect("/login?error=1");
  await startSession(account.id);
  redirect(homeFor(account.roles));
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function createAccount(formData: FormData) {
  await requireMutation("mutate.admin");
  const email = text(formData, "email");
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");
  const roles = normalizeRoles(formData.getAll("roles").map(String));
  if (!normalizeEmail(email)) redirect("/settings?accountError=email");
  if (!normalizePassword(password)) redirect("/settings?accountError=short");
  if (password.trim() !== confirm.trim()) redirect("/settings?accountError=confirm");
  if (roles.length === 0) redirect("/settings?accountError=roles");
  try {
    addAccount(email, password, roles);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("이미")) redirect("/settings?accountError=taken");
    redirect("/settings?accountError=email");
  }
  redirect("/settings?accountSaved=1");
}

export async function saveAccount(formData: FormData) {
  await requireMutation("mutate.admin");
  const id = text(formData, "id").trim();
  const email = text(formData, "email");
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");
  const roles = normalizeRoles(formData.getAll("roles").map(String));
  if (password.trim() || confirm.trim()) {
    if (!normalizePassword(password)) redirect(`/settings?accountError=short&account=${encodeURIComponent(id)}`);
    if (password.trim() !== confirm.trim()) redirect(`/settings?accountError=confirm&account=${encodeURIComponent(id)}`);
  }
  try {
    updateAccount(id, { email, roles, password });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = message.includes("마지막") ? "last" : message.includes("이미") ? "taken" : message.includes("역할") ? "roles" : message.includes("비밀번호") ? "short" : "email";
    redirect(`/settings?accountError=${code}&account=${encodeURIComponent(id)}`);
  }
  redirect("/settings?accountSaved=1");
}

export async function removeAccount(formData: FormData) {
  await requireMutation("mutate.admin");
  const id = text(formData, "id").trim();
  try {
    deleteAccount(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = message.includes("마지막") ? "last-delete" : "email";
    redirect(`/settings?accountError=${code}&account=${encodeURIComponent(id)}`);
  }
  redirect("/settings?accountSaved=1");
}
