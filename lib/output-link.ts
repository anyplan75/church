import { clearOutputRoom, patchOutputRoom, readOutputRoom } from "./app-db";
import { cueLines, publishCue, readSlideMessage, slideMessage } from "./output-cue";

const ICE: RTCConfiguration = { iceServers: [] };
const VIEWER_ID = /^v[a-z0-9]{6,12}$/;

type Room = {
  viewers?: Record<string, { at?: number; answer?: unknown; ice?: unknown }>;
  offers?: Record<string, { offer?: unknown; ice?: unknown }>;
};

type OperatorPeer = {
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  offered: boolean;
  answered: boolean;
  localIce: RTCIceCandidateInit[];
  seenRemote: Set<string>;
  queuedRemote: RTCIceCandidateInit[];
};

let latest = { serviceId: "", lines: [] as string[] };
const peers = new Map<string, OperatorPeer>();
let operatorService = "";
let operatorTimer = 0;
let operatorBusy = false;
let warned = "";

function warnOnce(error: unknown) {
  const message = error instanceof Error ? error.message : "fail";
  if (warned === message) return;
  warned = message;
  console.warn(`송출 연결: ${message}`);
}

export function publishLinesNow(serviceId: string, lines: string[]) {
  const cue = cueLines(lines);
  latest = { serviceId, lines: cue };
  publishCue(serviceId, cue);
  if (typeof RTCPeerConnection === "undefined") return;
  const payload = slideMessage(serviceId, cue);
  for (const peer of peers.values()) {
    if (peer.channel.readyState === "open") peer.channel.send(payload);
  }
}

export function startOperatorLink(serviceId: string): () => void {
  operatorService = serviceId;
  if (operatorTimer || typeof RTCPeerConnection === "undefined") return stopOperator;
  void operatorTick();
  operatorTimer = window.setInterval(() => void operatorTick(), 400);
  return stopOperator;
}

function stopOperator() {
  if (operatorTimer) window.clearInterval(operatorTimer);
  operatorTimer = 0;
  operatorService = "";
  for (const peer of peers.values()) peer.pc.close();
  peers.clear();
}

export function startViewerLink(serviceId: string, onLines: (lines: string[]) => void): () => void {
  if (typeof RTCPeerConnection === "undefined") return () => undefined;
  const id = viewerId();
  let pc = openViewer(serviceId, onLines);
  const localIce: RTCIceCandidateInit[] = [];
  const seen = new Set<string>();
  const queued: RTCIceCandidateInit[] = [];
  let answeredSdp = "";
  let localAnswer: RTCSessionDescriptionInit | null = null;
  let stop = false;
  let busy = false;
  let iceTimer = 0;

  const flushIce = () => {
    window.clearTimeout(iceTimer);
    iceTimer = window.setTimeout(() => {
      void patchOutputRoom(serviceId, `viewers/${id}`, { ice: localIce.slice(-12) }).catch(() => undefined);
    }, 80);
  };
  pc.onicecandidate = (event) => {
    const init = candidateInit(event.candidate);
    if (!init) return;
    localIce.push(init);
    flushIce();
  };

  function replacePc() {
    pc.onicecandidate = null;
    pc.close();
    localIce.length = 0;
    seen.clear();
    queued.length = 0;
    answeredSdp = "";
    localAnswer = null;
    pc = openViewer(serviceId, onLines);
    pc.onicecandidate = (event) => {
      const init = candidateInit(event.candidate);
      if (!init) return;
      localIce.push(init);
      flushIce();
    };
  }

  async function tick() {
    if (stop || busy) return;
    busy = true;
    try {
      await patchOutputRoom(serviceId, `viewers/${id}`, {
        at: Date.now(),
        ...(localAnswer && pc.connectionState !== "connected" ? { answer: localAnswer } : {}),
      });
      const room = asRoom(await readOutputRoom(serviceId));
      const slot = room.offers?.[id];
      const offer = sessionDesc(slot?.offer, "offer");
      if (offer?.sdp && offer.sdp !== answeredSdp) {
        if (answeredSdp || pc.signalingState !== "stable" || pc.connectionState === "failed") replacePc();
        await pc.setRemoteDescription(offer);
        for (const item of queued.splice(0)) await pc.addIceCandidate(item).catch(() => undefined);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitGather(pc);
        const local = pc.localDescription;
        if (local?.sdp) {
          localAnswer = { type: "answer", sdp: local.sdp };
          answeredSdp = offer.sdp;
          await patchOutputRoom(serviceId, `viewers/${id}`, { answer: localAnswer, at: Date.now(), ice: localIce.slice(-12) });
        }
      }
      for (const item of iceList(slot?.ice)) {
        const key = item.candidate ?? "";
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (!pc.remoteDescription) queued.push(item);
        else await pc.addIceCandidate(item).catch(() => undefined);
      }
    } catch (error) {
      warnOnce(error);
    } finally {
      busy = false;
    }
  }

  void tick();
  const timer = window.setInterval(() => void tick(), 400);
  return () => {
    stop = true;
    window.clearInterval(timer);
    window.clearTimeout(iceTimer);
    pc.close();
    void clearOutputRoom(serviceId, `viewers/${id}`).catch(() => undefined);
  };
}

