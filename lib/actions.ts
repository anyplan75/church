import { serviceSaveBlock } from "./access";
import { publishLinesNow, kickOperatorLink } from "./output-link";
import { hostEntry, saveOutputHost } from "./output-host";
import { clearBackgroundFile, currentUser, flushChurchWrite, mutationUser, notifyChurch, requireMutation, saveBackgroundFile, updateDb } from "./app-db";
import { applyBulletin } from "./bulletin-apply";
import { cleanRosterName, findRosterPerson } from "./person-name";
import { START_BLOCKED, captionFont, categoryMembership, fullscreenStep, settingsReady, setupComplete } from "./simple";
import { BULLETIN_UPLOAD_BYTES, extractUploadedText } from "./extract-text";
import { go, stay } from "./page-path";
import { syncReminders } from "./reminders";
import { isOverlayPosition } from "./db-shape";
import type { Db, Office, PersonCategory, Service, ServiceStatus, SongLicense } from "./types";
import { OFFICES, PERSON_CATEGORIES } from "./types";
import { isItemPhoto } from "./supplies";
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

function liveBlock(db: Db, _service: Service): string | null {
  return settingsReady(db.settings) ? null : START_BLOCKED;
}

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function photoOf(value: FormDataEntryValue | null): string {
  const photo = String(value ?? "");
  return isItemPhoto(photo) ? photo : "";
}

function categoryOf(value: string): PersonCategory {
  if (PERSON_CATEGORIES.some((item) => item.id === value)) return value as PersonCategory;
  return "registered";
}

