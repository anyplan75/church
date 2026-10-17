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
