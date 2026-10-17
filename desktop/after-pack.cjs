"use strict";

const fs = require("fs");
const path = require("path");

/**
 * macOS 26에서 electron-builder가 Helper 앱을 productName으로 바꾸면
 * Electron이 Helper를 찾지 못하고 SIGTRAP(exit 133)으로 바로 종료됩니다.
 * Helper 번들·실행 파일 이름을 원래 Electron Helper* 로 되돌립니다.
 * @param {string} appOutDir
 */
function restoreElectronHelperNames(appOutDir) {
  const appName = fs.readdirSync(appOutDir).find((name) => name.endsWith(".app"));
  if (!appName) return;
  const frameworks = path.join(appOutDir, appName, "Contents", "Frameworks");
  if (!fs.existsSync(frameworks)) return;

  const suffixes = ["", " (GPU)", " (Plugin)", " (Renderer)"];
  for (const suffix of suffixes) {
    const targetName = `Electron Helper${suffix}.app`;
    const targetPath = path.join(frameworks, targetName);
    if (fs.existsSync(targetPath)) continue;

    const current = fs.readdirSync(frameworks).find((name) => {
      if (!name.endsWith(".app")) return false;
      if (suffix === "") {
        return /Helper\.app$/u.test(name) && !/Helper \(/u.test(name);
      }
      return name.endsWith(`Helper${suffix}.app`);
    });
    if (!current) continue;

    const currentPath = path.join(frameworks, current);
    fs.renameSync(currentPath, targetPath);

    const macosDir = path.join(targetPath, "Contents", "MacOS");
    if (!fs.existsSync(macosDir)) continue;
    const targetExe = `Electron Helper${suffix}`;
    for (const exe of fs.readdirSync(macosDir)) {
      if (exe === targetExe) continue;
      fs.renameSync(path.join(macosDir, exe), path.join(macosDir, targetExe));
    }
  }
}

/**
 * macOS 패키지 옆에 Windows와 같은 조작/송출/오버레이 실행 파일을 둡니다.
 * @param {import('electron-builder').AfterPackContext} context
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  restoreElectronHelperNames(context.appOutDir);

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
