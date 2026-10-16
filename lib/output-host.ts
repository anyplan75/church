export const OUTPUT_HOST_KEY = "church-output-host";
export const THIS_COMPUTER_KEY = "church-this-computer";

const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}$`);
const FIND_IPV4 = new RegExp(`${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}`, "g");

export function cleanHost(value: unknown): string {
  const text = String(value ?? "").trim();
  return IPV4.test(text) ? text : "";
}

export function isPrivateIpv4(value: unknown): boolean {
  const host = cleanHost(value);
  if (!host) return false;
  const [a, b] = host.split(".").map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return a === 192 && b === 168;
}

export function hostKey(value: unknown): string {
  const host = cleanHost(value);
  return host ? host.replaceAll(".", "-") : "";
}

export function directCandidate(candidate: string, host: unknown): string {
  const clean = cleanHost(host);
  if (!clean || !candidate) return candidate;
  return candidate.replace(/\S+\.local/g, clean);
}

export function directDescription(sdp: string, host: unknown): string {
  const clean = cleanHost(host);
  if (!clean || !sdp) return sdp;
  return sdp
    .split(/\r\n|\n/)
    .map((line) => line.replace(/\S+\.local/g, clean))
    .join("\r\n");
}

export function numericAddressFromCandidate(candidate: string): string {
  const matches = candidate.match(FIND_IPV4) ?? [];
  return matches.find((item) => isPrivateIpv4(item)) ?? "";
}

export function readStoredHost(key: string): string {
  if (typeof localStorage === "undefined") return "";
  return cleanHost(localStorage.getItem(key));
}

export function currentOutputHost(settingsHost?: unknown): string {
  const fromSettings = cleanHost(settingsHost);
  if (!fromSettings) return readStoredHost(OUTPUT_HOST_KEY);
  if (typeof localStorage !== "undefined" && localStorage.getItem(OUTPUT_HOST_KEY) !== fromSettings) {
    localStorage.setItem(OUTPUT_HOST_KEY, fromSettings);
  }
  return fromSettings;
}

export function saveOutputHost(value: unknown): string {
  const host = cleanHost(value);
  if (typeof localStorage === "undefined") return host;
  if (host) localStorage.setItem(OUTPUT_HOST_KEY, host);
  else localStorage.removeItem(OUTPUT_HOST_KEY);
  return host;
}

export function saveThisComputer(value: unknown): string {
  const host = cleanHost(value);
  if (!host || typeof localStorage === "undefined") return host;
  localStorage.setItem(THIS_COMPUTER_KEY, host);
  return host;
}

export function thisComputer(): string {
  return readStoredHost(THIS_COMPUTER_KEY);
}

export function detectPrivateAddress(): Promise<string> {
  if (typeof RTCPeerConnection === "undefined") return Promise.resolve("");
  return new Promise((resolve) => {
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    } catch {
      resolve("");
      return;
    }
    let found = "";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      pc.close();
      resolve(found);
    };
    const timer = window.setTimeout(finish, 2500);
    pc.onicecandidate = (event) => {
      const address = numericAddressFromCandidate(event.candidate?.candidate ?? "");
      if (!address) return;
      found = address;
      finish();
    };
    pc.createDataChannel("ip");
    void pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(finish);
  });
}
