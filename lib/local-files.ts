import { desktopApi } from "./desktop-api";
import { fileMatchesQuery, fileSlides, nameContains, preferredFileName, previewLine, savedFileText, type FolderView, type LibraryQuery } from "./local-library";
import { decodeLocalText } from "./text-encoding";

const DB_NAME = "church-local-texts";
const HANDLE = "directory";
const LIBRARY_SLOTS = ["bible", "hymn", "praise"] as const;

type DirectoryHandle = {
  name?: string;
  queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileHandle>;
  values: () => AsyncIterable<FileHandleEntry>;
};

type FileHandle = {
  kind?: string;
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
};

type FileHandleEntry = { kind: string; name: string; getFile?: () => Promise<File> };

type PathFile = File & { path?: string };

let idbPathMigrateStarted = false;

function picker(): ((options?: { mode?: "readwrite" }) => Promise<DirectoryHandle>) | null {
  const candidate = (window as Window & { showDirectoryPicker?: (options?: { mode?: "readwrite" }) => Promise<DirectoryHandle> }).showDirectoryPicker;
  return candidate ? candidate.bind(window) : null;
}

const IDLE_FOLDER: FolderView = { state: "idle", folderName: "", txtCount: 0, names: [] };

function desktopLibraryReady(): boolean {
  const api = desktopApi();
  return Boolean(api?.isDesktop && api.pickLibraryFolder && api.libraryFolderView && api.listLibraryTxt && api.readLibraryTxt);
}

export async function linkLocalFolder(slot = ""): Promise<boolean> {
  const view = await connectFolder(slot);
  return view.state === "connected";
}

export async function connectFolder(slot = ""): Promise<FolderView> {
  if (desktopLibraryReady()) {
    await migrateIndexedDbPathsToDesktop();
    const api = desktopApi()!;
    return asFolderView(await api.pickLibraryFolder!(slot));
  }
  const open = picker();
  if (!open) return { ...IDLE_FOLDER, state: "unsupported" };
  try {
    const handle = await open({ mode: "readwrite" });
    await idbSet(handleKey(slot), handle);
    return await summarize(handle);
  } catch {
    return readFolderView(slot);
  }
}

export async function readFolderView(slot = ""): Promise<FolderView> {
  if (desktopLibraryReady()) {
    await migrateIndexedDbPathsToDesktop();
    return asFolderView(await desktopApi()!.libraryFolderView!(slot));
  }
  try {
    const handle = await idbGet<DirectoryHandle>(handleKey(slot));
    if (!handle) return IDLE_FOLDER;
    const folderName = handle.name ?? "";
    const state = await permission(handle, false);
    if (state !== "granted") return { state: "reconnect", folderName, txtCount: 0, names: [] };
    return await summarize(handle);
  } catch {
    return { state: "reconnect", folderName: "", txtCount: 0, names: [] };
  }
}

export async function localFolderLinked(): Promise<boolean> {
  if (desktopLibraryReady()) {
    await migrateIndexedDbPathsToDesktop();
    const folders = await desktopApi()!.getLibraryFolders!();
    return Boolean(folders.bible || folders.hymn || folders.praise);
  }
  const handle = await directory();
  return Boolean(handle);
}

export async function findNamedFile(slot: string, label: string): Promise<string | null> {
  if (desktopLibraryReady()) {
    await migrateIndexedDbPathsToDesktop();
    const wanted = label.normalize("NFKC").replace(/\s+/g, "").replace(/\.txt$/i, "");
    if (!wanted) return null;
    const names = await desktopApi()!.listLibraryTxt!(slot);
    for (const name of names) {
      if (nameContains(name, wanted)) return name;
    }
    return null;
  }
  const handle = await directory(slot);
  if (!handle) return null;
  const wanted = label.normalize("NFKC").replace(/\s+/g, "").replace(/\.txt$/i, "");
  if (!wanted) return null;
  for await (const entry of handle.values()) {
    if (entry.kind !== "file" || !entry.name.toLowerCase().endsWith(".txt")) continue;
    if (nameContains(entry.name, wanted)) return entry.name;
  }
  return null;
}

export async function findLocalText(query: LibraryQuery): Promise<{ fileName: string; text: string } | null> {
  if (desktopLibraryReady()) {
    await migrateIndexedDbPathsToDesktop();
    const hit = await findDesktopMatch(query);
    return hit;
  }
  const handle = await resolveHandle(query.kind, true);
  if (!handle) return null;
  for await (const entry of handle.values()) {
    if (entry.kind !== "file" || !fileMatchesQuery(entry.name, query) || !entry.getFile) continue;
    const file = await entry.getFile();
    const text = await textOf(file);
    return { fileName: entry.name, text };
  }
  return null;
}

