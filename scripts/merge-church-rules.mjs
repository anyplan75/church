import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
for (const name of [".env.local", ".env"]) {
  const file = path.join(root, "..", name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cut = trimmed.indexOf("=");
    if (cut <= 0) continue;
    const key = trimmed.slice(0, cut).trim();
    let value = trimmed.slice(cut + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const databaseUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || "").replace(/\/+$/, "");
const token = process.env.FIREBASE_TOKEN || process.env.GOOGLE_ACCESS_TOKEN || "";
const fragment = JSON.parse(fs.readFileSync(new URL("../firebase/church.rules.json", import.meta.url), "utf8"));

if (!databaseUrl) {
  console.error("NEXT_PUBLIC_FIREBASE_DATABASE_URL이 없어 church 규칙을 합치지 못했습니다.");
  process.exit(1);
}

if (!token) {
  console.error("FIREBASE_TOKEN이 없어 church 규칙을 합치지 못했습니다.");
  process.exit(1);
}

const response = await fetch(`${databaseUrl}/.settings/rules.json?access_token=${encodeURIComponent(token)}`);
if (!response.ok) {
  console.error(`기존 규칙을 읽지 못했습니다. ${response.status}`);
  process.exit(1);
}
const current = await response.json();
const rules = current && typeof current === "object" && current.rules ? current.rules : current;
if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
  console.error("기존 규칙 형식이 올바르지 않습니다.");
  process.exit(1);
}
const next = { ...rules, church: fragment.church };
for (const key of ["live-interpret", "cheil", "jifc"]) {
  if (JSON.stringify(rules[key] ?? null) !== JSON.stringify(next[key] ?? null)) {
    console.error(`${key} 규칙이 바뀌어 저장을 멈췄습니다.`);
    process.exit(1);
  }
}
const saved = await fetch(`${databaseUrl}/.settings/rules.json?access_token=${encodeURIComponent(token)}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  // RTDB REST는 최상위에 rules 키가 있어야 합니다.
  body: JSON.stringify({ rules: next }),
});
if (!saved.ok) {
  console.error(`규칙을 저장하지 못했습니다. ${saved.status}`);
  process.exit(1);
}
console.log("church 규칙을 합쳤습니다. live-interpret, cheil, jifc 는 그대로입니다.");
