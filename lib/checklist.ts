import { involvedPeople } from "./reminders";
import type { Person, Reminder, Service, Settings, Song } from "./types";
import { assignmentProgress, isISODate, isTime } from "./worship";

export const COPYRIGHT_NOTE =
  "주보에서 곡명과 번호만 가져옵니다. 가사와 악보는 저장하거나 화면에 내지 않습니다. 사용 허가를 받은 짧은 문구만, 직접 확인한 뒤에 넣을 수 있습니다. 성경 본문 전문은 자동으로 넣지 않습니다. 구절을 크게 보여주고, 본문을 화면에 내려면 사용 가능한 번역을 직접 붙여 넣은 뒤 확인해야 합니다.";

export type CheckContext = {
  people: Person[];
  songs: Song[];
  settings: Settings;
  reminders: Reminder[];
};

export type CheckDefinition = {
  id: string;
  group: string;
  label: string;
  detail: string;
  required: boolean;
  auto: boolean;
};

export const CHECKS: CheckDefinition[] = [
  { id: "schedule", group: "순서", label: "날짜, 시간, 장소", detail: "예배 일정이 비어 있지 않습니다.", required: true, auto: true },
  { id: "order", group: "순서", label: "예배 순서", detail: "순서가 한 개 이상 있습니다.", required: true, auto: true },
  { id: "leaders", group: "순서", label: "담당자", detail: "기도, 봉독, 설교, 찬양 인도처럼 담당이 필요한 순서에 사람이 있습니다.", required: true, auto: true },
  { id: "bulletin", group: "주보", label: "주보 반영", detail: "주보를 가져왔거나, 순서를 직접 확인하고 체크합니다.", required: true, auto: true },
  { id: "scripture", group: "말씀", label: "성경 구절", detail: "봉독이나 설교에 성경 구절이 있습니다. 본문 전문은 넣지 않습니다.", required: true, auto: true },
  { id: "sermon", group: "말씀", label: "설교 제목과 설교자", detail: "설교자와 설교 제목이 있습니다.", required: true, auto: true },
  { id: "songs", group: "찬양", label: "찬송·찬양 연결", detail: "찬송, 찬양, 성가 순서에 곡명이나 번호가 연결되어 있습니다.", required: true, auto: true },
  { id: "copyright", group: "찬양", label: "저작권 표시", detail: "연결된 곡은 제목만 표시하거나, 사용 허가를 확인한 곡입니다.", required: true, auto: true },
  { id: "no-lyrics", group: "찬양", label: "가사 없는 기본값", detail: "허가 없는 가사와 악보는 저장하지 않고 화면에도 내지 않습니다.", required: true, auto: true },
  { id: "slides", group: "화면", label: "순서별 슬라이드", detail: "예배 순서마다 송출 화면이 만들어집니다.", required: true, auto: true },
  { id: "background", group: "화면", label: "배경", detail: "배경색 또는 배경 그림이 설정되어 있습니다.", required: true, auto: true },
  { id: "overlay", group: "화면", label: "자막 위치", detail: "통역 화면처럼 아래, 위, 왼쪽, 오른쪽 중 자막 위치가 있습니다.", required: true, auto: true },
  { id: "preview", group: "화면", label: "송출 미리보기", detail: "배경 위에 순서와 자막이 보이는지 직접 확인합니다.", required: true, auto: false },
  { id: "remind-day", group: "알림", label: "하루 전 알림", detail: "예배에 연결된 사람에게 하루 전 일정을 알립니다.", required: true, auto: true },
  { id: "remind-hour", group: "알림", label: "한 시간 전 알림", detail: "같은 사람에게 시작 한 시간 전 일정을 알립니다.", required: true, auto: true },
  { id: "sound", group: "현장", label: "음향", detail: "마이크와 음향을 확인합니다.", required: true, auto: false },
  { id: "music", group: "현장", label: "반주", detail: "반주나 음원 준비를 확인합니다.", required: true, auto: false },
  { id: "display", group: "현장", label: "화면 출력", detail: "송출 화면이 예배 화면에 연결되어 있습니다. 따로 프리젠테이션 프로그램이 필요 없습니다.", required: true, auto: false },
  { id: "interpret", group: "현장", label: "통역 자막", detail: "통역이 있으면 같은 자막 위치를 함께 씁니다.", required: false, auto: false },
  { id: "ushers", group: "현장", label: "안내와 봉헌", detail: "안내와 봉헌 준비를 확인합니다.", required: true, auto: false },
];

