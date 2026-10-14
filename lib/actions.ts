import { serviceSaveBlock } from "./access";
import { clearBackgroundFile, currentUser, flushChurchWrite, mutationUser, notifyChurch, requireMutation, saveBackgroundFile, updateDb } from "./app-db";
import { applyBulletin } from "./bulletin-apply";
import { cleanRosterName, findRosterPerson } from "./person-name";
import { missingRequired } from "./checklist";
import { extractUploadedText } from "./extract-text";
import { go } from "./page-path";
import { syncReminders } from "./reminders";
import { isOverlayPosition } from "./db-shape";
import type { Db, Membership, Service, ServiceStatus, SongLicense } from "./types";
import {
  addDays,
  clampLiveIndex,
  isISODate,
  isServiceStatus,
  isServiceType,
  isTime,
  normalizeService,
  templateItems,
  todayISO,
} from "./worship";

function refreshService(_id?: string) {
  notifyChurch();
}

function readyContext(db: Db, service: Service) {
  return { people: db.people, songs: db.songs, settings: db.settings, reminders: db.reminders };
}

function liveBlock(db: Db, service: Service): string | null {
  const missing = missingRequired(service, readyContext(db, service));
  return missing.length > 0 ? `점검을 마쳐 주세요: ${missing.join(", ")}` : null;
}

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function membershipOf(value: string): Membership {
  if (value === "visitor" || value === "newcomer") return value;
  return "member";
}

export async function saveService(input: Service): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const user = currentUser();
    if (!user) return { ok: false, message: "로그인이 필요합니다." };
    const service = normalizeService(input);
    let found = false;
    updateDb((db) => {
      const people = new Set(db.people.map((person) => person.id));
      const songs = new Set(db.songs.map((song) => song.id));
      service.preacherId = service.preacherId && people.has(service.preacherId) ? service.preacherId : null;
      service.items = service.items.map((item) => ({
        ...item,
        personId: item.personId && people.has(item.personId) ? item.personId : null,
        songId: item.songId && songs.has(item.songId) ? item.songId : null,
      }));
      const index = db.services.findIndex((item) => item.id === service.id);
      if (index < 0) return;
      const previous = db.services[index];
      const blockedRole = serviceSaveBlock(user.roles, previous, service);
      if (blockedRole) throw new Error(blockedRole);
      const goingLive = service.status === "live" && previous.status !== "live";
      db.services[index] = service;
      syncReminders(db);
      if (goingLive) {
        const blocked = liveBlock(db, service);
        if (blocked) throw new Error(blocked);
      }
      found = true;
    });
    if (!found) return { ok: false, message: "예배를 찾을 수 없습니다." };
    refreshService(service.id);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "저장하지 못했습니다." };
  }
}

export async function saveLiveProgress(
  id: string,
  liveIndex: number,
  status?: ServiceStatus,
  liveSlide?: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const auth = await mutationUser("mutate.run");
    if (!auth.ok) return auth;
    updateDb((db) => {
      const service = db.services.find((item) => item.id === id);
      if (!service) throw new Error("예배를 찾을 수 없습니다.");
      const goingLive = status === "live" && service.status !== "live";
      service.liveIndex = clampLiveIndex(liveIndex, service.items.length);
      if (liveSlide !== undefined) service.liveSlide = clampLiveIndex(liveSlide, 40);
      if (status && isServiceStatus(status)) {
        service.status = status;
        if (status === "live" && !service.startedAt) service.startedAt = new Date().toISOString();
        if (status === "planning" || status === "ready") service.startedAt = null;
      }
      syncReminders(db);
      if (goingLive) {
        const blocked = liveBlock(db, service);
        if (blocked) throw new Error(blocked);
      }
    });
    refreshService(id);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "저장하지 못했습니다." };
  }
}

export async function createService(formData: FormData) {
  await requireMutation("mutate.prepare");
  const typeValue = cleanText(formData.get("type"), 20);
  const type = isServiceType(typeValue) ? typeValue : "sunday-2";
  const title = cleanText(formData.get("title"), 80) || "예배";
  const date = cleanText(formData.get("date"), 10);
  const timeValue = cleanText(formData.get("time"), 5);
  const time = isTime(timeValue) ? timeValue : "11:00";
  const place = cleanText(formData.get("place"), 40) || "본당";
  const preacherId = cleanText(formData.get("preacherId"), 80);
  const orderSource = cleanText(formData.get("orderSource"), 80);
  let created = "";

  updateDb((db) => {
    const people = new Set(db.people.map((person) => person.id));
    let items = templateItems(type).map((item) => ({ ...item, id: crypto.randomUUID() }));
    let announcements: Service["announcements"] = [];
    let notes = "";
    let preacher = preacherId && people.has(preacherId) ? preacherId : null;

    if (orderSource === "empty") items = [];
    if (orderSource.startsWith("copy:")) {
      const source = db.services.find((service) => service.id === orderSource.slice(5));
      if (source) {
        items = source.items.map((item) => ({ ...item, id: crypto.randomUUID() }));
        announcements = source.announcements.map((announcement) => ({
          ...announcement,
          id: crypto.randomUUID(),
        }));
        notes = source.notes;
        if (!preacher) preacher = source.preacherId;
      }
    }

    if (preacher) {
      const sermon = items.find((item) => item.kind === "sermon");
      if (sermon && !sermon.personId) sermon.personId = preacher;
    }

    const service: Service = {
      id: crypto.randomUUID(),
      title,
      date: isISODate(date) ? date : todayISO(),
      time,
      type,
      place,
      preacherId: preacher,
      status: "planning",
      items,
      announcements,
      liveIndex: 0,
      startedAt: null,
      notes,
      checks: {},
      source: "manual",
    };
    db.services.push(service);
    syncReminders(db);
    created = service.id;
  });

  refreshService(created);
  go(`/services/${created}`);
}

