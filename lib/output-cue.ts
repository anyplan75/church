export function rememberedCue(raw: string, serviceId: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const record = data as { serviceId?: unknown; lines?: unknown };
  if (record.serviceId !== serviceId || !Array.isArray(record.lines)) return [];
  return cueLines(record.lines.map((line) => String(line)));
}

export function cueLines(lines: string[]): string[] {
  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((line) => line.slice(0, 80));
}

type CueMessage = { serviceId: string; lines: string[] };

const CHANNEL = "church-output-cue";

export function slideMessage(serviceId: string, lines: string[], seq = 0): string {
  const body: { serviceId: string; lines: string[]; seq?: number } = { serviceId, lines: cueLines(lines) };
  if (seq > 0) body.seq = seq;
  return JSON.stringify(body);
}

export function readSlideMessage(raw: string, serviceId: string): string[] | null {
  return readSlidePacket(raw, serviceId)?.lines ?? null;
}

export function readSlidePacket(raw: string, serviceId: string): { lines: string[]; seq: number } | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as { serviceId?: unknown; lines?: unknown; seq?: unknown };
  if (record.serviceId !== serviceId || !Array.isArray(record.lines)) return null;
  const seq = typeof record.seq === "number" && record.seq > 0 ? record.seq : 0;
  return { seq, lines: cueLines(record.lines.map((line) => String(line))) };
}

export function keepSlideSeq(seen: number, seq: number): { keep: boolean; seen: number } {
  if (seen > 0 && seq < seen) return { keep: false, seen };
  return { keep: true, seen: seq > seen ? seq : seen };
}

export function publishCue(serviceId: string, lines: string[]) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  const message: CueMessage = { serviceId, lines: cueLines(lines) };
  channel.postMessage(message);
  channel.close();
}

export type OutputLinkStatus = "waiting" | "retry" | "direct" | "no-ip" | "no-signal" | "unreachable";

export function outputHoldText(_status: OutputLinkStatus): string {
  return "";
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