export type CheckState = CheckDefinition & { ready: boolean; checked: boolean };

const MUSICAL = new Set(["hymn", "praise", "choir"]);

export function checkItems(service: Service, ctx: CheckContext): CheckState[] {
  return CHECKS.map((item) => {
    const ready = isReady(item.id, service, ctx);
    return { ...item, ready, checked: service.checks?.[item.id] === true };
  });
}

export function missingRequired(service: Service, ctx: CheckContext): string[] {
  return checkItems(service, ctx)
    .filter((item) => item.required && !item.checked)
    .map((item) => item.label);
}

export function acceptReadyChecks(service: Service, ctx: CheckContext): Record<string, boolean> {
  const next = { ...(service.checks ?? {}) };
  for (const item of checkItems(service, ctx)) {
    if (item.auto && item.ready) next[item.id] = true;
  }
  return next;
}

export function checklistProgress(service: Service, ctx: CheckContext): { done: number; total: number } {
  const required = checkItems(service, ctx).filter((item) => item.required);
  return { total: required.length, done: required.filter((item) => item.checked).length };
}

function isReady(id: string, service: Service, ctx: CheckContext): boolean {
  const musical = service.items.filter((item) => MUSICAL.has(item.kind));
  const sermon = service.items.find((item) => item.kind === "sermon");
  switch (id) {
    case "schedule":
      return isISODate(service.date) && isTime(service.time) && service.place.trim().length > 0;
    case "order":
    case "slides":
      return service.items.length > 0;
    case "leaders": {
      const progress = assignmentProgress(service);
      return progress.assigned === progress.total;
    }
    case "bulletin":
      return service.source === "bulletin";
    case "scripture":
      return service.items.some((item) => item.scripture.trim().length > 0);
    case "sermon": {
      const preacher = service.preacherId || sermon?.personId;
      const title = sermon?.note.trim() || (sermon && sermon.title !== "설교" && sermon.title !== "말씀" ? sermon.title : "");
      return Boolean(sermon && preacher && title);
    }
    case "songs":
      return musical.every((item) => Boolean(item.songId));
    case "copyright":
      return musical.every((item) => {
        if (!item.songId) return true;
        const song = ctx.songs.find((entry) => entry.id === item.songId);
        return song?.license === "title-only" || song?.license === "permitted";
      });
    case "no-lyrics":
      return true;
    case "background":
      return Boolean(ctx.settings.backgroundColor || ctx.settings.backgroundFile);
    case "overlay":
      return ctx.settings.overlay === "bottom" || ctx.settings.overlay === "top" || ctx.settings.overlay === "left" || ctx.settings.overlay === "right";
    case "preview":
    case "sound":
    case "music":
    case "display":
    case "interpret":
    case "ushers":
      return false;
    case "remind-day":
      return remindersReady(service, ctx, "day-before");
    case "remind-hour":
      return remindersReady(service, ctx, "hour-before");
    default:
      return false;
  }
}

function remindersReady(service: Service, ctx: CheckContext, kind: Reminder["kind"]): boolean {
  if (!isISODate(service.date) || !isTime(service.time)) return false;
  const people = involvedPeople(service).filter((id) => ctx.people.some((person) => person.id === id));
  if (people.length === 0) return true;
  return people.every((personId) => ctx.reminders.some((reminder) => reminder.serviceId === service.id && reminder.personId === personId && reminder.kind === kind));
}