function openViewer(serviceId: string, onLines: (lines: string[]) => void): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE);
  pc.ondatachannel = (event) => {
    event.channel.onmessage = (message) => {
      const lines = readSlideMessage(String(message.data), serviceId);
      if (lines !== null) onLines(lines);
    };
  };
  return pc;
}

async function operatorTick() {
  if (operatorBusy || !operatorService) return;
  operatorBusy = true;
  const serviceId = operatorService;
  try {
    const room = asRoom(await readOutputRoom(serviceId));
    const now = Date.now();
    const live = new Set<string>();
    for (const [id, viewer] of Object.entries(room.viewers ?? {})) {
      if (!VIEWER_ID.test(id)) continue;
      if (now - Number(viewer?.at ?? 0) > 25000) {
        peers.get(id)?.pc.close();
        peers.delete(id);
        void clearOutputRoom(serviceId, `viewers/${id}`).catch(() => undefined);
        void clearOutputRoom(serviceId, `offers/${id}`).catch(() => undefined);
        continue;
      }
      live.add(id);
      try {
        await ensureOffer(serviceId, id, viewer, room.offers?.[id]);
      } catch {
        peers.get(id)?.pc.close();
        peers.delete(id);
      }
    }
    for (const id of [...peers.keys()]) {
      if (live.has(id)) continue;
      peers.get(id)?.pc.close();
      peers.delete(id);
    }
  } catch (error) {
    warnOnce(error);
  } finally {
    operatorBusy = false;
  }
}

async function ensureOffer(
  serviceId: string,
  id: string,
  viewer: { answer?: unknown; ice?: unknown },
  posted: { offer?: unknown } | undefined,
) {
  let peer = peers.get(id);
  if (!peer || peer.pc.connectionState === "failed") {
    peer?.pc.close();
    peer = createOperatorPeer(serviceId, id);
    peers.set(id, peer);
  }
  if (!peer.offered) {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    await waitGather(peer.pc);
    peer.offered = true;
    const local = peer.pc.localDescription;
    if (!local?.sdp) return;
    await patchOutputRoom(serviceId, `offers/${id}`, {
      at: Date.now(),
      offer: { type: local.type, sdp: local.sdp },
      ice: peer.localIce.slice(-12),
    });
  } else if (!sessionDesc(posted?.offer, "offer") && peer.pc.localDescription) {
    await patchOutputRoom(serviceId, `offers/${id}/offer`, {
      type: peer.pc.localDescription.type,
      sdp: peer.pc.localDescription.sdp,
    });
  }
  const answer = sessionDesc(viewer.answer, "answer");
  if (answer && !peer.answered && peer.pc.signalingState === "have-local-offer") {
    try {
      await peer.pc.setRemoteDescription(answer);
      peer.answered = true;
      for (const item of peer.queuedRemote.splice(0)) await peer.pc.addIceCandidate(item).catch(() => undefined);
    } catch {
      /* 응답이 이번 제안과 맞지 않으면 다음 제안에 다시 받습니다. */
    }
  }
  for (const item of iceList(viewer.ice)) {
    const key = item.candidate ?? "";
    if (!key || peer.seenRemote.has(key)) continue;
    peer.seenRemote.add(key);
    if (!peer.pc.remoteDescription) peer.queuedRemote.push(item);
    else await peer.pc.addIceCandidate(item).catch(() => undefined);
  }
}

