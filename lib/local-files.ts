import { fileMatchesQuery, splitSlides, type LibraryQuery } from "./local-library";

const DB_NAME = "church-local-texts";
const HANDLE = "directory";

type Confirmed = { text: string };

type DirectoryHandle = {
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

export async function linkLocalFolder(slot = ""): Promise<boolean> {
  const open = picker();
  if (!open) return false;
  const handle = await open({ mode: "readwrite" });
  await idbSet(slot ? `directory:${slot}` : HANDLE, handle);
  return true;
}

export async function localFolderLinked(): Promise<boolean> {
  const handle = await directory();
  return Boolean(handle);
}

export async function findNamedFile(slot: string, label: string): Promise<string | null> {
  const handle = await directory(slot);
  if (!handle) return null;
  const wanted = label.normalize("NFKC").replace(/\s+/g, "").replace(/\.txt$/i, "").toLowerCase();
  if (!wanted) return null;
  for await (const entry of handle.values()) {
    if (entry.kind !== "file") continue;
    const stem = entry.name.replace(/\.[^.]+$/, "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
    if (stem === wanted) return entry.name;
  }
  return null;
}

export async function findLocalText(query: LibraryQuery): Promise<{ fileName: string; text: string } | null> {
  const handle = await directory();
  if (!handle) return null;
  for await (const entry of handle.values()) {
    if (entry.kind !== "file" || !fileMatchesQuery(entry.name, query) || !entry.getFile) continue;
    const file = await entry.getFile();
    const text = await file.text();
    return { fileName: entry.name, text };
  }
  return null;
}

export async function saveLocalText(fileName: string, body: string): Promise<string | null> {
  const handle = await directory();
  if (!handle) return null;
  const file = await handle.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  await writable.write(body);
  await writable.close();
  return fileName;
}

export async function confirmLocalText(query: LibraryQuery, text: string) {
  await idbSet(confirmKey(query), { text } satisfies Confirmed);
}

export async function confirmedSlides(query: LibraryQuery): Promise<string[]> {
  const saved = await idbGet<Confirmed>(confirmKey(query));
  if (!saved?.text) return [];
  return splitSlides(saved.text);
}

function confirmKey(query: LibraryQuery): string {
  return `text:${query.kind}:${query.hymnNumber}:${query.scripture}:${query.title}`;
}

async function directory(slot = ""): Promise<DirectoryHandle | null> {
  const handle = await idbGet<DirectoryHandle>(slot ? `directory:${slot}` : HANDLE);
  if (!handle) return null;
  const mode = { mode: "readwrite" as const };
  const state = handle.queryPermission ? await handle.queryPermission(mode) : "granted";
  if (state === "granted") return handle;
  const next = handle.requestPermission ? await handle.requestPermission(mode) : "denied";
  return next === "granted" ? handle : null;
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
