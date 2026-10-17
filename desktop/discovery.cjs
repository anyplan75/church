"use strict";

const { DEFAULT_PORT, SERVICE_TYPE } = require("./protocol.cjs");
const { cleanHost } = require("./host.cjs");

function loadBonjour() {
  try {
    return require("bonjour-service");
  } catch {
    return null;
  }
}

function createAdvertiser({ port = DEFAULT_PORT, name = "은혜로운 예배 송출" } = {}) {
  const mod = loadBonjour();
  if (!mod) {
    return { start() {}, stop() {} };
  }
  const Bonjour = mod.Bonjour || mod.default || mod;
  const bonjour = new Bonjour();
  let service = null;
  return {
    start() {
      if (service) return;
      service = bonjour.publish({
        name,
        type: SERVICE_TYPE,
        port,
        txt: { app: "eunhye-worship", role: "output" },
      });
    },
    stop() {
      try {
        service?.stop();
      } catch {
        /* ignore */
      }
      service = null;
      try {
        bonjour.destroy();
      } catch {
        /* ignore */
      }
    },
  };
}

function createBrowser({ onUpdate } = {}) {
  const mod = loadBonjour();
  const peers = new Map();
  if (!mod) {
    return {
      start() {},
      stop() {},
      list() {
        return [];
      },
    };
  }
  const Bonjour = mod.Bonjour || mod.default || mod;
  const bonjour = new Bonjour();
  let browser = null;

  function emit() {
    const list = [...peers.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    onUpdate?.(list);
  }

  return {
    start() {
      if (browser) return;
      browser = bonjour.find({ type: SERVICE_TYPE }, (service) => {
        const host = cleanHost(service.referer?.address) || cleanHost(service.host) || cleanHost((service.addresses || []).find((item) => cleanHost(item)));
        if (!host) return;
        const port = typeof service.port === "number" && service.port > 0 ? service.port : DEFAULT_PORT;
        const name = String(service.name || host).trim() || host;
        peers.set(`${host}:${port}`, { host, port, name });
        emit();
      });
      browser.on("down", (service) => {
        const host = cleanHost(service.referer?.address) || cleanHost(service.host);
        const port = typeof service.port === "number" && service.port > 0 ? service.port : DEFAULT_PORT;
        if (!host) return;
        peers.delete(`${host}:${port}`);
        emit();
      });
    },
    stop() {
      try {
        browser?.stop();
      } catch {
        /* ignore */
      }
      browser = null;
      try {
        bonjour.destroy();
      } catch {
        /* ignore */
      }
      peers.clear();
    },
    list() {
      return [...peers.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    },
  };
}

module.exports = { createAdvertiser, createBrowser, SERVICE_TYPE, DEFAULT_PORT };
