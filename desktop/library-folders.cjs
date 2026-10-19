"use strict";

/**
 * 라이브러리 연결 폴더 경로를 Electron userData 에 두고,
 * 설치 폴더·예전 파일에 남은 경로가 있으면 한 번만 옮긴다.
 * (Win / Mac 공통)
 */

const fs = require("fs");
const path = require("path");

const SLOTS = ["bible", "hymn", "praise"];
const LEGACY_FILE_NAMES = ["library-folders.json", "eunhye-library-folders.json", "eunhye-desktop.json"];

function emptyFolders() {
  return { bible: "", hymn: "", praise: "" };
}

function cleanSlot(slot) {
  return SLOTS.includes(slot) ? slot : "";
}

function cleanPath(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return "";
  if (trimmed.includes("\0")) return "";
  return trimmed;
}

function normalizeFolders(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const nested = source.libraryFolders && typeof source.libraryFolders === "object" ? source.libraryFolders : source;
  return {
    bible: cleanPath(nested.bible),
    hymn: cleanPath(nested.hymn),
    praise: cleanPath(nested.praise),
  };
}

function hasAnyPath(folders) {
  return Boolean(folders.bible || folders.hymn || folders.praise);
}

function mergeFolders(base, extra) {
  const next = { ...emptyFolders(), ...base };
  for (const slot of SLOTS) {
    if (!next[slot] && extra[slot]) next[slot] = extra[slot];
  }
  return next;
}

function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

/** 설치(또는 실행) 폴더 근처 — 업데이트로 지워질 수 있는 위치 */
function installDirCandidates({ execPath = process.execPath, platform = process.platform, cwd = process.cwd(), packaged = false } = {}) {
  const dirs = new Set();
  const execDir = path.dirname(execPath);
  dirs.add(execDir);
  dirs.add(cwd);
  if (packaged && platform === "darwin") {
    // …/App.app/Contents/MacOS → App.app 옆, Applications 등
    const appBundle = path.resolve(execDir, "..", "..");
    dirs.add(path.dirname(appBundle));
    dirs.add(appBundle);
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    dirs.add(process.env.PORTABLE_EXECUTABLE_DIR);
  }
  return [...dirs];
}

function collectLegacyFolders(candidates) {
  let found = emptyFolders();
  for (const dir of candidates) {
    for (const name of LEGACY_FILE_NAMES) {
      const filePath = path.join(dir, name);
      const data = readJsonFile(filePath);
      if (!data) continue;
      found = mergeFolders(found, normalizeFolders(data));
    }
  }
  return found;
}

/**
 * userData 의 eunhye-desktop.json 에 libraryFolders 를 맞추고,
 * 설치 폴더 쪽 예전 파일이 있으면 경로를 합친 뒤 예전 파일의 libraryFolders 는 비운다.
 */
function migrateLibraryFolders({
  userDataDir,
  storeFileName = "eunhye-desktop.json",
  installDirs,
  execPath,
  platform,
  cwd,
  packaged,
} = {}) {
  if (!userDataDir) throw new Error("userDataDir 이 필요합니다.");
  const storePath = path.join(userDataDir, storeFileName);
  const current = readJsonFile(storePath) || {};
  let folders = normalizeFolders(current.libraryFolders || {});
  const legacy = collectLegacyFolders(
    installDirs || installDirCandidates({ execPath, platform, cwd, packaged }),
  );
  const before = { ...folders };
  folders = mergeFolders(folders, legacy);

  const changed = JSON.stringify(before) !== JSON.stringify(folders);
  if (changed || !current.libraryFolders) {
    current.libraryFolders = folders;
    writeJsonFile(storePath, current);
  }

  // 설치 폴더에 남아 있던 전용 파일은 옮긴 뒤 삭제(설정 전체 파일은 libraryFolders 만 비움)
  for (const dir of installDirs || installDirCandidates({ execPath, platform, cwd, packaged })) {
    for (const name of LEGACY_FILE_NAMES) {
      const filePath = path.join(dir, name);
      if (!fs.existsSync(filePath)) continue;
      if (path.resolve(filePath) === path.resolve(storePath)) continue;
      if (name === "eunhye-desktop.json") {
        const data = readJsonFile(filePath);
        if (!data || !data.libraryFolders) continue;
        delete data.libraryFolders;
        writeJsonFile(filePath, data);
      } else if (hasAnyPath(normalizeFolders(readJsonFile(filePath) || {}))) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* 권한 없으면 무시 */
        }
      }
    }
  }

  return folders;
}

