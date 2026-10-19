import { access, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * sync 직후 iOS public/index.html 검사.
 * 인자 없으면 조작만 필수, 성도는 있을 때만 검사합니다.
 * 예: node scripts/verify-capacitor-public.mjs
 *     node scripts/verify-capacitor-public.mjs member
 *     node scripts/verify-capacitor-public.mjs operator
 */
const mode = (process.argv[2] || "auto").toLowerCase();

const catalog = {
  operator: {
    label: "ios/App/App/public",
    indexPath: path.join(process.cwd(), "ios", "App", "App", "public", "index.html"),
    configPath: path.join(process.cwd(), "ios", "App", "App", "capacitor.config.json"),
    expectAppId: "org.eunhye.worship.operator",
    required: true,
  },
  member: {
    label: "ios-member/App/App/public",
    indexPath: path.join(process.cwd(), "ios-member", "App", "App", "public", "index.html"),
    configPath: path.join(process.cwd(), "ios-member", "App", "App", "capacitor.config.json"),
    expectAppId: "org.eunhye.worship.member",
    required: mode === "member",
  },
};

const apps =
  mode === "operator"
    ? [catalog.operator]
    : mode === "member"
      ? [catalog.member]
      : [catalog.operator, catalog.member];

for (const app of apps) {
  try {
    await access(app.indexPath);
  } catch {
    if (!app.required) {
      console.log(`${app.label}: 없음 (건너뜀)`);
      continue;
    }
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

  try {
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
  } catch (err) {
    if (app.required) throw err;
  }

  if (app.expectAppId) {
    const hasMeta = html.includes("eunhye-app-id") && html.includes(app.expectAppId);
    const hasBoot = html.includes("__EUNHYE_APP_ID__") && html.includes(app.expectAppId);
    if (!hasMeta && !hasBoot) {
      if (!app.required) {
        console.log(`${app.label}: eunhye-app-id 아직 없음 (성도 sync 때 주입)`);
        continue;
      }
      console.error(`${app.label}: eunhye-app-id(${app.expectAppId}) 메타/부트 스크립트 없음. inject 스크립트를 실행하세요.`);
      process.exit(1);
    }
  }

  console.log(`capacitor public/ 확인: ${app.label} HTML OK`);
}
