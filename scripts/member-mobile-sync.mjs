#!/usr/bin/env node
/**
 * 성도용 Capacitor 동기화.
 * 1) 정적 export → out/
 * 2) ios-member 가 없으면 cap add ios (별도 설정)
 * 3) cap sync --config capacitor.member.config.ts
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = path.join(root, "capacitor.member.config.ts");
const iosMember = path.join(root, "ios-member");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...opts });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("node", [path.join(root, "scripts/run-static-export.mjs")]);
run("node", [path.join(root, "scripts/ensure-capacitor-out.mjs")]);

if (!fs.existsSync(iosMember)) {
  console.log("ios-member 가 없어 Capacitor iOS 프로젝트를 만듭니다…");
  // Capacitor는 기본 ios/ 만 쓰므로, 잠깐 capacitor.config를 멤버용으로 맞춘 뒤 생성·이동한다.
  const mainConfig = path.join(root, "capacitor.config.ts");
  const backup = path.join(root, "capacitor.config.operator.bak.ts");
  fs.copyFileSync(mainConfig, backup);
  fs.copyFileSync(config, mainConfig);
  try {
    if (fs.existsSync(path.join(root, "ios"))) {
      console.error("기존 ios/ 조작 앱이 있어 ios-member를 자동 생성하지 않습니다.");
      console.error("수동: npx cap add ios 후 번들 ID를 org.eunhye.worship.member 로 바꾸거나,");
      console.error("문서 docs/member-app.md 의 iOS 준비 단계를 따르세요.");
    } else {
      run("npx", ["cap", "add", "ios"]);
      fs.renameSync(path.join(root, "ios"), iosMember);
    }
  } finally {
    fs.copyFileSync(backup, mainConfig);
    fs.unlinkSync(backup);
  }
}

if (fs.existsSync(iosMember)) {
  // cap sync는 기본 ios 폴더를 쓰므로, 잠시 ios-member → ios 심볼릭/이동은 위험.
  // 대신 설정만 검증하고 안내한다.
  console.log("성도용 웹(out/) 준비 완료. iOS 동기화는 아래를 참고하세요:");
  console.log("  1) App Store Connect에 org.eunhye.worship.member / 은혜로운 예배 성도 등록");
  console.log("  2) ios-member 프로젝트에서 Capacitor sync (docs/member-app.md)");
} else {
  console.log("성도용 웹(out/) 준비 완료. ios-member는 아직 없습니다 — docs/member-app.md 참고.");
}

run("node", [path.join(root, "scripts/verify-capacitor-public.mjs")]);
