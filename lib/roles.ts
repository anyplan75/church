export const ROLES = [
  {
    id: "view",
    label: "보기",
    detail: "이번 주, 예배 목록, 주보를 읽습니다.",
  },
  {
    id: "prepare",
    label: "준비",
    detail: "예배를 만들고 순서를 고칩니다.",
  },
  {
    id: "run",
    label: "진행",
    detail: "예배를 시작하고 순서를 넘깁니다.",
  },
  {
    id: "output",
    label: "송출",
    detail: "송출 화면과 슬라이드를 다룹니다.",
  },
  {
    id: "directory",
    label: "사람·찬양",
    detail: "사람과 찬양 명단을 다룹니다.",
  },
  {
    id: "admin",
    label: "설정·계정",
    detail: "교회 설정과 이메일 계정을 관리합니다.",
  },
] as const;

export type Role = (typeof ROLES)[number]["id"];

export const ALL_ROLES: Role[] = ROLES.map((role) => role.id);

export type Capability =
  | "screen.week"
  | "screen.services"
  | "screen.bulletin"
  | "screen.prepare"
  | "screen.new"
  | "screen.editor"
  | "screen.live"
  | "screen.output"
  | "screen.slides"
  | "screen.people"
  | "screen.songs"
  | "screen.settings"
  | "mutate.prepare"
  | "mutate.run"
  | "mutate.output"
  | "mutate.directory"
  | "mutate.admin"
  | "screen.attendance"
  | "screen.inventory"
  | "mutate.attendance.leader"
  | "mutate.inventory"
  | "screen.activity";

const GRANTS: Record<Role, readonly Capability[]> = {
  view: ["screen.week", "screen.services", "screen.bulletin", "screen.attendance", "screen.inventory"],
  prepare: [
    "screen.week",
    "screen.services",
    "screen.bulletin",
    "screen.prepare",
    "screen.new",
    "screen.editor",
    "mutate.prepare",
    "screen.attendance",
    "mutate.attendance.leader",
    "screen.inventory",
    "mutate.inventory",
  ],
  run: ["screen.week", "screen.services", "screen.live", "mutate.run", "screen.attendance", "mutate.attendance.leader"],
  output: ["screen.week", "screen.services", "screen.output", "screen.slides", "mutate.output", "screen.attendance"],
  directory: [
    "screen.people",
    "screen.songs",
    "mutate.directory",
    "screen.attendance",
    "mutate.attendance.leader",
    "screen.inventory",
    "mutate.inventory",
  ],
  admin: ["screen.settings", "mutate.admin", "screen.attendance", "mutate.attendance.leader", "screen.inventory", "mutate.inventory", "screen.activity"],
};

const PATH_RULES: { test: (pathname: string) => boolean; caps: Capability[] }[] = [
  { test: (pathname) => pathname === "/", caps: ["screen.bulletin"] },
  { test: (pathname) => pathname === "/week", caps: ["screen.week"] },
  { test: (pathname) => pathname === "/library", caps: ["screen.songs"] },
  { test: (pathname) => pathname === "/prepare", caps: ["screen.prepare"] },
  { test: (pathname) => pathname === "/services", caps: ["screen.services"] },
  { test: (pathname) => pathname === "/services/new", caps: ["screen.new"] },
  { test: (pathname) => pathname === "/people", caps: ["screen.people"] },
  { test: (pathname) => pathname === "/songs", caps: ["screen.songs"] },
  { test: (pathname) => pathname === "/settings", caps: ["screen.settings"] },
  { test: (pathname) => pathname === "/activity", caps: ["screen.activity"] },
  { test: (pathname) => pathname === "/attendance", caps: ["screen.attendance"] },
  { test: (pathname) => pathname === "/inventory", caps: ["screen.inventory"] },
  { test: (pathname) => /^\/services\/[^/]+\/bulletin$/.test(pathname), caps: ["screen.bulletin"] },
  { test: (pathname) => /^\/services\/[^/]+\/live$/.test(pathname), caps: ["screen.live"] },
  { test: (pathname) => /^\/services\/[^/]+\/output$/.test(pathname), caps: ["screen.output"] },
  { test: (pathname) => /^\/services\/[^/]+\/slides$/.test(pathname), caps: ["screen.slides"] },
  { test: (pathname) => /^\/services\/[^/]+$/.test(pathname), caps: ["screen.editor"] },
];

export function isRole(value: string): value is Role {
  return ROLES.some((role) => role.id === value);
}

export function normalizeRoles(values: readonly string[]): Role[] {
  const picked = new Set<Role>();
  for (const value of values) {
    if (isRole(value)) picked.add(value);
  }
  return ALL_ROLES.filter((role) => picked.has(role));
}

export function can(roles: readonly Role[], capability: Capability): boolean {
  return roles.some((role) => GRANTS[role].includes(capability));
}

export function canOpenPath(roles: readonly Role[], pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  if (path === "/login" || path === "/setup" || path === "/denied" || path === "/receive") return true;
  const rule = PATH_RULES.find((item) => item.test(path));
  if (!rule) return false;
  return rule.caps.some((capability) => can(roles, capability));
}

export function homeFor(roles: readonly Role[]): string {
  if (can(roles, "screen.bulletin")) return "/";
  if (can(roles, "screen.week")) return "/week";
  if (can(roles, "screen.prepare")) return "/";
  if (can(roles, "screen.services")) return "/services";
  if (can(roles, "screen.people")) return "/people";
  if (can(roles, "screen.songs")) return "/songs";
  if (can(roles, "screen.settings")) return "/settings";
  if (can(roles, "screen.attendance")) return "/attendance";
  if (can(roles, "screen.inventory")) return "/inventory";
  return "/denied";
}

export const WEB_OUTPUT_ORIGIN = "https://eunhye-church.surge.sh";

export type ServiceLink = { href: string; label: string };

export function outputLinks(id: string, localOrigin = ""): ServiceLink[] {
  const origin = localOrigin.replace(/\/$/, "");
  return (["overlay", "main"] as const).flatMap((mode) => {
    const path = `/services/${id}/output?mode=${mode}`;
    const name = mode === "overlay" ? "오버레이" : "메인";
    return [
      { href: `${WEB_OUTPUT_ORIGIN}${path}`, label: `${name} 웹` },
      { href: origin ? `${origin}${path}` : path, label: `${name} 로컬` },
    ];
  });
}

export function serviceDestinations(id: string, roles: readonly Role[]): ServiceLink[] {
  const links: ServiceLink[] = [];
  if (can(roles, "screen.editor")) links.push({ href: `/services/${id}`, label: "순서" });
  if (can(roles, "screen.live")) links.push({ href: `/services/${id}/live`, label: "진행" });
  if (can(roles, "screen.output")) links.push(...outputLinks(id));
  if (can(roles, "screen.bulletin")) links.push({ href: `/services/${id}/bulletin`, label: "주보" });
  return links;
}

export function primaryServiceHref(id: string, roles: readonly Role[]): string {
  return serviceDestinations(id, roles)[0]?.href ?? "/services";
}
