import { patchOutputDirect, readDb, readOutputDirect } from "./app-db";
import { cueLines, readSlideMessage, slideMessage } from "./output-cue";
import { currentOutputHost, directCandidate, directDescription, thisComputer } from "./output-host";

const ICE: RTCConfiguration = { iceServers: [] };
const MODES = ["overlay", "main"] as const;
type Mode = (typeof MODES)[number];

type DirectRoom = {
  offer?: unknown;
  offerIce?: unknown;
  answer?: unknown;
  answerIce?: unknown;
};

type Slot = {
  host: string;
  mode: Mode;
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  localSdp: string;
  posted: boolean;
  answered: boolean;
  appliedAnswer: string;
  rejected: string;
  started: number;
  localIce: RTCIceCandidateInit[];
  seenRemote: Set<string>;
  queuedRemote: RTCIceCandidateInit[];
  iceTimer: number;
};

const OPERATOR_SERVICE_KEY = "church-output-service";
const SERVICE_ID = /^[A-Za-z0-9-]{1,80}$/;

let latest = { serviceId: "", lines: [] as string[] };
const slots = new Map<Mode, Slot>();
let operatorService = "";
let operatorTimer = 0;
let operatorBusy = false;
let linkGeneration = 0;
let warned = "";

function warnOnce(error: unknown) {
  const message = error instanceof Error ? error.message : "fail";
  if (warned === message) return;
  warned = message;
  console.warn(`송출 연결: ${message}`);
}

export function publishLinesNow(serviceId: string, lines: string[]) {
  latest = { serviceId, lines: cueLines(lines) };
  if (typeof RTCPeerConnection === "undefined") return;
  sendLatest(serviceId);
}

export function readOperatorService(): string {
  if (operatorService) return operatorService;
  if (typeof sessionStorage === "undefined") return "";
  try {
    const stored = sessionStorage.getItem(OPERATOR_SERVICE_KEY) || "";
    return SERVICE_ID.test(stored) ? stored : "";
  } catch {
    return "";
  }
}

export function startOperatorLink(serviceId: string): () => void {
  if (!SERVICE_ID.test(serviceId)) return () => undefined;
  const same = Boolean(operatorTimer) && operatorService === serviceId;
  rememberOperatorService(serviceId);
  if (typeof RTCPeerConnection === "undefined") return () => undefined;
  if (same) return () => undefined;
  for (const slot of slots.values()) closeSlot(slot);
  slots.clear();
  const generation = ++linkGeneration;
  if (operatorTimer) window.clearInterval(operatorTimer);
  operatorBusy = false;
  void operatorTick(generation);
  operatorTimer = window.setInterval(() => void operatorTick(generation), 400);
  return () => {
    if (generation !== linkGeneration) return;
  };
}

export function kickOperatorLink() {
  if (typeof RTCPeerConnection === "undefined") return;
  const id = operatorService || readOperatorService();
  if (!operatorTimer) {
    if (id) startOperatorLink(id);
    return;
  }
  void operatorTick(linkGeneration);
}

export function stopOperatorLink() {
  stopOperator();
}

function rememberOperatorService(serviceId: string) {
  operatorService = serviceId;
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(OPERATOR_SERVICE_KEY, serviceId);
  } catch {
    /* 이번 화면의 연결은 그대로 둡니다. */
  }
}

function stopOperator() {
  linkGeneration += 1;
  if (operatorTimer) window.clearInterval(operatorTimer);
  operatorTimer = 0;
  operatorService = "";
  operatorBusy = false;
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(OPERATOR_SERVICE_KEY);
    } catch {
      /* 저장소가 없어도 피어는 닫습니다. */
    }
  }
  for (const slot of slots.values()) closeSlot(slot);
  slots.clear();
}