function officeOf(value: string): Office | "" {
  return OFFICES.includes(value as Office) ? (value as Office) : "";
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

export async function saveLiveCue(
  id: string,
  liveIndex: number,
  liveSlide: number,
  lines: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  publishLinesNow(id, lines);
  try {
    const auth = await mutationUser("mutate.run");
    if (!auth.ok) return auth;
    updateDb((db) => {
      const service = db.services.find((item) => item.id === id);
      if (!service) throw new Error("예배를 찾을 수 없습니다.");
      service.liveIndex = clampLiveIndex(liveIndex, service.items.length);
      service.liveSlide = clampLiveIndex(liveSlide, 40);
      service.outputLines = [];
    });
    refreshService(id);
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
  const category = categoryOf(cleanText(formData.get("category"), 20));
  const office = officeOf(cleanText(formData.get("office"), 20));
  const membership = categoryMembership(category);
  updateDb((db) => {
    db.people.push({
      id: crypto.randomUUID(),
      name,
      roles: office ? [office] : [],
      phone: cleanText(formData.get("phone"), 30),
      active: true,
      membership,
      attendanceConsent: false,
      category,
      office,
      address: cleanText(formData.get("address"), 120),
      email: cleanText(formData.get("email"), 120),
      memo: cleanText(formData.get("memo"), 400),
      photo: photoOf(formData.get("photo")),
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
  const category = categoryOf(cleanText(formData.get("category"), 20));
  const office = officeOf(cleanText(formData.get("office"), 20));
  const membership = categoryMembership(category);
  updateDb((db) => {
    const person = db.people.find((item) => item.id === id);
    if (!person) return;
    person.name = name;
    person.roles = office ? [office] : [];
    person.phone = cleanText(formData.get("phone"), 30);
    person.active = true;
    person.membership = membership;
    person.category = category;
    person.office = office;
    person.address = cleanText(formData.get("address"), 120);
    person.email = cleanText(formData.get("email"), 120);
    person.memo = cleanText(formData.get("memo"), 400);
    const photo = photoOf(formData.get("photo"));
    if (photo) person.photo = photo;
    if (membership !== "member") {
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
  if (!churchName) {
    stay("/settings?error=empty");
    return;
  }
  const overlayValue = cleanText(formData.get("overlay"), 12);
  const color = cleanText(formData.get("backgroundColor"), 7);
  const rawHost = cleanText(formData.get("outputHost"), 200);
  const entry = hostEntry(rawHost);
  if (entry.problem === "url") {
    stay("/settings?error=url");
    return;
  }
  if (entry.problem === "invalid") {
    stay("/settings?error=host");
    return;
  }
  const outputHost = entry.host;
  let savedName: string | null = null;
  try {
    savedName = await storeBackground(formData.get("background"));
  } catch {
    stay("/settings?error=image");
    return;
  }
  saveOutputHost(outputHost);
  updateDb((db) => {
    db.settings.churchName = churchName;
    if (isOverlayPosition(overlayValue)) db.settings.overlay = overlayValue;
    if (/^#[0-9a-fA-F]{6}$/.test(color)) db.settings.backgroundColor = color;
    if (formData.get("clearBackground") === "on") {
      clearBackgroundFile(db.settings.backgroundFile);
      db.settings.backgroundFile = null;
    }
    if (savedName) db.settings.backgroundFile = savedName;
    db.settings.defaultPlace = cleanText(formData.get("defaultPlace"), 40) || "본당";
    db.settings.outputHost = outputHost || undefined;
    syncReminders(db);
  });
  kickOperatorLink();
  await flushChurchWrite();
  refreshService();
  stay("/settings?saved=1");
}

export async function saveLibrary(formData: FormData) {
  await requireMutation("mutate.admin");
  updateDb((db) => {
    db.settings.folders = {
      bible: cleanText(formData.get("bible"), 80),
      hymn: cleanText(formData.get("hymn"), 80),
      praise: cleanText(formData.get("praise"), 80),
    };
    db.settings.overlayFont = captionFont(cleanText(formData.get("overlayFont"), 40)).id;
    db.settings.fullscreenFont = captionFont(cleanText(formData.get("fullscreenFont"), 40)).id;
    db.settings.fullscreenStep = fullscreenStep(Number(cleanText(formData.get("fullscreenStep"), 2)));
    const overlayValue = cleanText(formData.get("overlay"), 12);
    if (isOverlayPosition(overlayValue)) db.settings.overlay = overlayValue;
    db.settings.backgrounds = [1, 2, 3, 4, 5].map((index) => cleanText(formData.get(`background${index}`), 40) || `배경 ${index}`);
    db.settings.mainReady = db.settings.mainReady === true && setupComplete(db.settings);
  });
  go("/library?saved=1");
}

export async function saveGroup(formData: FormData) {
  await requireMutation("mutate.admin");
  const name = cleanText(formData.get("name"), 40);
  if (!name) go("/settings?error=group");
  const personIds = formData.getAll("personId").map(String).filter(Boolean).slice(0, 80);
  if (personIds.length === 0) go("/settings?error=group");
  updateDb((db) => {
    const id = cleanText(formData.get("id"), 80) || crypto.randomUUID();
    const next = { id, name, personIds };
    const groups = db.settings.groups ?? [];
    const index = groups.findIndex((group) => group.id === id);
    db.settings.groups = index >= 0 ? groups.map((group, item) => (item === index ? next : group)) : [...groups, next];
    db.settings.mainReady = db.settings.mainReady === true && setupComplete(db.settings);
  });
  go("/settings?saved=1");
}

export async function deleteGroup(formData: FormData) {
  await requireMutation("mutate.admin");
  const id = cleanText(formData.get("id"), 80);
  updateDb((db) => {
    db.settings.groups = (db.settings.groups ?? []).filter((group) => group.id !== id);
    for (const service of db.services) {
      if (service.groupId === id) service.groupId = null;
    }
    db.settings.mainReady = false;
  });
  go("/settings?saved=1");
}

export async function finishSetup(formData: FormData) {
  await requireMutation("mutate.admin");
  const markReady = formData.get("mainReady") === "on";
  let ready = false;
  updateDb((db) => {
    ready = setupComplete(db.settings);
    db.settings.mainReady = markReady && ready;
  });
  if (markReady && !ready) go("/settings?error=setup");
  go("/settings?saved=1");
}

export async function importBulletin(formData: FormData) {
  await requireMutation("mutate.prepare");
  const pasted = String(formData.get("text") ?? "");
  const file = formData.get("file");
  let text = pasted;
  if (file instanceof File && file.size > 0) {
    if (file.size > BULLETIN_UPLOAD_BYTES) go("/?error=size");
    try {
      const extracted = await extractUploadedText(file.name, Buffer.from(await file.arrayBuffer()));
      text = [pasted.trim(), extracted].filter(Boolean).join("\n");
    } catch (error) {
      const message = error instanceof Error ? error.message : "파일을 읽지 못했습니다.";
      go(`/?error=file&detail=${encodeURIComponent(message)}`);
    }
  }
  if (!text.trim()) go("/?error=empty");
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
  if (imported === 0 && skipped === 0) go("/?error=none");
  go(`/?imported=${imported}&skipped=${skipped}&lyrics=${lyrics}`);
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
