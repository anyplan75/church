export type DesktopPeer = {
  host: string;
  port: number;
  name: string;
};

export type DesktopLinesPayload = {
  serviceId: string;
  lines: string[];
  seq: number;
  style?: {
    backgroundColor?: string;
    backgroundUrl?: string;
    overlay?: string;
    mainFontSize?: number;
    overlayFontSize?: number;
    vertical?: number;
  };
};

export type DesktopApi = {
  isDesktop: true;
  mode: () => Promise<{ app: "operator" | "output"; display: "main" | "overlay"; port: number }>;
  getOutputHost: () => Promise<string>;
  setOutputHost: (host: string) => Promise<string>;
  listPeers: () => Promise<DesktopPeer[]>;
  refreshPeers: () => Promise<DesktopPeer[]>;
  localAddresses: () => Promise<string[]>;
  outputStatus: () => Promise<{ clients: number; host: string; port: number }>;
  pushLines?: (payload: DesktopLinesPayload) => Promise<boolean>;
  onLines: (handler: (payload: DesktopLinesPayload) => void) => () => void;
  onPeers: (handler: (peers: DesktopPeer[]) => void) => () => void;
  onOutputStatus: (handler: (status: { clients: number; host: string; port: number }) => void) => () => void;
};

declare global {
  interface Window {
    eunhyeDesktop?: DesktopApi;
  }
}

export function desktopApi(): DesktopApi | null {
  if (typeof window === "undefined") return null;
  return window.eunhyeDesktop ?? null;
}

export function isDesktopApp(): boolean {
  return Boolean(desktopApi()?.isDesktop);
}