export async function copyServiceNextWeek(id: string) {
  await requireMutation("mutate.prepare");
  let created = "";
  updateDb((db) => {
    const source = db.services.find((service) => service.id === id);
    if (!source) throw new Error("예배를 찾을 수 없습니다.");
    const copy: Service = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      date: addDays(source.date, 7),
      status: "planning",
      liveIndex: 0,
      startedAt: null,
      checks: {},
      items: source.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
      announcements: source.announcements.map((announcement) => ({ ...announcement, id: crypto.randomUUID() })),
    };
    db.services.push(copy);
    syncReminders(db);
    created = copy.id;
  });
  refreshService(created);
  go(`/services/${created}`);
}

export async function deleteService(id: string) {
  await requireMutation("mutate.prepare");
  updateDb((db) => {
    const service = db.services.find((item) => item.id === id);
    if (service?.status === "live") throw new Error("진행 중인 예배는 삭제할 수 없습니다.");
    db.services = db.services.filter((item) => item.id !== id);
    syncReminders(db);
  });
  refreshService(id);
  go("/services");
}

export async function addRosterPerson(name: string): Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }> {
  const clean = cleanRosterName(name);
  if (!clean) return { ok: false, message: "이름을 입력해 주세요." };
  let id = "";
  let storedName = clean;
  updateDb((db) => {
    const existing = findRosterPerson(clean, db.people);
    if (existing) {
      id = existing.id;
      storedName = existing.name.trim();
      return;
    }
    id = crypto.randomUUID();
    storedName = clean;
    db.people.push({ id, name: clean, roles: [], phone: "", active: true, membership: "member", attendanceConsent: false });
  });
  refreshService();
  return { ok: true, id, name: storedName };
}

export async function createPerson(formData: FormData) {
  await requireMutation("mutate.directory");
  const name = cleanText(formData.get("name"), 40);
  if (!name) go("/people?error=name");
  const roles = cleanText(formData.get("roles"), 80)
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
    .slice(0, 8);
  const membership = membershipOf(cleanText(formData.get("membership"), 20));
  updateDb((db) => {
    db.people.push({
      id: crypto.randomUUID(),
      name,
      roles,
      phone: cleanText(formData.get("phone"), 30),
      active: true,
      membership,
      attendanceConsent: false,
    });
  });
  refreshService();
  go("/people");
}

export async function updatePerson(formData: FormData) {
  await requireMutation("mutate.directory");
  const id = cleanText(formData.get("id"), 80);
  const name = cleanText(formData.get("name"), 40);
  if (!name) go("/people?error=name");
  const roles = cleanText(formData.get("roles"), 80)
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
    .slice(0, 8);
  const membership = membershipOf(cleanText(formData.get("membership"), 20));
  updateDb((db) => {
    const person = db.people.find((item) => item.id === id);
    if (!person) return;
    person.name = name;
    person.roles = roles;
    person.phone = cleanText(formData.get("phone"), 30);
    person.active = formData.get("active") === "on";
    person.membership = membership;
    if (membership !== "member" || !person.active) {
      person.attendanceConsent = false;
      db.attendance = db.attendance.filter((mark) => mark.personId !== id);
    }
  });
  refreshService();
  go("/people");
}

export async function deletePerson(formData: FormData) {
  await requireMutation("mutate.directory");
  const id = cleanText(formData.get("id"), 80);
  updateDb((db) => {
    db.people = db.people.filter((person) => person.id !== id);
    db.attendance = db.attendance.filter((mark) => mark.personId !== id);
    for (const service of db.services) {
      if (service.preacherId === id) service.preacherId = null;
      for (const item of service.items) {
        if (item.personId === id) item.personId = null;
      }
    }
    syncReminders(db);
  });
  refreshService();
  go("/people");
}

export async function createSong(formData: FormData) {
  await requireMutation("mutate.directory");
  const title = cleanText(formData.get("title"), 80);
  if (!title) go("/songs?error=title");
  updateDb((db) => {
    const license = songLicense(formData);
    db.songs.push({
      id: crypto.randomUUID(),
      title,
      hymnNumber: cleanText(formData.get("hymnNumber"), 10),
      key: cleanText(formData.get("key"), 8),
      license,
      permittedLine: license === "permitted" ? cleanText(formData.get("permittedLine"), 80) : "",
    });
  });
  refreshService();
  go("/songs");
}

