const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function formatKoreanDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = WEEKDAYS[date.getUTCDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

export function formatMonthDay(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${month}월 ${day}일`;
}

export function formatWeekday(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAYS[date.getUTCDay()];
}

export function formatTime(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 || 12;
  return `${period} ${hour12}:${minute}`;
}

export function relativeDay(iso: string, today: string): string | null {
  if (iso === today) return "오늘";
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  const tomorrow = date.toISOString().slice(0, 10);
  if (iso === tomorrow) return "내일";
  return null;
}
