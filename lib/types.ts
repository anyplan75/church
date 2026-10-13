export const ITEM_KINDS = [
  { id: "meditation", label: "묵도" },
  { id: "hymn", label: "찬송" },
  { id: "creed", label: "신앙고백" },
  { id: "praise", label: "찬양" },
  { id: "prayer", label: "기도" },
  { id: "scripture", label: "성경봉독" },
  { id: "choir", label: "성가" },
  { id: "sermon", label: "설교" },
  { id: "offering", label: "봉헌" },
  { id: "announcement", label: "광고" },
  { id: "benediction", label: "축도" },
  { id: "other", label: "기타" },
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number]["id"];

export const SERVICE_TYPES = [
  { id: "sunday-1", label: "주일 1부 예배", defaultTime: "09:00", defaultTitle: "주일 1부 예배" },
  { id: "sunday-2", label: "주일 2부 예배", defaultTime: "11:00", defaultTitle: "주일 2부 예배" },
  { id: "sunday-3", label: "주일 3부 예배", defaultTime: "14:00", defaultTitle: "주일 3부 예배" },
  { id: "wednesday", label: "수요 예배", defaultTime: "19:30", defaultTitle: "수요 예배" },
  { id: "friday", label: "금요 기도회", defaultTime: "21:00", defaultTitle: "금요 기도회" },
  { id: "dawn", label: "새벽 기도회", defaultTime: "05:30", defaultTitle: "새벽 기도회" },
  { id: "special", label: "특별 예배", defaultTime: "11:00", defaultTitle: "특별 예배" },
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number]["id"];

export const STATUSES = [
  { id: "planning", label: "준비 중" },
  { id: "ready", label: "준비 완료" },
  { id: "live", label: "진행 중" },
  { id: "done", label: "마친 예배" },
] as const;

export type ServiceStatus = (typeof STATUSES)[number]["id"];

export const MEMBERSHIPS = [
  { id: "member", label: "교인" },
  { id: "visitor", label: "방문자" },
  { id: "newcomer", label: "새신자" },
] as const;

export type Membership = (typeof MEMBERSHIPS)[number]["id"];

export type Person = {
  id: string;
  name: string;
  roles: string[];
  phone: string;
  active: boolean;
  membership: Membership;
  attendanceConsent: boolean;
};

export type SongLicense = "title-only" | "permitted";

export type Song = {
  id: string;
  title: string;
  hymnNumber: string;
  key: string;
  license: SongLicense;
  permittedLine: string;
};

export type WorshipItem = {
  id: string;
  kind: ItemKind;
  title: string;
  note: string;
  scripture: string;
  scriptureText: string;
  scriptureLicensed: boolean;
  screenCue: string;
  personId: string | null;
  pendingName: string;
  songId: string | null;
};

export type Announcement = {
  id: string;
  text: string;
};

export type ReminderKind = "day-before" | "hour-before";

export type Reminder = {
  id: string;
  serviceId: string;
  personId: string;
  kind: ReminderKind;
  dueAt: string;
  message: string;
  status: "scheduled" | "due" | "sent";
};

export type Service = {
  id: string;
  title: string;
  date: string;
  time: string;
  type: ServiceType;
  place: string;
  preacherId: string | null;
  status: ServiceStatus;
  items: WorshipItem[];
  announcements: Announcement[];
  liveIndex: number;
  startedAt: string | null;
  notes: string;
  checks: Record<string, boolean>;
  source: "manual" | "bulletin";
};

export type OverlayPosition = "bottom" | "top" | "left" | "right";

export type Settings = {
  churchName: string;
  backgroundColor: string;
  backgroundFile: string | null;
  overlay: OverlayPosition;
};

export type AttendanceMark = {
  personId: string;
  week: string;
  present: true;
};

export const SUPPLY_STATUSES = [
  { id: "have", label: "지금 있는 것" },
  { id: "need", label: "앞으로 필요한 것" },
  { id: "requested", label: "요청이 들어온 것" },
] as const;

export type SupplyStatus = (typeof SUPPLY_STATUSES)[number]["id"];

export type Department = {
  id: string;
  name: string;
};

export type Supply = {
  id: string;
  departmentId: string;
  name: string;
  photo: string;
  status: SupplyStatus;
};

export type Db = {
  settings: Settings;
  people: Person[];
  songs: Song[];
  services: Service[];
  reminders: Reminder[];
  departments: Department[];
  attendance: AttendanceMark[];
  supplies: Supply[];
};
