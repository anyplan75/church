import { createRequire } from "node:module";
import WebSocket from "ws";

const require = createRequire(import.meta.url);
const { createOutputServer } = require("../desktop/output-server.cjs");
const { linesPayload, parseMessage } = require("../desktop/protocol.cjs");

const server = createOutputServer({ port: 18766 });
await server.listen();

const received = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timeout")), 4000);
  const socket = new WebSocket("ws://127.0.0.1:18766");
  socket.on("open", () => {
    socket.send(linesPayload("svc-smoke", ["첫째 줄", "둘째 줄"], 1));
  });
  socket.on("message", (raw) => {
    const message = parseMessage(raw.toString());
    if (message?.type === "lines" && message.lines[0] === "첫째 줄") {
      clearTimeout(timer);
      socket.close();
      resolve(message.lines);
    }
  });
  socket.on("error", reject);
});

server.close();
if (received[1] !== "둘째 줄") throw new Error("bad lines");
console.log("lan-link smoke ok", received.join(" / "));
