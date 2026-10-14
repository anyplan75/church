import { normalizeEmail, normalizePassword } from "./account-rules";
import { addChurchWithOperator, enterChurch, leaveChurch } from "./app-db";
import { go } from "./page-path";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

export async function addChurch(formData: FormData) {
  const name = text(formData, "name");
  const email = normalizeEmail(text(formData, "email"));
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");
  if (!email) go("/platform?error=email");
  if (!normalizePassword(password)) go("/platform?error=short");
  if (password.trim() !== confirm.trim()) go("/platform?error=confirm");
  const result = await addChurchWithOperator({
    name,
    email: email!,
    password: password.trim(),
    roles: formData.getAll("roles").map(String),
  });
  if (!result.ok) go(`/platform?error=${encodeURIComponent(result.code)}`);
  go("/platform?saved=1");
}

export async function openChurch(formData: FormData) {
  const id = text(formData, "id").trim();
  await enterChurch(id);
  go("/");
}

export async function backToChurches() {
  leaveChurch();
  go("/platform");
}
