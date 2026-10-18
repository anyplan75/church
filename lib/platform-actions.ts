import { normalizeEmail, normalizePassword } from "./account-rules";
import { addChurchWithOperator, enterChurch, leaveChurch, updateChurchProfile } from "./app-db";
import { go } from "./page-path";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

export async function addChurch(formData: FormData) {
  const name = text(formData, "name");
  const email = normalizeEmail(text(formData, "email"));
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");
  const address = text(formData, "address").trim().slice(0, 200);
  const latRaw = text(formData, "lat").trim();
  const lngRaw = text(formData, "lng").trim();
  const lat = latRaw ? Number(latRaw) : undefined;
  const lng = lngRaw ? Number(lngRaw) : undefined;
  if (!email) go("/platform?error=email");
  if (!normalizePassword(password)) go("/platform?error=short");
  if (password.trim() !== confirm.trim()) go("/platform?error=confirm");
  const result = await addChurchWithOperator({
    name,
    email: email!,
    password: password.trim(),
    roles: formData.getAll("roles").map(String),
    address,
    lat,
    lng,
  });
  if (!result.ok) go(`/platform?error=${encodeURIComponent(result.code)}`);
  go("/platform?saved=1");
}

export async function openChurch(formData: FormData) {
  const id = text(formData, "id").trim();
  await enterChurch(id);
  go("/");
}

export async function saveChurchProfile(formData: FormData) {
  const churchId = text(formData, "churchId").trim();
  const name = text(formData, "name");
  const address = text(formData, "address").trim().slice(0, 200);
  const latRaw = text(formData, "lat").trim();
  const lngRaw = text(formData, "lng").trim();
  const lat = latRaw ? Number(latRaw) : undefined;
  const lng = lngRaw ? Number(lngRaw) : undefined;
  const returnTo = text(formData, "returnTo").trim() || "/platform";
  const base = returnTo.startsWith("/") ? returnTo.split("?")[0] || "/platform" : "/platform";
  const result = await updateChurchProfile({ churchId, name, address, lat, lng });
  if (!result.ok) {
    go(`${base}?error=${encodeURIComponent(result.code)}&edit=${encodeURIComponent(churchId)}`);
    return;
  }
  go(`${base}?profileSaved=1`);
}

export async function backToChurches() {
  leaveChurch();
  go("/platform");
}
