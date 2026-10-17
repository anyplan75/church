import { access, readFile } from "node:fs/promises";
import path from "node:path";

// sync 직후 iOS가 실제로 읽는 public/index.html 이 HTML인지 확인한다.
const indexPath = path.join(process.cwd(), "ios", "App", "App", "public", "index.html");
const configPath = path.join(process.cwd(), "ios", "App", "App", "capacitor.config.json");

try {
  await access(indexPath);
} catch {
  console.error("ios/App/App/public/index.html 없음. mobile:sync 로 out/ 를 복사하세요.");
  process.exit(1);
}

const html = await readFile(indexPath, "utf8");
const trimmed = html.trimStart();
const hasHtmlShell =
  /<!DOCTYPE\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
const looksLikeRawRsc =
  !hasHtmlShell &&
  (trimmed.startsWith("0:") ||
    trimmed.includes("text/x-component") ||
    /^[0-9]+:/.test(trimmed) ||
    trimmed.includes("$Sreact.fragment"));

if (looksLikeRawRsc || !hasHtmlShell) {
  console.error("ios public/index.html 이 HTML이 아니거나 RSC 원문처럼 보입니다. STATIC_EXPORT 빌드 후 다시 sync 하세요.");
  process.exit(1);
}

const config = JSON.parse(await readFile(configPath, "utf8"));
if (config?.server && "url" in config.server) {
  console.error("ios capacitor.config.json 에 server.url 이 있습니다. strip 후 다시 sync 하세요.");
  process.exit(1);
}
if (config?.webDir && config.webDir !== "out") {
  console.error(`webDir 은 out 이어야 합니다. 현재: ${config.webDir}`);
  process.exit(1);
}

console.log("capacitor public/ 확인: index.html HTML OK, server.url 없음");
