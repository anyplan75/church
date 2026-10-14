import fs from "node:fs";

const databaseUrl = "https://live-interpret-db65e-default-rtdb.asia-southeast1.firebasedatabase.app";
const token = process.env.FIREBASE_TOKEN || process.env.GOOGLE_ACCESS_TOKEN || "";
const fragment = JSON.parse(fs.readFileSync(new URL("../firebase/church.rules.json", import.meta.url), "utf8"));

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
  body: JSON.stringify(next),
});
if (!saved.ok) {
  console.error(`규칙을 저장하지 못했습니다. ${saved.status}`);
  process.exit(1);
}
console.log("church 규칙을 합쳤습니다. live-interpret, cheil, jifc 는 그대로입니다.");
