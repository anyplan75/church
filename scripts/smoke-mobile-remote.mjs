/**
 * Capacitor처럼 보이는 브라우저에서 view-only 교회 계정으로 /remote 를 엽니다.
 * 진행(run) 역할이 없어도 권한 화면이 나오면 실패입니다.
 * 토큰·비밀번호·이메일은 출력하지 않습니다.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";

const ROOT = join(process.cwd(), "out");
const BUNDLE = "org.eunhye.worship.operator";

function resolveSimUdId() {
  if (process.env.SIM_UDID) return process.env.SIM_UDID;
  const listed = spawnSync("xcrun", ["simctl", "list", "devices", "booted"], { encoding: "utf8" });
  const match = (listed.stdout || "").match(/\(([0-9A-F-]{36})\)\s*\(Booted\)/i);
  if (!match) throw new Error("켜진 시뮬레이터가 없습니다. SIM_UDID 를 넣거나 iPhone 시뮬을 켜 주세요.");
  return match[1];
}

function loadEnvLocal() {
  const text = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

function platformRefreshFromSimulator() {
  const udid = resolveSimUdId();
  const data = spawnSync("xcrun", ["simctl", "get_app_container", udid, BUNDLE, "data"], { encoding: "utf8" });
  if (data.status !== 0) throw new Error("시뮬 앱 데이터 경로를 찾지 못했습니다. 앱을 한 번 실행해 로그인해 주세요.");
  const base = data.stdout.trim();
  const find = spawnSync("find", [join(base, "Library/WebKit"), "-name", "localstorage.sqlite3"], { encoding: "utf8" });
  const db = (find.stdout || "").trim().split("\n").find(Boolean);
  if (!db || !existsSync(db)) throw new Error("시뮬 localStorage DB가 없습니다.");
  spawnSync("sqlite3", [db, "SELECT writefile('/tmp/church-session-smoke.bin', value) FROM ItemTable WHERE key='church-worship-session';"]);
  const parsed = JSON.parse(readFileSync("/tmp/church-session-smoke.bin").toString("utf16le"));
  spawnSync("rm", ["-f", "/tmp/church-session-smoke.bin"]);
  if (!parsed.refreshToken) throw new Error("플랫폼 세션이 없습니다. 시뮬에서 전체 운영자로 한 번 로그인해 주세요.");
  return parsed.refreshToken;
}

async function refreshIdToken(refreshToken, apiKey) {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok || !data.id_token) throw new Error("플랫폼 토큰 갱신 실패");
  return { idToken: data.id_token, refreshToken: data.refresh_token || refreshToken };
}

async function dbGet(url, path, token) {
  const res = await fetch(`${url}/church/${path}.json?auth=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`dbGet ${res.status}`);
  return res.json();
}

async function dbSet(url, path, token, value) {
  const res = await fetch(`${url}/church/${path}.json?auth=${encodeURIComponent(token)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`dbSet ${res.status}`);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function startStatic() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      if (urlPath.endsWith("/")) urlPath += "index.html";
      let file = join(ROOT, urlPath);
      if (!existsSync(file) || statSync(file).isDirectory()) {
        const asDir = join(ROOT, urlPath, "index.html");
        if (existsSync(asDir)) file = asDir;
        else {
          res.writeHead(404);
          res.end("missing");
          return;
        }
      }
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
      res.end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

loadEnvLocal();
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const dbUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "").replace(/\/+$/, "");
if (!apiKey || !dbUrl) throw new Error("Firebase 공개 설정이 없습니다.");

const platformRefresh = platformRefreshFromSimulator();
const platform = await refreshIdToken(platformRefresh, apiKey);
const index = (await dbGet(dbUrl, "churchIndex", platform.idToken)) || {};
const churchId = Object.keys(index).find((id) => /^c[a-z0-9]{6,16}$/.test(id));
if (!churchId) throw new Error("시험용 교회가 없습니다.");

const stamp = randomBytes(4).toString("hex");
const email = `mobile-remote-smoke-${stamp}@example.com`;
const password = `Smk${randomBytes(9).toString("base64url")}!9`;

const signUp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, returnSecureToken: true }),
});
const created = await signUp.json();
if (!signUp.ok || !created.localId || !created.idToken || !created.refreshToken) throw new Error("시험 계정 생성 실패");
const uid = created.localId;
const member = { email, churchId, roles: { view: true } };
await dbSet(dbUrl, `accounts/${uid}`, platform.idToken, member);
await dbSet(dbUrl, `churches/${churchId}/members/${uid}`, platform.idToken, member);

// 실제 로그인과 같은 세션 형태로 주입 (run 역할 없음)
const churchSession = JSON.stringify({
  accountId: uid,
  email,
  refreshToken: created.refreshToken,
  idToken: created.idToken,
  expiresAt: Date.now() + 50 * 60 * 1000,
  kind: "church",
  churchId,
});

const server = await startStatic();
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.addInitScript((session) => {
  window.Capacitor = { isNativePlatform: () => true };
  localStorage.setItem("church-worship-session", session);
}, churchSession);

let failed = "";
try {
  // 로그인 성공 후 랜딩과 같이 /login → 프레임이 /remote 로 보냄
  await page.goto(`http://127.0.0.1:${port}/login/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => location.pathname.includes("/remote") || (document.body?.innerText || "").includes("이 화면을 열 수 없습니다"), {
    timeout: 20000,
  });

  await page.waitForFunction(
    () => {
      const t = document.body?.innerText || "";
      return t.includes("이 화면을 열 수 없습니다") || t.includes("슬라이드 넘기기") || t.includes("현재 예배") || t.includes("송출");
    },
    { timeout: 45000 },
  );

  let bodyText = await page.locator("body").innerText();
  const safe = () => bodyText.replace(/\S+@\S+/g, "[email]").replace(/\s+/g, " ").slice(0, 220);

  if (bodyText.includes("이 화면을 열 수 없습니다")) {
    failed = `권한 오류 화면 | ${safe()}`;
  } else if (!page.url().includes("/remote")) {
    failed = `경로가 /remote 아님: ${page.url()} | ${safe()}`;
  } else {
    const serviceButtons = page.locator("button").filter({ hasText: /예배|주일|수요|새벽|특/ });
    if ((await serviceButtons.count()) > 0) {
      await serviceButtons.first().click();
      await page.waitForTimeout(1200);
      bodyText = await page.locator("body").innerText();
    }
    const hasRemote = ["슬라이드 넘기기", "현재 예배", "송출", "나가기"].some((t) => bodyText.includes(t));
    if (!hasRemote) {
      failed = `리모컨 UI 없음 | ${safe()}`;
    } else {
      const next = page.getByRole("button", { name: "다음" });
      const prev = page.getByRole("button", { name: "이전" });
      if ((await next.count()) > 0) {
        await next.first().click();
        await page.waitForTimeout(400);
      }
      if ((await prev.count()) > 0) {
        await prev.first().click();
        await page.waitForTimeout(400);
      }
      bodyText = await page.locator("body").innerText();
      if (bodyText.includes("이 화면을 열 수 없습니다")) failed = "넘긴 뒤 권한 오류";
    }
  }
} catch (error) {
  failed = error instanceof Error ? error.message : "unknown";
}

await browser.close();
server.close();

try {
  await dbSet(dbUrl, `accounts/${uid}`, platform.idToken, null);
  await dbSet(dbUrl, `churches/${churchId}/members/${uid}`, platform.idToken, null);
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: created.idToken }),
  });
} catch {
  /* ignore */
}

if (failed) {
  console.error("FAIL:", failed);
  process.exit(1);
}
console.log("OK: view-only 교회 세션 → /remote (권한 화면 없음, 리모컨·이전/다음 확인).");
