import type { Person } from "./types";

const TITLES = ["전도사", "강도사", "목사", "장로", "권사", "집사", "성도", "사모"] as const;
const TITLE_PATTERN = "전도사|강도사|목사|장로|권사|집사|성도|사모";
const LABEL = /^(묵도|사도신경|신앙고백|찬송|찬양|통성기도|대표기도|기도|성경봉독|성가대|성가|설교|말씀|봉헌|광고|축도)\s*/;
const NAME_ENDINGS = /(?:에서|으로|로서|에게|부터|까지|하는|하며|하여|하고|하다|하자|이다|입니다|하라)$/;

const BLOCKED = new Set([
  "묵도",
  "사도신경",
  "신앙고백",
  "찬송",
  "찬양",
  "통성기도",
  "대표기도",
  "기도",
  "성경봉독",
  "성가",
  "성가대",
  "설교",
  "말씀",
  "봉헌",
  "광고",
  "축도",
  "다함께",
  "회중",
  "인도",
  "반주",
  "헌금",
  "특별",
  "제목",
  "본문",
  "사람",
  "우리",
  "주님",
  "하나님",
  "예수님",
  "예수",
  "모두",
  "회개",
  "결단",
  "파송",
  "축복",
  "환영",
  ...TITLES,
  "창세기",
  "출애굽기",
  "레위기",
  "민수기",
  "신명기",
  "여호수아",
  "사사기",
  "룻기",
  "사무엘상",
  "사무엘하",
  "열왕기상",
  "열왕기하",
  "역대상",
  "역대하",
  "에스라",
  "느헤미야",
  "에스더",
  "욥기",
  "시편",
  "잠언",
  "전도서",
  "아가",
  "이사야",
  "예레미야",
  "예레미야애가",
  "에스겔",
  "다니엘",
  "호세아",
  "요엘",
  "아모스",
  "오바댜",
  "요나",
  "미가",
  "나훔",
  "하박국",
  "스바냐",
  "학개",
  "스가랴",
  "말라기",
  "마태복음",
  "마가복음",
  "누가복음",
  "요한복음",
  "사도행전",
  "로마서",
  "고린도전서",
  "고린도후서",
  "갈라디아서",
  "에베소서",
  "빌립보서",
  "골로새서",
  "데살로니가전서",
  "데살로니가후서",
  "디모데전서",
  "디모데후서",
  "디도서",
  "빌레몬서",
  "히브리서",
  "야고보서",
  "베드로전서",
  "베드로후서",
  "요한일서",
  "요한이서",
  "요한삼서",
  "유다서",
  "요한계시록",
]);

export function personMatchKey(name: string): string {
  let text = name.trim().replace(/\s+/g, "");
  for (let pass = 0; pass < 3 && text; pass += 1) {
    const next = stripEdgeTitle(text);
    if (next === text) break;
    text = next;
  }
  if ((TITLES as readonly string[]).includes(text)) return "";
  return text;
}

export function cleanRosterName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, 40);
  const key = personMatchKey(trimmed);
  if (key.length < 2) return "";
  return trimmed.replace(/\s+/g, "") === key ? trimmed : key;
}

export function findRosterPerson(line: string, people: Person[]): Person | null {
  const collapsed = line.trim().replace(/\s+/g, " ");
  if (!collapsed) return null;
  const entries = people
    .map((person) => ({
      person,
      exact: person.name.trim().replace(/\s+/g, " "),
      key: personMatchKey(person.name),
    }))
    .filter((entry) => entry.exact.length > 0);
  const exacts = entries.slice().sort((a, b) => b.exact.length - a.exact.length);
  for (const entry of exacts) {
    if (hasBoundedName(collapsed, entry.exact)) return entry.person;
  }
  const keys = new Set(
    collapsed
      .split(" ")
      .map((token) => personMatchKey(token))
      .filter((key) => key.length >= 2),
  );
  const ranked = entries.filter((entry) => entry.key.length >= 2).slice().sort((a, b) => b.key.length - a.key.length);
  for (const entry of ranked) {
    if (keys.has(entry.key)) return entry.person;
  }
  return null;
}