export function startViewerLink(
  serviceId: string,
  mode: Mode,
  onLines: (lines: string[]) => void,
  onStatus?: (status: "waiting" | "retry" | "direct") => void,
): () => void {
  if (typeof RTCPeerConnection === "undefined") return () => undefined;
  let host = "";
  let started = Date.now();
  const localIce: RTCIceCandidateInit[] = [];
  const seen = new Set<string>();
  const queued: RTCIceCandidateInit[] = [];
  let answeredSdp = "";
  let localAnswer = "";
  let posted = false;
  let stop = false;
  let busy = false;
  let opened = false;
  let viewGeneration = 0;
  let iceTimer = 0;
  const markOpen = (generation: number) => () => {
    if (generation !== viewGeneration) return;
    opened = true;
    onStatus?.("direct");
  };
  let pc = openViewer(serviceId, onLines, markOpen(viewGeneration));

  const flushIce = () => {
    window.clearTimeout(iceTimer);
    iceTimer = window.setTimeout(() => {
      if (!host || !localAnswer) return;
      void patchOutputDirect(host, mode, { answerIce: localIce.slice(-12) }).catch(() => undefined);
    }, 80);
  };
  const arm = (peer: RTCPeerConnection) => {
    peer.onicecandidate = (event) => {
      const init = candidateInit(event.candidate);
      if (!init) return;
      localIce.push(init);
      flushIce();
    };
  };
  arm(pc);

  function replacePc() {
    window.clearTimeout(iceTimer);
    pc.onicecandidate = null;
    pc.close();
    localIce.length = 0;
    seen.clear();
    queued.length = 0;
    answeredSdp = "";
    localAnswer = "";
    posted = false;
    opened = false;
    started = Date.now();
    viewGeneration += 1;
    pc = openViewer(serviceId, onLines, markOpen(viewGeneration));
    arm(pc);
  }

  function down(): boolean {
    const state = pc.connectionState;
    const ice = pc.iceConnectionState;
    if (state === "connected" || ice === "connected" || ice === "completed") return false;
    if (Date.now() - started < 1500) return false;
    if (state === "failed" || state === "closed" || ice === "failed" || ice === "closed") return true;
    if (ice === "disconnected" || state === "disconnected") return opened && Date.now() - started > 8000;
    return false;
  }

  async function tick() {
    if (stop || busy) return;
    const nextHost = thisComputer();
    if (!nextHost) return;
    busy = true;
    try {
      if (host && host !== nextHost) replacePc();
      host = nextHost;
      if (stop) return;
      if (down()) {
        if (opened) onStatus?.("retry");
        replacePc();
      }
      const room = await readOutputDirect(host, mode);
      if (stop || room === undefined) return;
      const record = asRoom(room);
      const offer = sessionDesc(record.offer, "offer");
      if (offer?.sdp && offer.sdp !== answeredSdp) {
        if (answeredSdp || pc.signalingState !== "stable") replacePc();
        await pc.setRemoteDescription(offer);
        for (const item of queued.splice(0)) await pc.addIceCandidate(item).catch(() => undefined);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitGather(pc);
        const local = pc.localDescription;
        if (local?.sdp) {
          localAnswer = local.sdp;
          answeredSdp = offer.sdp;
          posted = false;
        }
      }
      const roomAnswer = sessionDesc(record.answer, "answer");
      if (localAnswer && roomAnswer?.sdp !== localAnswer) posted = false;
      if (localAnswer && !posted) {
        posted = await patchOutputDirect(host, mode, {
          answer: { type: "answer", sdp: localAnswer },
          answerIce: localIce.slice(-12),
        });
      }
      for (const item of iceList(record.offerIce)) {
        const key = item.candidate ?? "";
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (!pc.remoteDescription) queued.push(item);
        else await pc.addIceCandidate(item).catch(() => undefined);
      }
    } catch (error) {
      posted = false;
      warnOnce(error);
      if (opened) onStatus?.("retry");
    } finally {
      busy = false;
    }
  }

  onStatus?.("waiting");
  void tick();
  const timer = window.setInterval(() => void tick(), 400);
  return () => {
    stop = true;
    window.clearInterval(timer);
    window.clearTimeout(iceTimer);
    pc.close();
  };
}

function openViewer(serviceId: string, onLines: (lines: string[]) => void, onOpen: () => void): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE);
  pc.ondatachannel = (event) => {
    const channel = event.channel;
    channel.binaryType = "arraybuffer";
    channel.onopen = onOpen;
    if (channel.readyState === "open") onOpen();
    channel.onmessage = (message) => {
      void frameText(message.data).then((raw) => {
        const lines = readSlideMessage(raw, serviceId);
        if (lines !== null) onLines(lines);
      });
    };
  };
  return pc;
}

async function operatorTick(generation: number) {
  if (operatorBusy || !operatorService || generation !== linkGeneration) return;
  operatorBusy = true;
  const serviceId = operatorService;
  try {
    const host = currentOutputHost(readDb().settings.outputHost);
    if (generation !== linkGeneration) return;
    if (!host) {
      for (const slot of slots.values()) closeSlot(slot);
      slots.clear();
      return;
    }
    for (const mode of MODES) {
      if (generation !== linkGeneration) return;
      await ensureSlot(serviceId, host, mode, generation);
    }
    if (generation !== linkGeneration) return;
    sendLatest(serviceId);
  } catch (error) {
    if (generation === linkGeneration) warnOnce(error);
  } finally {
    if (generation === linkGeneration) operatorBusy = false;
  }
}

