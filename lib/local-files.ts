import { fileMatchesQuery, fileSlides, nameContains, preferredFileName, previewLine, savedFileText, type FolderView, type LibraryQuery } from "./local-library";
import { decodeLocalText } from "./text-encoding";

const DB_NAME = "church-local-texts";
const HANDLE = "directory";

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

function picker(): ((options?: { mode?: "readwrite" }) => Promise<DirectoryHandle>) | null {
  const candidate = (window as Window & { showDirectoryPicker?: (options?: { mode?: "readwrite" }) => Promise<DirectoryHandle> }).showDirectoryPicker;
  return candidate ? candidate.bind(window) : null;
}

const IDLE_FOLDER: FolderView = { state: "idle", folderName: "", txtCount: 0, names: [] };

export async function linkLocalFolder(slot = ""): Promise<boolean> {
  const view = await connectFolder(slot);
  return view.state === "connected";
}

export async function connectFolder(slot = ""): Promise<FolderView> {
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
  const handle = await directory();
  return Boolean(handle);
}

export async function findNamedFile(slot: string, label: string): Promise<string | null> {
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
