"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

function createStaticServer(rootDir) {
  const root = path.resolve(rootDir);

  function resolveFile(urlPath) {
    let clean = decodeURIComponent(urlPath.split("?")[0] || "/");
    if (clean.includes("\0")) return null;
    if (!clean.startsWith("/")) clean = `/${clean}`;
    const candidates = [];
    if (clean.endsWith("/")) {
      candidates.push(path.join(root, clean, "index.html"));
    } else {
      candidates.push(path.join(root, clean));
      candidates.push(path.join(root, `${clean}.html`));
      candidates.push(path.join(root, clean, "index.html"));
    }
    for (const file of candidates) {
      const resolved = path.resolve(file);
      if (!resolved.startsWith(root)) continue;
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
    }
    const fallback = path.join(root, "404.html");
    if (fs.existsSync(fallback)) return fallback;
    return null;
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const file = resolveFile(url.pathname);
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });

  function listen(port = 0) {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", reject);
        const address = server.address();
        resolve(typeof address === "object" && address ? address.port : port);
      });
    });
  }

  function close() {
    server.close();
  }

  return { listen, close };
}

module.exports = { createStaticServer };
