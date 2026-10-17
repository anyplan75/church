"use strict";

const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { cleanHost } = require("./host.cjs");

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

module.exports = {
  getOutputHost,
  setOutputHost,
  getDisplayMode,
  setDisplayMode,
  readStore,
};
