"use strict";

const DEFAULT_PORT = 18765;
const SERVICE_TYPE = "eunhye-worship";
const MAX_LINE = 80;

function cueLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => String(line ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((line) => line.slice(0, MAX_LINE));
}

function parseMessage(raw) {
  let data;
  try {
    data = JSON.parse(String(raw ?? ""));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const type = typeof data.type === "string" ? data.type : "";
  if (type === "ping" || type === "pong" || type === "ready") {
    return { type };
  }
  if (type === "hello") {
    const role = data.role === "operator" || data.role === "output" ? data.role : "";
    const name = String(data.name ?? "").trim().slice(0, 80);
    return role ? { type, role, name } : null;
  }
  if (type === "lines" || (!type && Array.isArray(data.lines))) {
    const serviceId = String(data.serviceId ?? "").trim().slice(0, 80);
    const seq = typeof data.seq === "number" && data.seq > 0 ? data.seq : 0;
    const lines = cueLines(data.lines);
    const style = data.style && typeof data.style === "object" ? data.style : undefined;
    return { type: "lines", serviceId, lines, seq, style };
  }
  return null;
}

function linesPayload(serviceId, lines, seq = 0, style) {
  const body = {
    type: "lines",
    serviceId: String(serviceId ?? "").trim().slice(0, 80),
    lines: cueLines(lines),
  };
  if (seq > 0) body.seq = seq;
  if (style && typeof style === "object") body.style = style;
  return JSON.stringify(body);
}

module.exports = {
  DEFAULT_PORT,
  SERVICE_TYPE,
  cueLines,
  parseMessage,
  linesPayload,
};