export function bulletinPersonName(line: string, people: Person[]): string {
  const person = findRosterPerson(line, people);
  if (person) return person.name.trim().replace(/\s+/g, " ");
  return unknownPersonName(line);
}

export function stripPersonMention(text: string, name: string): string {
  const key = personMatchKey(name);
  if (key.length < 2) return text.replace(/\s+/g, " ").trim();
  const pattern = new RegExp(`(?<![가-힣])(?:(?:${TITLE_PATTERN})\\s*)?${escapeRegExp(key)}(?:\\s*(?:${TITLE_PATTERN})님?)?(?![가-힣])`, "g");
  return text.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

function unknownPersonName(line: string): string {
  const softened = line.replace(/[.]{2,}|[·…]{1,}/g, " ").trim().replace(/\s+/g, " ");
  const label = softened.match(LABEL);
  if (!label) return "";
  const body = softened.slice(label[0].length).trim();
  if (!body) return "";
  const titled = findTitledName(body);
  if (titled) return titled;
  if (!/기도|봉독|설교|말씀|봉헌|축도|성가/.test(label[1])) return "";
  if (/^[가-힣]{2,5}$/.test(body) && isLikelyPersonalName(body)) return body;
  const tokens = body.split(" ");
  const last = tokens[tokens.length - 1] ?? "";
  if (tokens.length >= 2 && /^[가-힣]{3,4}$/.test(last) && isLikelyPersonalName(last)) return last;
  const first = tokens[0] ?? "";
  if (tokens.length >= 2 && /^[가-힣]{2,5}$/.test(first) && isLikelyPersonalName(first) && looksLikeScripture(tokens.slice(1).join(" "))) {
    return first;
  }
  return "";
}

function findTitledName(body: string): string {
  const patterns = [
    new RegExp(`(?:^|[^가-힣])(?:${TITLE_PATTERN})\\s*([가-힣]{2,5})(?=[^가-힣]|$)`),
    new RegExp(`(?:^|[^가-힣])([가-힣]{2,5})\\s*(?:${TITLE_PATTERN})님?(?=[^가-힣]|$)`),
    new RegExp(`(?:^|[^가-힣])(?:${TITLE_PATTERN})([가-힣]{2,5})(?=[^가-힣]|$)`),
    new RegExp(`(?:^|[^가-힣])([가-힣]{2,5})(?:${TITLE_PATTERN})님?(?=[^가-힣]|$)`),
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    const name = match?.[1] ?? "";
    if (isLikelyPersonalName(name)) return name;
  }
  return "";
}

function stripEdgeTitle(text: string): string {
  const titles = [...TITLES].slice().sort((a, b) => b.length - a.length);
  for (const title of titles) {
    const withoutNim = text.endsWith("님") ? text.slice(0, -1) : text;
    if (withoutNim.endsWith(title) && withoutNim.length > title.length) {
      const rest = withoutNim.slice(0, -title.length);
      if (/^[가-힣]{2,5}$/.test(rest)) return rest;
    }
    if (text.startsWith(title) && text.length > title.length) {
      const rest = text.slice(title.length);
      if (/^[가-힣]{2,5}$/.test(rest)) return rest;
    }
  }
  return text;
}

function isLikelyPersonalName(token: string): boolean {
  if (!/^[가-힣]{2,5}$/.test(token)) return false;
  if (BLOCKED.has(token)) return false;
  if (NAME_ENDINGS.test(token)) return false;
  return true;
}

function looksLikeScripture(text: string): boolean {
  if (/\d/.test(text)) return true;
  const first = text.split(" ")[0] ?? "";
  return BLOCKED.has(first);
}

function hasBoundedName(line: string, name: string): boolean {
  if (!name) return false;
  return new RegExp(`(?:^|\\s)${escapeRegExp(name)}(?=\\s|$)`).test(line);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