async function ensureSlot(serviceId: string, host: string, mode: Mode, generation: number) {
  let slot = slots.get(mode);
  if (slot && slot.host !== host) {
    closeSlot(slot);
    slots.delete(mode);
    slot = undefined;
  }
  if (slot?.channel.readyState === "open" && !peerDown(slot)) return;

  for (let round = 0; round < 2; round += 1) {
    if (!slot || peerDown(slot)) {
      if (slot) closeSlot(slot);
      slot = createSlot(serviceId, host, mode);
      slots.set(mode, slot);
    }
    const ready = await publishLocalOffer(slot, host, mode, generation);
    if (!ready || generation !== linkGeneration) return;
    const room = await readOutputDirect(host, mode);
    if (room === undefined || generation !== linkGeneration) return;
    const record = asRoom(room);
    const answer = sessionDesc(record.answer, "answer");
    if (answer?.sdp && slot.appliedAnswer && answer.sdp !== slot.appliedAnswer && slot.channel.readyState !== "open") {
      closeSlot(slot);
      slots.delete(mode);
      slot = undefined;
      continue;
    }
    if (answer?.sdp && answer.sdp !== slot.rejected && !slot.answered && slot.pc.signalingState === "have-local-offer") {
      const aimed = directDescription(answer.sdp, host);
      try {
        await slot.pc.setRemoteDescription({ type: "answer", sdp: aimed });
        slot.answered = true;
        slot.appliedAnswer = answer.sdp;
        for (const item of slot.queuedRemote.splice(0)) await slot.pc.addIceCandidate(aimCandidate(item, host)).catch(() => undefined);
      } catch {
        slot.rejected = answer.sdp;
      }
    }
    for (const item of iceList(record.answerIce)) {
      const key = item.candidate ?? "";
      if (!key || slot.seenRemote.has(key)) continue;
      slot.seenRemote.add(key);
      const aimed = aimCandidate(item, host);
      if (!slot.pc.remoteDescription) slot.queuedRemote.push(aimed);
      else await slot.pc.addIceCandidate(aimed).catch(() => undefined);
    }
    return;
  }
}

async function publishLocalOffer(slot: Slot, host: string, mode: Mode, generation: number): Promise<boolean> {
  if (!slot.localSdp) {
    const offer = await withTimeout(slot.pc.createOffer(), 5000);
    if (generation !== linkGeneration) return false;
    await withTimeout(slot.pc.setLocalDescription(offer), 5000);
    if (generation !== linkGeneration) return false;
    await waitGather(slot.pc);
    if (generation !== linkGeneration) return false;
    slot.localSdp = slot.pc.localDescription?.sdp ?? "";
    slot.posted = false;
  }
  if (!slot.localSdp || generation !== linkGeneration) return false;
  if (!slot.posted) {
    slot.posted = await patchOutputDirect(host, mode, {
      offer: { type: "offer", sdp: slot.localSdp },
      offerIce: slot.localIce.slice(-12),
      answer: null,
      answerIce: null,
    });
  }
  return true;
}

function createSlot(serviceId: string, host: string, mode: Mode): Slot {
  const pc = new RTCPeerConnection(ICE);
  const channel = pc.createDataChannel("slides");
  const slot: Slot = {
    host,
    mode,
    pc,
    channel,
    localSdp: "",
    posted: false,
    answered: false,
    appliedAnswer: "",
    rejected: "",
    started: Date.now(),
    localIce: [],
    seenRemote: new Set(),
    queuedRemote: [],
    iceTimer: 0,
  };
  channel.onopen = () => {
    if (latest.serviceId === serviceId) channel.send(slideMessage(serviceId, latest.lines));
  };
  pc.onicecandidate = (event) => {
    const init = candidateInit(event.candidate);
    if (!init) return;
    slot.localIce.push(init);
    window.clearTimeout(slot.iceTimer);
    slot.iceTimer = window.setTimeout(() => {
      if (!slot.localSdp) return;
      void patchOutputDirect(host, mode, { offerIce: slot.localIce.slice(-12) }).catch(() => undefined);
    }, 80);
  };
  return slot;
}

function peerDown(slot: Slot): boolean {
  const state = slot.pc.connectionState;
  const ice = slot.pc.iceConnectionState;
  const age = Date.now() - slot.started;
  if (slot.channel.readyState === "open") return false;
  if (age < 1500) return false;
  if (state === "failed" || state === "closed" || ice === "failed" || ice === "closed") return true;
  if (slot.channel.readyState === "closed") return age > 5000;
  return age > 20000;
}

function closeSlot(slot: Slot) {
  window.clearTimeout(slot.iceTimer);
  slot.pc.close();
}

function sendLatest(serviceId: string) {
  if (latest.serviceId !== serviceId || typeof RTCPeerConnection === "undefined") return;
  const payload = slideMessage(serviceId, latest.lines);
  for (const slot of slots.values()) {
    if (slot.channel.readyState !== "open" || slot.channel.bufferedAmount > 8000) continue;
    slot.channel.send(payload);
  }
}

function aimCandidate(item: RTCIceCandidateInit, host: string): RTCIceCandidateInit {
  return { ...item, candidate: item.candidate ? directCandidate(item.candidate, host) : item.candidate };
}

async function frameText(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (typeof Blob !== "undefined" && data instanceof Blob) return data.text();
  return "";
}

function asRoom(value: unknown): DirectRoom {
  if (!value || typeof value !== "object") return {};
  return value as DirectRoom;
}

function sessionDesc(value: unknown, type: "offer" | "answer"): RTCSessionDescriptionInit | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { type?: unknown; sdp?: unknown };
  if (record.type !== type || typeof record.sdp !== "string") return null;
  if (record.sdp.length < 20 || record.sdp.length > 100000) return null;
  return { type, sdp: record.sdp };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("시간 초과")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function waitGather(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(finish, 4000);
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
