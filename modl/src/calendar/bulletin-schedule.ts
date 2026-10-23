/**
 * 주보에서 읽은 예배와 광고 일정을 달력 줄로 바꿉니다.
 * 십일조, 헌금, 봉헌은 일정으로 만들지 않습니다.
 * 데이터베이스에 접속하지 않습니다.
 */

export type BulletinScheduleSource = {
  label: string;
  time: string;
  worshipDate: string;
  sermonTitle: string;
  announcements: string;
};

export type BulletinScheduleDraft = {
  sourceKey: string;
  title: string;
  startAt: Date;
  endAt: Date;
};

const DATE_RE = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일|(\d{1,2})\s*월\s*(\d{1,2})\s*일/;

export function isOfferingSchedule(line: string): boolean {
  return /십일조|헌금|봉헌/.test(line);
}

/** 예배 한 번과, 날짜나 시각이 있는 광고만 일정으로 고릅니다. */
export function schedulesFromBulletin(source: BulletinScheduleSource): BulletinScheduleDraft[] {
  const drafts: BulletinScheduleDraft[] = [];
  const worshipDate = normalizeDate(source.worshipDate);
  const worshipTime = clockOr(source.time, "11:00");
  if (worshipDate) {
    const title = (source.label.trim() || source.sermonTitle.trim() || "예배").slice(0, 80);
    const startAt = wallClock(worshipDate, worshipTime);
    drafts.push({
      sourceKey: "worship",
      title,
      startAt,
      endAt: addMinutes(startAt, 90),
    });
  }
  const lines = source.announcements
    .split("\n")
    .map((line) => line.replace(/^[-•·*–]\s*/, "").trim())
    .filter(Boolean);
  let notice = 0;
  for (const line of lines) {
    if (isOfferingSchedule(line)) continue;
    const placed = placeAnnouncement(line, worshipDate, worshipTime);
    if (!placed) continue;
    drafts.push({
      sourceKey: `notice-${notice}`,
      title: line.slice(0, 80),
      startAt: placed.startAt,
      endAt: placed.endAt,
    });
    notice += 1;
  }
  return drafts;
}

/** 주보에서 읽은 일정은 그 교회에만 붙입니다. 교회가 없으면 어디에도 넣지 않습니다. */
export function attachBulletinEvents<T extends { sourceKey: string }>(
  churchId: string | null,
  drafts: readonly T[],
): Array<T & { churchId: string; groupId: null }> {
  if (!churchId) return [];
  return drafts.map((draft) => ({ ...draft, churchId, groupId: null }));
}

function placeAnnouncement(
  line: string,
  worshipDate: string,
  worshipTime: string,
): { startAt: Date; endAt: Date } | null {
  const dated = readLineDate(line, worshipDate);
  const clock = readClock(line);
  const afterWorship = /예배\s*후/.test(line);
  const eventWord = /행사|모임|집회|수련회|세미나|대회|친교|제직회/.test(line);
  if (!dated && !clock && !afterWorship && !eventWord) return null;
  const date = dated || worshipDate;
  if (!date) return null;
  if (afterWorship && worshipDate) {
    const startAt = addMinutes(wallClock(worshipDate, worshipTime), 90);
    return { startAt, endAt: addMinutes(startAt, 60) };
  }
  const startAt = wallClock(date, clock ?? (worshipDate === date ? worshipTime : "10:00"));
  return { startAt, endAt: addMinutes(startAt, 60) };
}

function readLineDate(line: string, worshipDate: string): string {
  const match = line.match(DATE_RE);
  if (!match) return "";
  if (match[1]) return normalizeDate(`${match[1]}-${match[2]}-${match[3]}`);
  const year = worshipDate.slice(0, 4) || String(new Date().getUTCFullYear());
  return normalizeDate(`${year}-${match[4]}-${match[5]}`);
}

function readClock(line: string): string | null {
  const ampm = line.match(/(오전|오후)\s*(\d{1,2})\s*(?:[:시]\s*(\d{1,2}))?/);
  if (ampm) {
    let hour = Number(ampm[2]);
    const minute = Number(ampm[3] ?? 0);
    if (ampm[1] === "오후" && hour < 12) hour += 12;
    if (ampm[1] === "오전" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return padClock(hour, minute);
  }
  const clock = line.match(/(\d{1,2}):(\d{2})/);
  if (!clock) return null;
  return padClock(Number(clock[1]), Number(clock[2]));
}

function clockOr(value: string, fallback: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  return padClock(Number(match[1]), Number(match[2])) || fallback;
}

function padClock(hour: number, minute: number): string | null {
  if (hour > 23 || minute > 59 || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeDate(value: string): string {
  const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 화면의 시·분은 서버 시간대와 상관없이 그 숫자 그대로 저장합니다. */
function wallClock(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
