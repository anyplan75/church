export const OUTPUT_HOST_KEY = "church-output-host";
export const THIS_COMPUTER_KEY = "church-this-computer";
export const OPERATOR_SERVICE_KEY = "church-output-service";

const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}$`);
const FIND_IPV4 = new RegExp(`${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}`, "g");

export function cleanHost(value: unknown): string {
  const text = String(value ?? "").trim();
  return IPV4.test(text) ? text : "";
}

export function hostEntry(value: unknown): { host: string; problem: "" | "url" | "invalid" } {
  const text = String(value ?? "").trim();
  const host = cleanHost(text);
  if (host || !text) return { host, problem: "" };
  const page = /https?:\/\//i.test(text) || /surge\.sh/i.test(text) || text.includes("/") || text.includes("?");
  return { host: "", problem: page ? "url" : "invalid" };
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

export function outputSignalHost(settingsHost: unknown, storedHost: unknown, computerHost: unknown): string {
  return cleanHost(settingsHost) || cleanHost(storedHost) || cleanHost(computerHost);
}

export function cleanServiceId(value: unknown): string {
  const id = String(value ?? "").trim();
  return /^[A-Za-z0-9-]{1,80}$/.test(id) ? id : "";
}

export function outputReturnPath(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text.startsWith("/")) return "";
  const hash = text.indexOf("#");
  const bare = hash === -1 ? text : text.slice(0, hash);
  const queryAt = bare.indexOf("?");
  let path = queryAt === -1 ? bare : bare.slice(0, queryAt);
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/output-computer") return path;
  if (!/^\/services\/[A-Za-z0-9-]{1,80}\/output$/.test(path)) return "";
  const params = new URLSearchParams(queryAt === -1 ? "" : bare.slice(queryAt + 1));
  const mode = params.get("mode") === "overlay" ? "overlay" : "main";
  return `${path}?mode=${mode}`;
}

export function savedOutputTarget(settingsHost: unknown, storedHost: unknown, storedService: unknown): { host: string; serviceId: string } | null {
  const host = outputSignalHost(settingsHost, storedHost, "");
  const serviceId = cleanServiceId(storedService);
  if (!host || !serviceId) return null;
  return { host, serviceId };
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
      void pc
        .getStats()
        .then((stats) => {
          stats.forEach((report) => {
            const record = report as { address?: unknown; relatedAddress?: unknown };
            const address = cleanHost(record.address);
            const related = cleanHost(record.relatedAddress);
            if (!found && isPrivateIpv4(address)) found = address;
            if (!found && isPrivateIpv4(related)) found = related;
          });
        })
        .catch(() => undefined)
        .finally(() => {
          pc.close();
          resolve(found);
        });
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
