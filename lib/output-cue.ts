export function cueLines(lines: string[]): string[] {
  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((line) => line.slice(0, 80));
}

type CueMessage = { serviceId: string; lines: string[] };

const CHANNEL = "church-output-cue";

export function slideMessage(serviceId: string, lines: string[]): string {
  return JSON.stringify({ serviceId, lines: cueLines(lines) });
}

export function readSlideMessage(raw: string, serviceId: string): string[] | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as { serviceId?: unknown; lines?: unknown };
  if (record.serviceId !== serviceId || !Array.isArray(record.lines)) return null;
  return cueLines(record.lines.map((line) => String(line)));
}

export function publishCue(serviceId: string, lines: string[]) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  const message: CueMessage = { serviceId, lines: cueLines(lines) };
  channel.postMessage(message);
  channel.close();
}

export function outputHoldText(status: "waiting" | "retry"): string {
  return status === "retry" ? "직접 연결이 끊겼습니다. 다시 연결합니다." : "조작 화면과 직접 연결 중입니다.";
}

export function subscribeCue(serviceId: string, onCue: (lines: string[]) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<CueMessage>) => {
    if (!event.data || event.data.serviceId !== serviceId || !Array.isArray(event.data.lines)) return;
    onCue(cueLines(event.data.lines));
  };
  return () => channel.close();
}