export async function readFolderFill(query: LibraryQuery): Promise<{ fileName: string | null; slides: string[] }> {
  if (desktopLibraryReady()) {
    await migrateIndexedDbPathsToDesktop();
    const hit = await findDesktopMatch(query);
    if (!hit) return { fileName: null, slides: [] };
    return { fileName: hit.fileName, slides: fileSlides(query, hit.text) };
  }
  const handle = await resolveHandle(query.kind, false);
  if (!handle) return { fileName: null, slides: [] };
  for await (const entry of handle.values()) {
    if (entry.kind !== "file" || !fileMatchesQuery(entry.name, query) || !entry.getFile) continue;
    const file = await entry.getFile();
    const text = await textOf(file);
    return { fileName: entry.name, slides: fileSlides(query, text) };
  }
  return { fileName: null, slides: [] };
}

export async function peekLocalMatch(query: LibraryQuery): Promise<{ fileName: string; preview: string } | null> {
  if (desktopLibraryReady()) {
    await migrateIndexedDbPathsToDesktop();
    const hit = await findDesktopMatch(query, 65536);
    if (!hit) return null;
    return { fileName: hit.fileName, preview: previewLine(hit.text) };
  }
  const handle = await resolveHandle(query.kind, false);
  if (!handle) return null;
  for await (const entry of handle.values()) {
    if (entry.kind !== "file" || !fileMatchesQuery(entry.name, query) || !entry.getFile) continue;
    const file = await entry.getFile();
    const preview = previewLine(await textOf(file, 65536));
    return { fileName: entry.name, preview };
  }
  return null;
}

export async function saveLocalText(fileName: string, body: string, slot = ""): Promise<string | null> {
  const saved = await writePassageFile({ kind: slot === "bible" || slot === "hymn" || slot === "praise" ? slot : "praise", title: "", hymnNumber: "", scripture: "" }, body, fileName);
  return saved.ok ? saved.fileName : null;
}

export async function readPassage(query: LibraryQuery): Promise<{ state: "connected"; fileName: string | null; text: string } | { state: Exclude<FolderView["state"], "connected"> }> {
  if (desktopLibraryReady()) {
    await migrateIndexedDbPathsToDesktop();
    const view = asFolderView(await desktopApi()!.libraryFolderView!(query.kind));
    if (view.state !== "connected") return { state: view.state };
    const hit = await findDesktopMatch(query);
    return { state: "connected", fileName: hit?.fileName ?? null, text: hit?.text ?? "" };
  }
  const state = await folderState(query.kind);
  if (state !== "connected") return { state };
  const handle = await resolveHandle(query.kind, false);
  if (!handle) return { state: "reconnect" };
  for await (const entry of handle.values()) {
    if (entry.kind !== "file" || !fileMatchesQuery(entry.name, query) || !entry.getFile) continue;
    const file = await entry.getFile();
    return { state: "connected", fileName: entry.name, text: await textOf(file) };
  }
  return { state: "connected", fileName: null, text: "" };
}

export async function writePassageFile(
  query: LibraryQuery,
  text: string,
  fileName?: string | null,
): Promise<{ ok: true; fileName: string } | { ok: false; state: Exclude<FolderView["state"], "connected"> }> {
  if (desktopLibraryReady()) {
    await migrateIndexedDbPathsToDesktop();
    const view = asFolderView(await desktopApi()!.libraryFolderView!(query.kind));
    if (view.state !== "connected") return { ok: false, state: view.state };
    const names = await desktopApi()!.listLibraryTxt!(query.kind);
    const found = fileName || names.find((name) => fileMatchesQuery(name, query)) || null;
    const name = safeTxtName(found || preferredFileName(query));
    if (!name) return { ok: false, state: "idle" };
    const ok = await desktopApi()!.writeLibraryTxt!(query.kind, name, savedFileText(text));
    return ok ? { ok: true, fileName: name } : { ok: false, state: "reconnect" };
  }
  const state = await folderState(query.kind);
  if (state !== "connected") return { ok: false, state };
  const handle = await resolveHandle(query.kind, true);
  if (!handle) return { ok: false, state: "reconnect" };
  const found = fileName || (await findFileName(handle, query));
  const name = safeTxtName(found || preferredFileName(query));
  if (!name) return { ok: false, state: "idle" };
  try {
    const file = await handle.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(savedFileText(text));
    await writable.close();
    return { ok: true, fileName: name };
  } catch {
    return { ok: false, state: "reconnect" };
  }
}

export function notifyPassageSaved() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("church-passage-refresh");
  channel.postMessage({ saved: true });
  channel.close();
}

export function subscribePassageSaved(onSaved: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel("church-passage-refresh");
  channel.onmessage = () => onSaved();
  return () => channel.close();
}

function asFolderView(view: { state: FolderView["state"]; folderName: string; txtCount: number; names: string[] }): FolderView {
  return {
    state: view.state,
    folderName: view.folderName || "",
    txtCount: view.txtCount || 0,
    names: Array.isArray(view.names) ? view.names : [],
  };
}

async function findDesktopMatch(query: LibraryQuery, limit?: number): Promise<{ fileName: string; text: string } | null> {
  const api = desktopApi()!;
  const names = await api.listLibraryTxt!(query.kind);
  for (const name of names) {
    if (!fileMatchesQuery(name, query)) continue;
    const bytes = await api.readLibraryTxt!(query.kind, name);
    if (!bytes) continue;
    const slice = typeof limit === "number" ? bytes.subarray(0, limit) : bytes;
    return { fileName: name, text: decodeLocalText(slice) };
  }
  return null;
}

