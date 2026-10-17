import { cueLines } from "./output-cue";
import { cleanHost } from "./output-host";
import { desktopApi, type DesktopLinesPayload } from "./desktop-api";

export const LAN_OUTPUT_PORT = 18765;

type LanStatus = "idle" | "connecting" | "direct" | "error";

type Style = DesktopLinesPayload["style"];

let socket: WebSocket | null = null;
let host = "";
let status: LanStatus = "idle";
let latest = { serviceId: "", lines: [] as string[], seq: 0, style: undefined as Style };
let reconnectTimer = 0;
let generation = 0;
const statusListeners = new Set<(value: LanStatus) => void>();

function setStatus(next: LanStatus) {
  if (status === next) return;
  status = next;
  for (const listener of statusListeners) listener(status);
}

export function lanLinkStatus(): LanStatus {
  return status;
}

export function subscribeLanStatus(listener: (value: LanStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => {
    statusListeners.delete(listener);
  };
}

export function rememberLanHost(value: unknown): string {
  const next = cleanHost(value);
  host = next;
  const api = desktopApi();
  if (api) void api.setOutputHost(next);
  if (next) ensureLanSocket();
  else closeLanSocket();
  return next;
}

export async function restoreLanHost(settingsHost?: unknown): Promise<string> {
  const api = desktopApi();
  const fromDesktop = api ? cleanHost(await api.getOutputHost()) : "";
  const next = cleanHost(settingsHost) || fromDesktop || host;
  host = next;
  if (next) ensureLanSocket();
  return next;
}

export function publishLanLines(serviceId: string, lines: string[], style?: Style) {
  latest = {
    serviceId,
    lines: cueLines(lines),
    seq: latest.seq + 1,
    style,
  };
  const api = desktopApi();
  if (api?.pushLines) {
    void api.pushLines({
      serviceId: latest.serviceId,
      lines: latest.lines,
      seq: latest.seq,
      style: latest.style,
    });
  }
  ensureLanSocket();
  sendLatest(true);
}

/** 크롬 송출: 조작 PC(from)의 18765에 붙어 지금 두 줄만 받는다. IP 입력 UI 없음. */
export function startLanViewer(
  targetHost: string,
  onLines: (lines: string[], style?: Style) => void,
  onStatus?: (status: LanStatus) => void,
): () => void {
  const target = cleanHost(targetHost);
  if (!target || typeof WebSocket === "undefined") {
    onStatus?.("idle");
    return () => undefined;
  }
  let stop = false;
  let socket: WebSocket | null = null;
  let timer = 0;
  let gen = 0;

  function report(next: LanStatus) {
    onStatus?.(next);
  }

  function connect() {
    if (stop) return;
    const round = ++gen;
    report("connecting");
    const next = new WebSocket(`ws://${target}:${LAN_OUTPUT_PORT}`);
    socket = next;
    next.onopen = () => {
      if (stop || round !== gen || socket !== next) return;
      report("direct");
      try {
        next.send(JSON.stringify({ type: "hello", role: "output", name: "chrome" }));
      } catch {
        /* 다음 재연결에서 다시 시도 */
      }
    };
    next.onmessage = (event) => {
      if (stop || round !== gen || socket !== next) return;
      const message = readLanMessage(event.data);
      if (!message) return;
      if (message.type === "ready") {
        report("direct");
        return;
      }
      if (message.type !== "lines") return;
      report("direct");
      onLines(message.lines, message.style);
    };
    next.onerror = () => {
      if (stop || round !== gen || socket !== next) return;
      report("error");
    };
    next.onclose = () => {
      if (stop || round !== gen) return;
      socket = null;
      report("error");
      timer = window.setTimeout(connect, 1200);
    };
  }

  connect();
  return () => {
    stop = true;
    gen += 1;
    if (timer) window.clearTimeout(timer);
    timer = 0;
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }
    socket = null;
  };
}

function readLanMessage(raw: unknown): { type: string; lines: string[]; style?: Style } | null {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as { type?: unknown; lines?: unknown; style?: unknown };
  const type = typeof record.type === "string" ? record.type : Array.isArray(record.lines) ? "lines" : "";
  if (type === "ready" || type === "ping" || type === "pong" || type === "hello") return { type, lines: [] };
  if (type !== "lines" || !Array.isArray(record.lines)) return null;
  const style = record.style && typeof record.style === "object" ? (record.style as Style) : undefined;
  return { type: "lines", lines: cueLines(record.lines.map((line) => String(line))), style };
}

function ensureLanSocket() {
  if (!host || typeof WebSocket === "undefined") return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    if (socketUrl(host) === socket.url || socket.url.endsWith(`@${host}:${LAN_OUTPUT_PORT}/`) || socket.url.includes(`${host}:${LAN_OUTPUT_PORT}`)) {
      return;
    }
    closeLanSocket();
  }
  const gen = ++generation;
  setStatus("connecting");
  const next = new WebSocket(`ws://${host}:${LAN_OUTPUT_PORT}`);
  socket = next;
  next.onopen = () => {
    if (gen !== generation || socket !== next) return;
    setStatus("direct");
    sendLatest(true);
  };
  next.onmessage = () => {
    if (gen !== generation || socket !== next) return;
    if (status !== "direct") setStatus("direct");
  };
  next.onerror = () => {
    if (gen !== generation || socket !== next) return;
    setStatus("error");
  };
  next.onclose = () => {
    if (gen !== generation || socket !== next) return;
    socket = null;
    setStatus(host ? "error" : "idle");
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (!host) return;
  if (reconnectTimer) window.clearTimeout(reconnectTimer);
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = 0;
    ensureLanSocket();
  }, 1200);
}

function closeLanSocket() {
  generation += 1;
  if (reconnectTimer) window.clearTimeout(reconnectTimer);
  reconnectTimer = 0;
  if (socket) {
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  }
  socket = null;
  setStatus("idle");
}

function sendLatest(force = false) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  if (!force && latest.seq <= 0) return;
  if (latest.seq <= 0) return;
  try {
    socket.send(
      JSON.stringify({
        type: "lines",
        serviceId: latest.serviceId,
        lines: latest.lines,
        seq: latest.seq,
        style: latest.style,
      }),
    );
  } catch {
    setStatus("error");
  }
}

function socketUrl(value: string): string {
  return `ws://${value}:${LAN_OUTPUT_PORT}/`;
}

export async function listOutputPeers() {
  const api = desktopApi();
  if (!api) return [] as { host: string; port: number; name: string }[];
  return api.refreshPeers();
}
