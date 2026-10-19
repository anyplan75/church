#!/usr/bin/env node
/**
 * 성도용 Capacitor 동기화.
 * 1) 정적 export → out/
 * 2) capacitor.config.ts 를 잠시 멤버용으로 바꾼 뒤
 *    ios-member 생성(cap add) 또는 동기화(cap sync)
 * 3) 조작용 capacitor.config.ts / ios/ 는 되돌린다.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const memberConfig = path.join(root, "capacitor.member.config.ts");
const mainConfig = path.join(root, "capacitor.config.ts");
const backup = path.join(root, "capacitor.config.operator.bak.ts");
const iosMember = path.join(root, "ios-member");
const iosMemberApp = path.join(iosMember, "App");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function withMemberCapacitorConfig(fn) {
  if (!fs.existsSync(memberConfig)) {
    console.error("capacitor.member.config.ts 가 없습니다.");
    process.exit(1);
  }
  fs.copyFileSync(mainConfig, backup);
  fs.copyFileSync(memberConfig, mainConfig);
  try {
    return fn();
  } finally {
    fs.copyFileSync(backup, mainConfig);
    fs.unlinkSync(backup);
  }
}

run("node", [path.join(root, "scripts/run-static-export.mjs")]);
run("node", [path.join(root, "scripts/ensure-capacitor-out.mjs")]);

withMemberCapacitorConfig(() => {
  if (!fs.existsSync(iosMemberApp)) {
    console.log("ios-member 생성 (cap add ios, path=ios-member)…");
    // 빈 README만 있는 ios-member/ 가 있으면 cap add 가 헷갈릴 수 있어 잠시 치운다.
    const readmeOnly =
      fs.existsSync(iosMember) &&
      fs.readdirSync(iosMember).every((name) => name === "README.md" || name.startsWith("."));
    let parkedReadme = null;
    if (readmeOnly) {
      parkedReadme = path.join(root, ".ios-member-README.md.bak");
      fs.renameSync(path.join(iosMember, "README.md"), parkedReadme);
      fs.rmdirSync(iosMember);
    }
    try {
      run("npx", ["cap", "add", "ios"]);
    } finally {
      if (parkedReadme && fs.existsSync(parkedReadme)) {
        fs.mkdirSync(iosMember, { recursive: true });
        // cap add 가 README를 안 넣으면 원래 안내를 복구
        if (!fs.existsSync(path.join(iosMember, "README.md"))) {
          fs.renameSync(parkedReadme, path.join(iosMember, "README.md"));
        } else {
          fs.unlinkSync(parkedReadme);
        }
      }
    }
  } else {
    console.log("ios-member 동기화 (cap sync ios)…");
    run("npx", ["cap", "sync", "ios"]);
  }
});

run("node", [path.join(root, "scripts/strip-capacitor-server-url.mjs")]);
run("node", [
  path.join(root, "scripts/inject-eunhye-app-id.mjs"),
  path.join(root, "ios-member/App/App/public"),
  "org.eunhye.worship.member",
]);
run("node", [path.join(root, "scripts/verify-capacitor-public.mjs"), "member"]);
console.log("성도용 웹·iOS 동기화 완료 → ios-member/");