import { access, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * sync 직후 iOS public/index.html 검사(조작 Operator만).
 * 예: node scripts/verify-capacitor-public.mjs
 *     node scripts/verify-capacitor-public.mjs operator
 */
const mode = (process.argv[2] || "operator").toLowerCase();
if (mode === "member") {
  console.error("성도(member) Capacitor 셸은 제거되었습니다. operator 만 검사합니다.");
  process.exit(1);
}

const app = {
  label: "ios/App/App/public",
  indexPath: path.join(process.cwd(), "ios", "App", "App", "public", "index.html"),
  configPath: path.join(process.cwd(), "ios", "App", "App", "capacitor.config.json"),
  expectAppId: "org.eunhye.worship.operator",
};

try {
  await access(app.indexPath);
} catch {
  console.error(`${app.label}/index.html 없음. sync 로 out/ 를 복사하세요.`);
  process.exit(1);
}

const html = await readFile(app.indexPath, "utf8");
const trimmed = html.trimStart();
const hasHtmlShell = /<!DOCTYPE\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
const looksLikeRawRsc =
  !hasHtmlShell &&
  (trimmed.startsWith("0:") ||
    trimmed.includes("text/x-component") ||
    /^[0-9]+:/.test(trimmed) ||
    trimmed.includes("$Sreact.fragment"));

if (looksLikeRawRsc || !hasHtmlShell) {
  console.error(`${app.label}/index.html 이 HTML이 아니거나 RSC 원문처럼 보입니다. STATIC_EXPORT 빌드 후 다시 sync 하세요.`);
  process.exit(1);
}

await access(app.configPath);
const config = JSON.parse(await readFile(app.configPath, "utf8"));
if (config?.server && "url" in config.server) {
  console.error(`${app.configPath} 에 server.url 이 있습니다. strip 후 다시 sync 하세요.`);
  process.exit(1);
}
if (config?.webDir && config.webDir !== "out") {
  console.error(`webDir 은 out 이어야 합니다. 현재: ${config.webDir}`);
  process.exit(1);
}
if (app.expectAppId && config?.appId && config.appId !== app.expectAppId) {
  console.error(`${app.label}: appId ${config.appId} ≠ ${app.expectAppId}`);
  process.exit(1);
}

const hasMeta = html.includes("eunhye-app-id") && html.includes(app.expectAppId);
const hasBoot = html.includes("__EUNHYE_APP_ID__") && html.includes(app.expectAppId);
if (!hasMeta && !hasBoot) {
  console.error(`${app.label}: eunhye-app-id(${app.expectAppId}) 메타/부트 스크립트 없음. inject 스크립트를 실행하세요.`);
  process.exit(1);
}
if (!html.includes('location.replace("/login/")') && !html.includes("location.replace('/login/')")) {
  console.error(`${app.label}: 루트 index 에 /login/ 이동 스크립트가 없습니다. inject 를 다시 실행하세요.`);
  process.exit(1);
}

console.log(`capacitor public/ 확인: ${app.label} HTML OK`);
