"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("eunhyeDesktop", {
  mode: () => ipcRenderer.invoke("desktop:mode"),
  isDesktop: true,
  getOutputHost: () => ipcRenderer.invoke("desktop:getOutputHost"),
  setOutputHost: (host) => ipcRenderer.invoke("desktop:setOutputHost", host),
  listPeers: () => ipcRenderer.invoke("desktop:listPeers"),
  refreshPeers: () => ipcRenderer.invoke("desktop:refreshPeers"),
  localAddresses: () => ipcRenderer.invoke("desktop:localAddresses"),
  outputStatus: () => ipcRenderer.invoke("desktop:outputStatus"),
  pushLines: (payload) => ipcRenderer.invoke("desktop:pushLines", payload),
  getLibraryFolders: () => ipcRenderer.invoke("desktop:getLibraryFolders"),
  setLibraryFolder: (slot, folderPath) => ipcRenderer.invoke("desktop:setLibraryFolder", slot, folderPath),
  setLibraryFolders: (next) => ipcRenderer.invoke("desktop:setLibraryFolders", next),
  libraryFolderView: (slot) => ipcRenderer.invoke("desktop:libraryFolderView", slot),
  listLibraryTxt: (slot) => ipcRenderer.invoke("desktop:listLibraryTxt", slot),
  readLibraryTxt: (slot, fileName) => ipcRenderer.invoke("desktop:readLibraryTxt", slot, fileName),
  writeLibraryTxt: (slot, fileName, text) => ipcRenderer.invoke("desktop:writeLibraryTxt", slot, fileName, text),
  pickLibraryFolder: (slot) => ipcRenderer.invoke("desktop:pickLibraryFolder", slot),
  onLines: (handler) => {
    const listen = (_event, payload) => handler(payload);
    ipcRenderer.on("desktop:lines", listen);
    return () => ipcRenderer.removeListener("desktop:lines", listen);
  },
  onPeers: (handler) => {
    const listen = (_event, peers) => handler(peers);
    ipcRenderer.on("desktop:peers", listen);
    return () => ipcRenderer.removeListener("desktop:peers", listen);
  },
  onOutputStatus: (handler) => {
    const listen = (_event, status) => handler(status);
    ipcRenderer.on("desktop:output-status", listen);
    return () => ipcRenderer.removeListener("desktop:output-status", listen);
  },
});
