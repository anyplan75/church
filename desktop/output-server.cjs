"use strict";

const http = require("http");
const os = require("os");
const { WebSocketServer } = require("ws");
const { DEFAULT_PORT, parseMessage, linesPayload } = require("./protocol.cjs");
const { cleanHost, isPrivateIpv4 } = require("./host.cjs");

function privateAddresses() {
  const found = [];
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const item of list) {
      if (item.family !== "IPv4" && item.family !== 4) continue;
      if (item.internal) continue;
      if (!isPrivateIpv4(item.address)) continue;
      found.push(item.address);
    }
  }
  return found;
}

function createOutputServer({ port = DEFAULT_PORT, onLines, onStatus } = {}) {
  let latest = { serviceId: "", lines: [], seq: 0, style: undefined };
  let clients = 0;

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("은혜로운 예배 송출");
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket) => {
    clients += 1;
    onStatus?.({ clients, host: preferredHost(), port });
    if (latest.seq > 0) {
      socket.send(linesPayload(latest.serviceId, latest.lines, latest.seq, latest.style));
    } else {
      socket.send(JSON.stringify({ type: "ready" }));
    }
    socket.on("message", (raw) => {
      const message = parseMessage(raw.toString());
      if (!message) return;
      if (message.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
        return;
      }
      if (message.type !== "lines") return;
      if (message.seq > 0 && message.seq < latest.seq) return;
      latest = {
        serviceId: message.serviceId,
        lines: message.lines,
        seq: message.seq || latest.seq + 1,
        style: message.style,
      };
      onLines?.(latest);
      const out = linesPayload(latest.serviceId, latest.lines, latest.seq, latest.style);
      for (const client of wss.clients) {
        if (client.readyState === 1) client.send(out);
      }
    });
    socket.on("close", () => {
      clients = Math.max(0, clients - 1);
      onStatus?.({ clients, host: preferredHost(), port });
    });
  });

  function preferredHost() {
    return privateAddresses()[0] || "";
  }

  function listen() {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "0.0.0.0", () => {
        server.off("error", reject);
        resolve({ port, hosts: privateAddresses() });
      });
    });
  }

  function close() {
    for (const client of wss.clients) client.close();
    wss.close();
    server.close();
  }

  function pushLines(serviceId, lines, seq, style) {
    latest = {
      serviceId: String(serviceId ?? ""),
      lines: Array.isArray(lines) ? lines : [],
      seq: typeof seq === "number" && seq > 0 ? seq : latest.seq + 1,
      style,
    };
    onLines?.(latest);
    const out = linesPayload(latest.serviceId, latest.lines, latest.seq, latest.style);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(out);
    }
  }

  return { listen, close, pushLines, preferredHost, port: () => port };
}

module.exports = { createOutputServer, privateAddresses, DEFAULT_PORT, cleanHost };
