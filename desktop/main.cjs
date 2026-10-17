"use strict";

const path = require("path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { createOutputServer, privateAddresses, DEFAULT_PORT } = require("./output-server.cjs");
const { createAdvertiser, createBrowser } = require("./discovery.cjs");
const { createStaticServer } = require("./static-server.cjs");
const store = require("./store.cjs");
const { cleanHost } = require("./host.cjs");

const MODE = resolveMode(process.argv);
const DISPLAY = resolveDisplay(process.argv);

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {ReturnType<typeof createOutputServer> | null} */
let outputServer = null;
/** @type {ReturnType<typeof createAdvertiser> | null} */
let advertiser = null;
/** @type {ReturnType<typeof createBrowser> | null} */
let browser = null;
/** @type {ReturnType<typeof createStaticServer> | null} */
let staticServer = null;
let appBase = "";
let peers = [];
let outputStatus = { clients: 0, host: "", port: DEFAULT_PORT };

function resolveMode(argv) {
  const arg = argv.find((item) => item.startsWith("--mode="));
  if (arg?.endsWith("output")) return "output";
  if (argv.includes("--output")) return "output";
  return "operator";
}

function resolveDisplay(argv) {
  const arg = argv.find((item) => item.startsWith("--display="));
  if (arg?.endsWith("overlay")) return "overlay";
  if (argv.includes("--overlay")) return "overlay";
  return "main";
}

function outDir() {
  return path.join(__dirname, "..", "out");
}

async function resolveAppBase() {
  if (process.env.ELECTRON_START_URL) return process.env.ELECTRON_START_URL.replace(/\/$/, "");
  staticServer = createStaticServer(outDir());
  const port = await staticServer.listen(0);
  return `http://127.0.0.1:${port}`;
}

function createWindow() {
  const isOutput = MODE === "output";
  const overlay = isOutput && DISPLAY === "overlay";
  mainWindow = new BrowserWindow({
    width: overlay ? 1280 : 1440,
    height: overlay ? 720 : 900,
    minWidth: 800,
    minHeight: 500,
    title: isOutput ? "은혜로운 예배 송출" : "은혜로운 예배",
    autoHideMenuBar: true,
    frame: !overlay,
    transparent: overlay,
    backgroundColor: overlay ? "#00000000" : "#1b3a32",
    fullscreen: isOutput && !overlay,
    alwaysOnTop: overlay,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isOutput) {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadURL(`${appBase}/receive/?mode=${DISPLAY}`);
  } else {
    mainWindow.loadURL(`${appBase}/`);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function bindIpc() {
  ipcMain.handle("desktop:mode", () => ({
    app: MODE,
    display: DISPLAY,
    port: DEFAULT_PORT,
  }));
  ipcMain.handle("desktop:getOutputHost", () => store.getOutputHost());
  ipcMain.handle("desktop:setOutputHost", (_event, host) => store.setOutputHost(host));
  ipcMain.handle("desktop:listPeers", () => peers);
  ipcMain.handle("desktop:refreshPeers", () => {
    browser?.start();
    return peers;
  });
  ipcMain.handle("desktop:localAddresses", () => privateAddresses());
  ipcMain.handle("desktop:outputStatus", () => outputStatus);
}

async function startOutputSide() {
  outputServer = createOutputServer({
    port: DEFAULT_PORT,
    onLines: (payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("desktop:lines", payload);
      }
    },
    onStatus: (status) => {
      outputStatus = status;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("desktop:output-status", status);
      }
    },
  });
  await outputServer.listen();
  outputStatus = {
    clients: 0,
    host: outputServer.preferredHost(),
    port: DEFAULT_PORT,
  };
  advertiser = createAdvertiser({ port: DEFAULT_PORT, name: `은혜로운 예배 송출` });
  advertiser.start();
}

function startOperatorSide() {
  browser = createBrowser({
    onUpdate: (list) => {
      peers = list;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("desktop:peers", list);
      }
    },
  });
  browser.start();
  const saved = store.getOutputHost();
  if (saved) peers = [{ host: saved, port: DEFAULT_PORT, name: saved }];
}

app.whenReady().then(async () => {
  bindIpc();
  appBase = await resolveAppBase();
  if (MODE === "output") await startOutputSide();
  else startOperatorSide();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  advertiser?.stop();
  browser?.stop();
  outputServer?.close();
  staticServer?.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  advertiser?.stop();
  browser?.stop();
  outputServer?.close();
  staticServer?.close();
});

// Keep a reference so tooling can import helpers in tests without launching Electron.
module.exports = { resolveMode, resolveDisplay, cleanHost, DEFAULT_PORT };
