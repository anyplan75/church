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

export type OutputLinkStatus = "waiting" | "retry" | "direct" | "no-ip" | "no-signal" | "unreachable";

export function outputHoldText(status: OutputLinkStatus): string {
  if (status === "direct") return "연결되었습니다.";
  if (status === "retry") return "다시 연결합니다.";
  if (status === "no-ip") return "설정에 송출 컴퓨터 IP가 없습니다.";
  if (status === "no-signal") return "직접 연결 신호를 보내지 못했습니다.";
  if (status === "unreachable") return "송출 컴퓨터 IP로 연결하지 못했습니다.";
  return "조작 화면과 직접 연결 중입니다.";
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
