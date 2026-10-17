#!/usr/bin/env node
/**
 * 은혜로운 예배 — Firebase RTDB `/church` 일일 미러.
 * 서비스 계정 JSON·토큰은 환경 변수/파일로만 받고, 규칙·다른 앱 경로는 건드리지 않는다.
 *
 * 필수(둘 중 하나):
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — 서비스 계정 JSON 문자열
 *   GOOGLE_APPLICATION_CREDENTIALS — 서비스 계정 JSON 파일 경로
 *   또는 FIREBASE_TOKEN / GOOGLE_ACCESS_TOKEN — 이미 발급된 access token
 *
 * 선택:
 *   FIREBASE_DATABASE_URL — 기본: live-interpret RTDB URL
 *   MIRROR_OUT_DIR        — 출력 폴더 (기본: ./mirror-out)
 *   MIRROR_INCLUDE_FILES  — "1"이면 churches/<id>/files 포함 (용량 큼)
 *   MIRROR_CHURCH_IDS     — 쉼표 구분 교회 ID만 미러 (비우면 churchIndex 전체)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  "https://live-interpret-db65e-default-rtdb.asia-southeast1.firebasedatabase.app";

const BANNED = new Set(["live-interpret", "cheil", "jifc"]);
const OUT_DIR = path.resolve(process.env.MIRROR_OUT_DIR || "mirror-out");
const INCLUDE_FILES = process.env.MIRROR_INCLUDE_FILES === "1";
const ONLY_IDS = (process.env.MIRROR_CHURCH_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assertSafeRelative(relative) {
  const clean = String(relative || "").replace(/^\/+|\/+$/g, "");
  const body = clean === "church" ? "" : clean.startsWith("church/") ? clean.slice("church/".length) : clean;
  if (!body) fail("빈 Firebase 경로");
  const parts = body.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) fail(`잘못된 Firebase 경로: ${relative}`);
  if (parts.some((part) => BANNED.has(part.toLowerCase()))) {
    fail("live-interpret, cheil, jifc 경로는 읽을 수 없습니다.");
  }
  return ["church", ...parts].join("/");
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) return JSON.parse(raw);
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (file) return JSON.parse(fs.readFileSync(file, "utf8"));
  return null;
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function accessTokenFromServiceAccount(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = sign
    .sign(sa.private_key)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const assertion = `${unsigned}.${signature}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await response.text();
  if (!response.ok) fail(`토큰 발급 실패 ${response.status}: ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  if (!json.access_token) fail("access_token 없음");
  return json.access_token;
}

async function resolveToken() {
  const existing = process.env.FIREBASE_TOKEN || process.env.GOOGLE_ACCESS_TOKEN;
  if (existing) return existing;
  const sa = loadServiceAccount();
  if (!sa) {
    fail(
      "인증이 없습니다. FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS, 또는 FIREBASE_TOKEN을 설정하세요.",
    );
  }
  return accessTokenFromServiceAccount(sa);
}

async function rtdbGet(token, relative) {
  const pathName = assertSafeRelative(relative);
  const url = `${DATABASE_URL}/${pathName}.json?access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) fail(`읽기 실패 ${pathName}: ${response.status} ${text.slice(0, 160)}`);
  if (!text || text === "null") return null;
  return JSON.parse(text);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

async function main() {
  const token = await resolveToken();
  const when = stamp();
  const root = path.join(OUT_DIR, when);
  fs.mkdirSync(root, { recursive: true });

  const manifest = {
    product: "은혜로운 예배",
    databaseUrl: DATABASE_URL,
    rootedAt: "church",
    createdAt: new Date().toISOString(),
    includeFiles: INCLUDE_FILES,
    churchIds: [],
    notes: "live-interpret / cheil / jifc 경로는 제외. 규칙(.settings/rules)은 읽지 않음.",
  };

  const platform = await rtdbGet(token, "platform");
  writeJson(path.join(root, "platform.json"), platform);

  const churchIndex = await rtdbGet(token, "churchIndex");
  writeJson(path.join(root, "churchIndex.json"), churchIndex);

  const accounts = await rtdbGet(token, "accounts");
  writeJson(path.join(root, "accounts.json"), accounts);

  const indexIds = churchIndex && typeof churchIndex === "object" ? Object.keys(churchIndex) : [];
  const churchIds = ONLY_IDS.length ? ONLY_IDS : indexIds;
  manifest.churchIds = churchIds;

  for (const id of churchIds) {
    if (!/^c[a-z0-9]{6,16}$/i.test(id)) {
      console.warn(`건너뜀(잘못된 churchId): ${id}`);
      continue;
    }
    const churchDir = path.join(root, "churches", id);
    const meta = await rtdbGet(token, `churches/${id}/meta`);
    const data = await rtdbGet(token, `churches/${id}/data`);
    const members = await rtdbGet(token, `churches/${id}/members`);
    writeJson(path.join(churchDir, "meta.json"), meta);
    writeJson(path.join(churchDir, "data.json"), data);
    writeJson(path.join(churchDir, "members.json"), members);
    if (INCLUDE_FILES) {
      const files = await rtdbGet(token, `churches/${id}/files`);
      writeJson(path.join(churchDir, "files.json"), files);
    }
    console.log(`mirrored church/${id}`);
  }

  writeJson(path.join(root, "manifest.json"), manifest);
  writeJson(path.join(OUT_DIR, "latest-pointer.json"), { stamp: when, path: root });
  console.log(`완료: ${root}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
