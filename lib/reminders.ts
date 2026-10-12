import { formatKoreanDate, formatTime } from "./format";
import type { Db, Person, Reminder, ReminderKind, Service } from "./types";
import { isISODate, isTime } from "./worship";

const HOURS: Record<ReminderKind, number> = {
  "day-before": 24,
  "hour-before": 1,
};

export function reminderRecipient(people: Person[], personId: string): string {
  const person = people.find((entry) => entry.id === personId);
  if (!person) return "";
  const phone = person.phone.trim();
  return phone ? `${person.name} · 전화 ${phone}` : person.name;
}

export function involvedPeople(service: Service): string[] {
  const ids: string[] = [];
  if (service.preacherId) ids.push(service.preacherId);
  for (const item of service.items) {
    if (item.personId && !ids.includes(item.personId)) ids.push(item.personId);
  }
  return ids;
}

export function dueAt(date: string, time: string, hoursBefore: number): string {
  const start = new Date(`${date}T${time}:00+09:00`);
  return new Date(start.getTime() - hoursBefore * 60 * 60 * 1000).toISOString();
}

export function planReminders(service: Service, people: Person[], churchName: string, now = new Date()): Reminder[] {
  if (!isISODate(service.date) || !isTime(service.time) || service.status === "done") return [];
  const reminders: Reminder[] = [];
  for (const personId of involvedPeople(service)) {
    const person = people.find((entry) => entry.id === personId);
    if (!person) continue;
    for (const kind of ["day-before", "hour-before"] as const) {
      const when = dueAt(service.date, service.time, HOURS[kind]);
      reminders.push({
        id: `reminder-${service.id}-${personId}-${kind}`,
        serviceId: service.id,
        personId,
        kind,
        dueAt: when,
        message: reminderMessage(churchName, service, person, kind),
        status: Date.parse(when) <= now.getTime() ? "due" : "scheduled",
      });
    }
  }
  return reminders;
}

export function syncReminders(db: Db, now = new Date()): void {
  const keep = new Set<string>();
  for (const service of db.services) {
    for (const planned of planReminders(service, db.people, db.settings.churchName, now)) {
      const existing = db.reminders.find(
        (reminder) => reminder.serviceId === planned.serviceId && reminder.personId === planned.personId && reminder.kind === planned.kind,
      );
      if (!existing) {
        db.reminders.push(planned);
        keep.add(planned.id);
        continue;
      }
      existing.dueAt = planned.dueAt;
      existing.message = planned.message;
      if (existing.status !== "sent") existing.status = planned.status;
      keep.add(existing.id);
    }
  }
  db.reminders = db.reminders.filter((reminder) => keep.has(reminder.id) || reminder.status === "sent");
}

function reminderMessage(churchName: string, service: Service, person: Person, kind: ReminderKind): string {
  const duties = service.items
    .filter((item) => item.personId === person.id)
    .map((item) => (item.kind === "sermon" && item.note.trim() ? `${item.title} ${item.note.trim().slice(0, 40)}` : item.title));
  if (service.preacherId === person.id && !duties.some((duty) => duty.startsWith("설교") || duty.startsWith("말씀"))) {
    duties.unshift("설교");
  }
  const when = kind === "day-before" ? "하루 전 알림" : "한 시간 전 알림";
  const duty = duties.length > 0 ? duties.join(", ") : service.title;
  return `${when}. ${churchName} ${formatKoreanDate(service.date)} ${formatTime(service.time)} ${service.place}. ${person.name}님 ${duty}`;
}