function getLibraryFolders(storePath) {
  const current = readJsonFile(storePath) || {};
  return normalizeFolders(current.libraryFolders || {});
}

function setLibraryFolder(storePath, slot, folderPath) {
  const key = cleanSlot(slot);
  if (!key) return getLibraryFolders(storePath);
  const current = readJsonFile(storePath) || {};
  const folders = normalizeFolders(current.libraryFolders || {});
  const nextPath = cleanPath(folderPath);
  if (nextPath) folders[key] = nextPath;
  else folders[key] = "";
  current.libraryFolders = folders;
  writeJsonFile(storePath, current);
  return folders;
}

function setLibraryFolders(storePath, next) {
  const current = readJsonFile(storePath) || {};
  current.libraryFolders = normalizeFolders(next);
  writeJsonFile(storePath, current);
  return current.libraryFolders;
}

function folderExists(folderPath) {
  const cleaned = cleanPath(folderPath);
  if (!cleaned) return false;
  try {
    return fs.statSync(cleaned).isDirectory();
  } catch {
    return false;
  }
}

function listTxtNames(folderPath) {
  const cleaned = cleanPath(folderPath);
  if (!cleaned || !folderExists(cleaned)) return [];
  try {
    return fs
      .readdirSync(cleaned)
      .filter((name) => name.toLowerCase().endsWith(".txt") && !name.startsWith("."))
      .sort((a, b) => a.localeCompare(b, "ko"));
  } catch {
    return [];
  }
}

function summarizeFolder(folderPath) {
  const cleaned = cleanPath(folderPath);
  if (!cleaned) {
    return { state: "idle", folderName: "", txtCount: 0, names: [], path: "" };
  }
  if (!folderExists(cleaned)) {
    return {
      state: "reconnect",
      folderName: path.basename(cleaned) || cleaned,
      txtCount: 0,
      names: [],
      path: cleaned,
    };
  }
  const names = listTxtNames(cleaned);
  return {
    state: "connected",
    folderName: path.basename(cleaned) || cleaned,
    txtCount: names.length,
    names: names.slice(0, 5),
    path: cleaned,
  };
}

function readTxtFile(folderPath, fileName) {
  const dir = cleanPath(folderPath);
  const base = path.basename(String(fileName || ""));
  if (!dir || !base || !base.toLowerCase().endsWith(".txt") || base === "." || base === "..") {
    return null;
  }
  const full = path.join(dir, base);
  if (path.dirname(full) !== path.resolve(dir) && path.resolve(path.dirname(full)) !== path.resolve(dir)) {
    return null;
  }
  try {
    return fs.readFileSync(full);
  } catch {
    return null;
  }
}

function writeTxtFile(folderPath, fileName, text) {
  const dir = cleanPath(folderPath);
  const base = path.basename(String(fileName || ""));
  if (!dir || !folderExists(dir) || !base || !base.toLowerCase().endsWith(".txt") || base === "." || base === "..") {
    return false;
  }
  const full = path.join(dir, base);
  if (path.resolve(path.dirname(full)) !== path.resolve(dir)) return false;
  try {
    fs.writeFileSync(full, String(text ?? ""), "utf8");
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  SLOTS,
  LEGACY_FILE_NAMES,
  emptyFolders,
  cleanSlot,
  cleanPath,
  normalizeFolders,
  hasAnyPath,
  mergeFolders,
  installDirCandidates,
  collectLegacyFolders,
  migrateLibraryFolders,
  getLibraryFolders,
  setLibraryFolder,
  setLibraryFolders,
  folderExists,
  listTxtNames,
  summarizeFolder,
  readTxtFile,
  writeTxtFile,
};