function createOperatorPeer(serviceId: string, id: string): OperatorPeer {
  const pc = new RTCPeerConnection(ICE);
  const channel = pc.createDataChannel("slides");
  const peer: OperatorPeer = {
    pc,
    channel,
    offered: false,
    answered: false,
    localIce: [],
    seenRemote: new Set(),
    queuedRemote: [],
  };
  channel.onopen = () => {
    if (latest.serviceId === serviceId) channel.send(slideMessage(serviceId, latest.lines));
  };
  let iceTimer = 0;
  pc.onicecandidate = (event) => {
    const init = candidateInit(event.candidate);
    if (!init) return;
    peer.localIce.push(init);
    window.clearTimeout(iceTimer);
    iceTimer = window.setTimeout(() => {
      void patchOutputRoom(serviceId, `offers/${id}`, { ice: peer.localIce.slice(-12) }).catch(() => undefined);
    }, 80);
  };
  return peer;
}

function viewerId(): string {
  const existing = sessionStorage.getItem("church-output-viewer");
  if (existing && VIEWER_ID.test(existing)) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const created = `v${Array.from(bytes, (byte) => (byte % 36).toString(36)).join("")}`;
  sessionStorage.setItem("church-output-viewer", created);
  return created;
}

function asRoom(value: unknown): Room {
  if (!value || typeof value !== "object") return {};
  return value as Room;
}

function sessionDesc(value: unknown, type: "offer" | "answer"): RTCSessionDescriptionInit | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { type?: unknown; sdp?: unknown };
  if (record.type !== type || typeof record.sdp !== "string") return null;
  if (record.sdp.length < 20 || record.sdp.length > 20000) return null;
  return { type, sdp: record.sdp };
}

function waitGather(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(finish, 2500);
    function finish() {
      pc.removeEventListener("icegatheringstatechange", onChange);
      window.clearTimeout(timer);
      resolve();
    }
    function onChange() {
      if (pc.iceGatheringState === "complete") finish();
    }
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

function iceList(value: unknown): RTCIceCandidateInit[] {
  const items = Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value as Record<string, unknown>) : [];
  const out: RTCIceCandidateInit[] = [];
  for (const item of items.slice(-16)) {
    if (!item || typeof item !== "object") continue;
    const candidate = (item as { candidate?: unknown }).candidate;
    if (typeof candidate !== "string" || candidate.length > 500 || candidate.includes(" typ relay")) continue;
    const sdpMid = (item as { sdpMid?: unknown }).sdpMid;
    const line = (item as { sdpMLineIndex?: unknown }).sdpMLineIndex;
    out.push({
      candidate,
      sdpMid: typeof sdpMid === "string" ? sdpMid : undefined,
      sdpMLineIndex: typeof line === "number" ? line : undefined,
    });
  }
  return out;
}

function candidateInit(candidate: RTCIceCandidate | null): RTCIceCandidateInit | null {
  if (!candidate?.candidate || candidate.candidate.includes(" typ relay")) return null;
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid ?? undefined,
    sdpMLineIndex: candidate.sdpMLineIndex ?? undefined,
  };
}
