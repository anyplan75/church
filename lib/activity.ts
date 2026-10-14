import type { ActivityEntry, Db, Service } from "./types";

export function cleanActivityAction(action: string): string {
  return action.replace(/\s+/g, " ").trim().slice(0, 140);
}

export function pushActivity(db: Db, email: string, action: string, at = new Date().toISOString()): ActivityEntry | null {
  const cleanEmail = email.trim().toLowerCase().slice(0, 120);
  const cleanAction = cleanActivityAction(action);
  if (!cleanEmail || !cleanAction) return null;
  const entry: ActivityEntry = {
    id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at,
    email: cleanEmail,
    action: cleanAction,
  };
  db.activity = [entry, ...(db.activity ?? [])].slice(0, 400);
  return entry;
}

export function describeDbChange(before: Db, after: Db): string | null {
  if (before.settings.churchName !== after.settings.churchName) return "교회 이름을 바꿈";
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) return "화면 설정을 바꿈";
  if (before.people.length < after.people.length) return "사람을 추가함";
  if (before.people.length > after.people.length) return "사람을 삭제함";
  if (JSON.stringify(before.people) !== JSON.stringify(after.people)) return "사람 정보를 바꿈";
  if (before.songs.length < after.songs.length) return "찬양을 추가함";
  if (before.songs.length > after.songs.length) return "찬양을 삭제함";
  if (songMeta(before) !== songMeta(after)) return "찬양 제목이나 번호를 바꿈";
  if (before.departments.length !== after.departments.length || JSON.stringify(before.departments) !== JSON.stringify(after.departments)) {
    return "부서를 바꿈";
  }
  if (supplyMeta(before) !== supplyMeta(after)) return "물품을 바꿈";
  if (JSON.stringify(before.attendance) !== JSON.stringify(after.attendance)) return "출석을 바꿈";

  const beforeServices = new Map(before.services.map((service) => [service.id, service]));
  const afterServices = new Map(after.services.map((service) => [service.id, service]));
  for (const service of after.services) {
    if (!beforeServices.has(service.id)) return `예배를 만듦: ${label(service)}`;
  }
  for (const service of before.services) {
    if (!afterServices.has(service.id)) return `예배를 삭제함: ${label(service)}`;
  }
  for (const service of after.services) {
    const previous = beforeServices.get(service.id);
    if (!previous) continue;
    const change = describeService(previous, service);
    if (change) return change;
  }
  if (songBody(before) !== songBody(after) || serviceBody(before) !== serviceBody(after)) return "화면 문구 설정을 바꿈";
  return null;
}

function label(service: Service): string {
  return service.title.trim().slice(0, 40) || "예배";
}

function describeService(before: Service, after: Service): string | null {
  const name = label(after);
  if (before.status !== after.status) return `예배 상태를 바꿈: ${name}`;
  if (before.liveIndex !== after.liveIndex) return `그룹으로 건너뜀: ${name}`;
  if ((before.liveSlide ?? 0) !== (after.liveSlide ?? 0)) return `슬라이드를 넘김: ${name}`;
  if (before.title !== after.title || before.date !== after.date || before.time !== after.time || before.place !== after.place || before.type !== after.type) {
    return `예배 정보를 바꿈: ${name}`;
  }
  if (itemMeta(before) !== itemMeta(after)) return `순서를 고침: ${name}`;
  if (JSON.stringify(before.checks) !== JSON.stringify(after.checks)) return `점검을 바꿈: ${name}`;
  if (before.announcements.length !== after.announcements.length) return `광고를 바꿈: ${name}`;
  if (before.notes !== after.notes) return `예배 메모를 바꿈: ${name}`;
  return null;
}

function songMeta(db: Db): string {
  return JSON.stringify(db.songs.map((song) => [song.id, song.title, song.hymnNumber, song.key, song.license]));
}

function songBody(db: Db): string {
  return JSON.stringify(db.songs.map((song) => song.permittedLine));
}

function supplyMeta(db: Db): string {
  return JSON.stringify(db.supplies.map((supply) => [supply.id, supply.departmentId, supply.name, supply.status]));
}

function itemMeta(service: Service): string {
  return JSON.stringify(service.items.map((item) => [item.id, item.kind, item.title, item.personId, item.songId, item.pendingName, item.scripture]));
}

function serviceBody(db: Db): string {
  return JSON.stringify(
    db.services.map((service) => ({
      notes: service.notes,
      announcements: service.announcements.map((item) => item.text),
      items: service.items.map((item) => [item.scriptureText, item.screenCue, item.note]),
    })),
  );
}
