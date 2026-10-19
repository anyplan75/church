"use strict";

const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { cleanHost } = require("./host.cjs");
const library = require("./library-folders.cjs");

let migratedLibrary = false;

function storePath() {
  return path.join(app.getPath("userData"), "eunhye-desktop.json");
}

function readStore() {
  try {
    const raw = fs.readFileSync(storePath(), "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return {};
    return data;
  } catch {
    return {};
  }
}

function writeStore(next) {
  const dir = path.dirname(storePath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(next, null, 2), "utf8");
}

function ensureLibraryMigrated() {
  if (migratedLibrary) return;
  migratedLibrary = true;
  try {
    library.migrateLibraryFolders({
      userDataDir: app.getPath("userData"),
      packaged: app.isPackaged,
      execPath: process.execPath,
      platform: process.platform,
      cwd: process.cwd(),
    });
  } catch (error) {
    console.warn("라이브러리 폴더 이전(Migration)에 실패했습니다.", error);
  }
}

function getOutputHost() {
  return cleanHost(readStore().outputHost);
}

function setOutputHost(value) {
  const host = cleanHost(value);
  const current = readStore();
  if (host) current.outputHost = host;
  else delete current.outputHost;
  writeStore(current);
  return host;
}

function getDisplayMode() {
  const mode = readStore().displayMode;
  return mode === "overlay" ? "overlay" : "main";
}

function setDisplayMode(value) {
  const current = readStore();
  current.displayMode = value === "overlay" ? "overlay" : "main";
  writeStore(current);
  return current.displayMode;
}

function getLibraryFolders() {
  ensureLibraryMigrated();
  return library.getLibraryFolders(storePath());
}

function setLibraryFolder(slot, folderPath) {
  ensureLibraryMigrated();
  return library.setLibraryFolder(storePath(), slot, folderPath);
}

function setLibraryFolders(next) {
  ensureLibraryMigrated();
  return library.setLibraryFolders(storePath(), next);
}

function libraryFolderView(slot) {
  const folders = getLibraryFolders();
  const key = library.cleanSlot(slot);
  if (!key) return library.summarizeFolder("");
  return library.summarizeFolder(folders[key] || "");
}

function listLibraryTxt(slot) {
  const folders = getLibraryFolders();
  const key = library.cleanSlot(slot);
  if (!key) return [];
  return library.listTxtNames(folders[key] || "");
}

function readLibraryTxt(slot, fileName) {
  const folders = getLibraryFolders();
  const key = library.cleanSlot(slot);
  if (!key) return null;
  const buf = library.readTxtFile(folders[key] || "", fileName);
  return buf ? Buffer.from(buf) : null;
}

function writeLibraryTxt(slot, fileName, text) {
  const folders = getLibraryFolders();
  const key = library.cleanSlot(slot);
  if (!key) return false;
  return library.writeTxtFile(folders[key] || "", fileName, text);
}

module.exports = {
  getOutputHost,
  setOutputHost,
  getDisplayMode,
  setDisplayMode,
  readStore,
  storePath,
  getLibraryFolders,
  setLibraryFolder,
  setLibraryFolders,
  libraryFolderView,
  listLibraryTxt,
  readLibraryTxt,
  writeLibraryTxt,
  ensureLibraryMigrated,
};
