export function cueLines(lines: string[]): string[] {
  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((line) => line.slice(0, 80));
}

type CueMessage = { serviceId: string; lines: string[] };

const CHANNEL = "church-output-cue";

export function publishCue(serviceId: string, lines: string[]) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  const message: CueMessage = { serviceId, lines: cueLines(lines) };
  channel.postMessage(message);
  channel.close();
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