export async function updateSong(formData: FormData) {
  await requireMutation("mutate.directory");
  const id = cleanText(formData.get("id"), 80);
  const title = cleanText(formData.get("title"), 80);
  if (!title) go("/songs?error=title");
  updateDb((db) => {
    const song = db.songs.find((item) => item.id === id);
    if (!song) return;
    const license = songLicense(formData);
    song.title = title;
    song.hymnNumber = cleanText(formData.get("hymnNumber"), 10);
    song.key = cleanText(formData.get("key"), 8);
    song.license = license;
    song.permittedLine = license === "permitted" ? cleanText(formData.get("permittedLine"), 80) : "";
  });
  refreshService();
  go("/songs");
}

export async function deleteSong(formData: FormData) {
  await requireMutation("mutate.directory");
  const id = cleanText(formData.get("id"), 80);
  updateDb((db) => {
    db.songs = db.songs.filter((song) => song.id !== id);
    for (const service of db.services) {
      for (const item of service.items) {
        if (item.songId === id) item.songId = null;
      }
    }
  });
  refreshService();
  go("/songs");
}

export async function updateSettings(formData: FormData) {
  await requireMutation("mutate.admin");
  const churchName = cleanText(formData.get("churchName"), 40);
  if (!churchName) go("/settings?error=empty");
  const overlayValue = cleanText(formData.get("overlay"), 12);
  const color = cleanText(formData.get("backgroundColor"), 7);
  let savedName: string | null = null;
  try {
    savedName = await storeBackground(formData.get("background"));
  } catch {
    go("/settings?error=image");
  }
  updateDb((db) => {
    db.settings.churchName = churchName;
    if (isOverlayPosition(overlayValue)) db.settings.overlay = overlayValue;
    if (/^#[0-9a-fA-F]{6}$/.test(color)) db.settings.backgroundColor = color;
    if (formData.get("clearBackground") === "on") {
      clearBackgroundFile(db.settings.backgroundFile);
      db.settings.backgroundFile = null;
    }
    if (savedName) db.settings.backgroundFile = savedName;
    syncReminders(db);
  });
  refreshService();
  go("/settings?saved=1");
}

export async function importBulletin(formData: FormData) {
  await requireMutation("mutate.prepare");
  const pasted = String(formData.get("text") ?? "");
  const file = formData.get("file");
  let text = pasted;
  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) go("/prepare?error=size");
    try {
      const extracted = await extractUploadedText(file.name, Buffer.from(await file.arrayBuffer()));
      text = [pasted.trim(), extracted].filter(Boolean).join("\n");
    } catch (error) {
      const message = error instanceof Error ? error.message : "파일을 읽지 못했습니다.";
      go(`/prepare?error=file&detail=${encodeURIComponent(message)}`);
    }
  }
  if (!text.trim()) go("/prepare?error=empty");
  let imported = 0;
  let skipped = 0;
  let lyrics = 0;
  updateDb((db) => {
    const result = applyBulletin(db, text);
    syncReminders(db);
    imported = result.imported;
    skipped = result.skipped;
    lyrics = result.skippedLyrics;
  });
  await flushChurchWrite();
  refreshService();
  if (imported === 0 && skipped === 0) go("/prepare?error=none");
  go(`/prepare?imported=${imported}&skipped=${skipped}&lyrics=${lyrics}`);
}

export async function updateSlideFields(formData: FormData) {
  await requireMutation("mutate.output");
  const serviceId = cleanText(formData.get("serviceId"), 80);
  const itemId = cleanText(formData.get("itemId"), 80);
  updateDb((db) => {
    const service = db.services.find((item) => item.id === serviceId);
    const item = service?.items.find((entry) => entry.id === itemId);
    if (!item) return;
    item.screenCue = cleanText(formData.get("screenCue"), 80);
    const licensed = formData.get("scriptureLicensed") === "on";
    item.scriptureLicensed = licensed && (item.kind === "scripture" || item.kind === "sermon");
    item.scriptureText = item.scriptureLicensed ? cleanText(formData.get("scriptureText"), 400) : "";
  });
  refreshService(serviceId);
  go(`/services/${serviceId}/slides`);
}

function songLicense(formData: FormData): SongLicense {
  return formData.get("license") === "permitted" ? "permitted" : "title-only";
}

async function storeBackground(value: FormDataEntryValue | null): Promise<string | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > 5 * 1024 * 1024) throw new Error("배경 그림은 5MB 이하로 올려 주세요.");
  const ext = backgroundExt(value.name);
  if (!ext) throw new Error("배경 그림은 JPG, PNG, WEBP만 올릴 수 있습니다.");
  const filename = `background${ext}`;
  const bytes = new Uint8Array(await value.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  await saveBackgroundFile(filename, `data:${type};base64,${btoa(binary)}`);
  return filename;
}

function backgroundExt(name: string): string | null {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
  if (ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".webp") return ext === ".jpeg" ? ".jpg" : ext;
  return null;
}
