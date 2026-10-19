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

export type DesktopLibraryFolders = {
  bible: string;
  hymn: string;
  praise: string;
};

export type DesktopFolderView = {
  state: "idle" | "unsupported" | "reconnect" | "connected";
  folderName: string;
  txtCount: number;
  names: string[];
  path?: string;
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
  getLibraryFolders?: () => Promise<DesktopLibraryFolders>;
  setLibraryFolder?: (slot: string, folderPath: string) => Promise<DesktopLibraryFolders>;
  setLibraryFolders?: (next: Partial<DesktopLibraryFolders>) => Promise<DesktopLibraryFolders>;
  libraryFolderView?: (slot: string) => Promise<DesktopFolderView>;
  listLibraryTxt?: (slot: string) => Promise<string[]>;
  readLibraryTxt?: (slot: string, fileName: string) => Promise<Uint8Array | null>;
  writeLibraryTxt?: (slot: string, fileName: string, text: string) => Promise<boolean>;
  pickLibraryFolder?: (slot: string) => Promise<DesktopFolderView>;
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
