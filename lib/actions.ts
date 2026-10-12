"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Service, ServiceStatus } from "./types";
import { updateDb } from "./store";
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

function refreshService(id?: string) {
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/people");
  revalidatePath("/songs");
  revalidatePath("/settings");
  if (id) {
    revalidatePath(`/services/${id}`);
    revalidatePath(`/services/${id}/live`);
    revalidatePath(`/services/${id}/bulletin`);
  }
}

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export async function saveService(input: Service): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
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
      db.services[index] = service;
      found = true;
    });
    if (!found) return { ok: false, message: "예배를 찾을 수 없습니다." };
    refreshService(service.id);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "저장하지 못했습니다." };
  }
}

export async function saveLiveProgress(id: string, liveIndex: number, status?: ServiceStatus) {
  updateDb((db) => {
    const service = db.services.find((item) => item.id === id);
    if (!service) throw new Error("예배를 찾을 수 없습니다.");
    service.liveIndex = clampLiveIndex(liveIndex, service.items.length);
    if (status && isServiceStatus(status)) {
      service.status = status;
      if (status === "live" && !service.startedAt) service.startedAt = new Date().toISOString();
      if (status === "planning" || status === "ready") service.startedAt = null;
    }
  });
  refreshService(id);
}

export async function createService(formData: FormData) {
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
    };
    db.services.push(service);
    created = service.id;
  });

  refreshService(created);
  redirect(`/services/${created}`);
}

export async function copyServiceNextWeek(id: string) {
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
      items: source.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
      announcements: source.announcements.map((announcement) => ({ ...announcement, id: crypto.randomUUID() })),
    };
    db.services.push(copy);
    created = copy.id;
  });
  refreshService(created);
  redirect(`/services/${created}`);
}

export async function deleteService(id: string) {
  updateDb((db) => {
    const service = db.services.find((item) => item.id === id);
    if (service?.status === "live") throw new Error("진행 중인 예배는 삭제할 수 없습니다.");
    db.services = db.services.filter((item) => item.id !== id);
  });
  refreshService(id);
  redirect("/services");
}

export async function createPerson(formData: FormData) {
  const name = cleanText(formData.get("name"), 40);
  if (!name) redirect("/people?error=name");
  const roles = cleanText(formData.get("roles"), 80)
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
    .slice(0, 8);
  updateDb((db) => {
    db.people.push({
      id: crypto.randomUUID(),
      name,
      roles,
      phone: cleanText(formData.get("phone"), 30),
      active: true,
    });
  });
  refreshService();
  redirect("/people");
}

export async function updatePerson(formData: FormData) {
  const id = cleanText(formData.get("id"), 80);
  const name = cleanText(formData.get("name"), 40);
  if (!name) redirect("/people?error=name");
  const roles = cleanText(formData.get("roles"), 80)
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
    .slice(0, 8);
  updateDb((db) => {
    const person = db.people.find((item) => item.id === id);
    if (!person) return;
    person.name = name;
    person.roles = roles;
    person.phone = cleanText(formData.get("phone"), 30);
    person.active = formData.get("active") === "on";
  });
  refreshService();
  redirect("/people");
}

export async function deletePerson(formData: FormData) {
  const id = cleanText(formData.get("id"), 80);
  updateDb((db) => {
    db.people = db.people.filter((person) => person.id !== id);
    for (const service of db.services) {
      if (service.preacherId === id) service.preacherId = null;
      for (const item of service.items) {
        if (item.personId === id) item.personId = null;
      }
    }
  });
  refreshService();
  redirect("/people");
}

export async function createSong(formData: FormData) {
  const title = cleanText(formData.get("title"), 80);
  if (!title) redirect("/songs?error=title");
  updateDb((db) => {
    db.songs.push({
      id: crypto.randomUUID(),
      title,
      hymnNumber: cleanText(formData.get("hymnNumber"), 10),
      key: cleanText(formData.get("key"), 8),
    });
  });
  refreshService();
  redirect("/songs");
}

export async function updateSong(formData: FormData) {
  const id = cleanText(formData.get("id"), 80);
  const title = cleanText(formData.get("title"), 80);
  if (!title) redirect("/songs?error=title");
  updateDb((db) => {
    const song = db.songs.find((item) => item.id === id);
    if (!song) return;
    song.title = title;
    song.hymnNumber = cleanText(formData.get("hymnNumber"), 10);
    song.key = cleanText(formData.get("key"), 8);
  });
  refreshService();
  redirect("/songs");
}

export async function deleteSong(formData: FormData) {
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
  redirect("/songs");
}

export async function updateSettings(formData: FormData) {
  const churchName = cleanText(formData.get("churchName"), 40);
  if (!churchName) redirect("/settings?error=empty");
  updateDb((db) => {
    db.settings.churchName = churchName;
  });
  refreshService();
  redirect("/settings?saved=1");
}
