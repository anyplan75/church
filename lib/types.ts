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

export type Person = {
  id: string;
  name: string;
  roles: string[];
  phone: string;
  active: boolean;
};

export type Song = {
  id: string;
  title: string;
  hymnNumber: string;
  key: string;
};

export type WorshipItem = {
  id: string;
  kind: ItemKind;
  title: string;
  note: string;
  scripture: string;
  personId: string | null;
  songId: string | null;
};

export type Announcement = {
  id: string;
  text: string;
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
};

export type Settings = {
  churchName: string;
};

export type Db = {
  settings: Settings;
  people: Person[];
  songs: Song[];
  services: Service[];
};