/**
 * 예전에 IndexedDB 에만 있던 폴더 연결을 Electron userData 경로로 옮긴다.
 * Electron File.path 가 있을 때만 가능하며, 한 세션에 한 번 시도한다.
 */
async function migrateIndexedDbPathsToDesktop(): Promise<void> {
  if (idbPathMigrateStarted || !desktopLibraryReady() || typeof indexedDB === "undefined") return;
  idbPathMigrateStarted = true;
  const api = desktopApi()!;
  try {
    const current = await api.getLibraryFolders!();
    const next = { ...current };
    let changed = false;
    for (const slot of LIBRARY_SLOTS) {
      if (next[slot]) continue;
      const derived = await directoryPathFromIdb(slot);
      if (!derived) continue;
      next[slot] = derived;
      changed = true;
    }
    if (changed) await api.setLibraryFolders!(next);
  } catch {
    /* 예전 저장소가 없으면 그냥 둔다 */
  }
}

async function directoryPathFromIdb(slot: string): Promise<string> {
  const handle = (await idbGet<DirectoryHandle>(handleKey(slot)).catch(() => null)) ?? (slot ? null : await idbGet<DirectoryHandle>(HANDLE).catch(() => null));
  if (!handle) return "";
  try {
    for await (const entry of handle.values()) {
      if (entry.kind !== "file" || !entry.getFile || !entry.name.toLowerCase().endsWith(".txt")) continue;
      const file = (await entry.getFile()) as PathFile;
      const filePath = typeof file.path === "string" ? file.path.trim() : "";
      if (!filePath) continue;
      const sep = filePath.includes("\\") ? "\\" : "/";
      const parts = filePath.split(/[/\\]/);
      parts.pop();
      return parts.join(sep);
    }
  } catch {
    return "";
  }
  return "";
}

async function folderState(slot: string): Promise<FolderView["state"]> {
  if (typeof indexedDB === "undefined") return "unsupported";
  const keyed = slot ? await idbGet<DirectoryHandle>(handleKey(slot)).catch(() => null) : null;
  const handle = keyed ?? (await idbGet<DirectoryHandle>(HANDLE).catch(() => null));
  if (!handle) return typeof window !== "undefined" && picker() ? "idle" : "unsupported";
  const mode = { mode: "readwrite" as const };
  const permissionState = handle.queryPermission ? await handle.queryPermission(mode) : "granted";
  return permissionState === "granted" ? "connected" : "reconnect";
}

async function findFileName(handle: DirectoryHandle, query: LibraryQuery): Promise<string | null> {
  for await (const entry of handle.values()) {
    if (entry.kind === "file" && fileMatchesQuery(entry.name, query)) return entry.name;
  }
  return null;
}

function safeTxtName(fileName: string): string {
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? "";
  if (!base || base === "." || base === ".." || !base.toLowerCase().endsWith(".txt")) return "";
  return base.slice(0, 120);
}

async function textOf(file: Blob, limit?: number): Promise<string> {
  const blob = typeof limit === "number" ? file.slice(0, limit) : file;
  return decodeLocalText(new Uint8Array(await blob.arrayBuffer()));
}

function handleKey(slot: string): string {
  return slot ? `directory:${slot}` : HANDLE;
}

async function directory(slot = ""): Promise<DirectoryHandle | null> {
  return resolveHandle(slot, true);
}

async function resolveHandle(slot: string, prompt: boolean): Promise<DirectoryHandle | null> {
  if (slot) {
    const keyed = await idbGet<DirectoryHandle>(handleKey(slot));
    if (keyed) return (await permission(keyed, prompt)) === "granted" ? keyed : null;
  }
  const fallback = await idbGet<DirectoryHandle>(HANDLE);
  if (!fallback) return null;
  return (await permission(fallback, prompt)) === "granted" ? fallback : null;
}

async function permission(handle: DirectoryHandle, prompt: boolean): Promise<PermissionState> {
  const mode = { mode: "readwrite" as const };
  const state = handle.queryPermission ? await handle.queryPermission(mode) : "granted";
  if (state === "granted" || !prompt) return state;
  return handle.requestPermission ? await handle.requestPermission(mode) : "denied";
}

async function summarize(handle: DirectoryHandle): Promise<FolderView> {
  const names: string[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind !== "file" || !entry.name.toLowerCase().endsWith(".txt")) continue;
    names.push(entry.name);
  }
  names.sort((a, b) => a.localeCompare(b, "ko"));
  return { state: "connected", folderName: handle.name ?? "", txtCount: names.length, names: names.slice(0, 5) };
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("kv")) request.result.createObjectStore("kv");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const database = await idb();
  return new Promise((resolve, reject) => {
    const request = database.transaction("kv", "readonly").objectStore("kv").get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key: string, value: unknown) {
  const database = await idb();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction("kv", "readwrite").objectStore("kv").put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
