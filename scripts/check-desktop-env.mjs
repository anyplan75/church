#!/usr/bin/env node
/**
 * 데스크톱 정적 빌드 전에 NEXT_PUBLIC Firebase 값이 있는지 확인합니다.
 * 값은 출력하지 않습니다.
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const required = ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_DATABASE_URL"];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = {
  ...loadEnvFile(path.join(root, ".env")),
  ...loadEnvFile(path.join(root, ".env.local")),
};

const missing = required.filter((key) => {
  const fromProcess = String(process.env[key] || "").trim();
  const fromFile = String(fileEnv[key] || "").trim();
  return !(fromProcess || fromFile);
});

if (missing.length) {
  console.error(
    `정적 웹 빌드(데스크톱·모바일)에 Firebase 공개 설정이 없습니다: ${missing.join(", ")}\n` +
      `.env.local에 값을 채운 뒤 다시 실행하세요. (.env.example 참고)`,
  );
  process.exit(1);
}

console.log("Firebase 공개 환경 변수 확인 완료(데스크톱·모바일 정적보내기).");
