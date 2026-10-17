"use strict";

const fs = require("fs");
const path = require("path");

/**
 * macOS 패키지 옆에 Windows와 같은 조작/송출/오버레이 실행 파일을 둡니다.
 * @param {import('electron-builder').AfterPackContext} context
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const srcDir = path.join(context.packager.projectDir, "desktop", "mac-launchers");
  if (!fs.existsSync(srcDir)) return;
  const outDir = context.appOutDir;
  for (const name of fs.readdirSync(srcDir)) {
    if (!name.endsWith(".command")) continue;
    const from = path.join(srcDir, name);
    const to = path.join(outDir, name);
    fs.copyFileSync(from, to);
    fs.chmodSync(to, 0o755);
  }
};
