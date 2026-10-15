import type { ItemKind, Song, WorshipItem } from "./types";

export type LibraryKind = "bible" | "hymn" | "praise";

export type LibraryQuery = {
  kind: LibraryKind;
  title: string;
  hymnNumber: string;
  scripture: string;
};

export type LibraryTemplate = {
  kind: LibraryKind;
  fileName: string;
  caption: string;
  bodyLabel: string;
};

export type FolderView = {
  state: "idle" | "unsupported" | "reconnect" | "connected";
  folderName: string;
  txtCount: number;
  names: string[];
};

export const LIBRARY_RULES = [
  "성경은 창세기.txt 같은 책 파일에서 주보의 장절을 읽습니다.",
  "찬송은 찬송가N장으로 찾습니다.",
  "찬양은 제목이고 띄어쓰기는 무시합니다.",
] as const;

export const LIBRARY_STEPS = [
  "라이브러리에서 성경, 찬송가, 찬양 폴더를 연결합니다.",
  "이번 주나 예배에서 해당 예배를 엽니다.",
] as const;

const SONG_KINDS = new Set<ItemKind>(["hymn", "praise", "choir"]);

export function libraryQuery(item: Pick<WorshipItem, "kind" | "title" | "scripture">, song?: Pick<Song, "title" | "hymnNumber"> | null): LibraryQuery | null {
  if (item.kind === "hymn" || (SONG_KINDS.has(item.kind) && song?.hymnNumber)) {
    return { kind: "hymn", title: song?.title || item.title, hymnNumber: digits(song?.hymnNumber || ""), scripture: "" };
  }
  if (item.kind === "praise" || item.kind === "choir") {
    return { kind: "praise", title: (song?.title || item.title).trim(), hymnNumber: "", scripture: "" };
  }
  const scripture = item.scripture.trim();
  if ((item.kind === "scripture" || item.kind === "sermon") && (scriptureKey(scripture) || bibleBook(scripture))) {
    return { kind: "bible", title: item.title, hymnNumber: "", scripture };
  }
  return null;
}

export function bibleBook(scripture: string): string {
  const match = scripture.trim().match(/^([가-힣A-Za-z]+)(?=\s*\d)/);
  return match?.[1] ?? "";
}

export function searchedLabel(query: LibraryQuery): string {
  if (query.kind === "hymn") return query.hymnNumber ? `찬송가${query.hymnNumber}장` : "찬송";
  if (query.kind === "bible") {
    const book = bibleBook(query.scripture);
    return book ? `${book}.txt` : "성경";
  }
  return query.title.normalize("NFKC").replace(/\s+/g, "") || "찬양";
}

export function libraryMatchText(fileName: string | null, searched: string): string {
  return fileName ? `${fileName} · 준비됨` : `파일 없음 · ${searched}`;
}

export type VerseSpan = { chapter: number; start: number; end: number };

export function verseSpan(scripture: string): VerseSpan | null {
  const text = scripture.trim();
  const colon = text.match(/(\d+)\s*[:：]\s*(\d+)\s*(?:[-–~]\s*(\d+))?/);
  if (colon) {
    const start = Number(colon[2]);
    const end = colon[3] ? Number(colon[3]) : start;
    return { chapter: Number(colon[1]), start, end: Math.max(start, end) };
  }
  const chapter = text.match(/(\d+)\s*장(?:\s*(\d+)\s*(?:[-–~]\s*(\d+))?\s*절)?/);
  if (!chapter) return null;
  const start = chapter[2] ? Number(chapter[2]) : 1;
  const end = chapter[3] ? Number(chapter[3]) : chapter[2] ? start : start + 7;
  return { chapter: Number(chapter[1]), start, end: Math.max(start, end) };
}

export function passageFromBook(text: string, scripture: string): string[] {
  const span = verseSpan(scripture);
  if (!span) return [];
  const lines = text.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  const direct = lines.flatMap((line) => {
    const match = line.match(new RegExp(`^(?:제\\s*)?${span.chapter}\\s*[:：]\\s*(\\d+)\\s*(?:절)?\\s*(.*)$`));
    if (!match) return [];
    const verse = Number(match[1]);
    if (verse < span.start || verse > span.end) return [];
    return [match[2].trim() || line];
  });
  if (direct.length > 0) return direct.slice(0, 24);
  let inChapter = false;
  const block: string[] = [];
  const heading = new RegExp(`^(?:제\\s*)?${span.chapter}\\s*장`);
  for (const line of lines) {
    if (heading.test(line)) {
      inChapter = true;
      continue;
    }
    if (inChapter && /^(?:제\s*)?\d+\s*장/.test(line)) break;
    if (!inChapter || /^(?:제\s*)?\d+\s*장/.test(line)) continue;
    const match = line.match(/^(\d+)\s*(?:절|[.)])?\s*(.*)$/);
    if (!match) continue;
    const verse = Number(match[1]);
    if (verse < span.start || verse > span.end) continue;
    const words = match[2].trim();
    if (words) block.push(words);
  }
  return block.slice(0, 24);
}

export function fileSlides(query: LibraryQuery, text: string): string[] {
  if (query.kind === "bible") {
    const verses = passageFromBook(text, query.scripture);
    const chunks: string[] = [];
    for (let index = 0; index < verses.length; index += 4) chunks.push(verses.slice(index, index + 4).join("\n"));
    return chunks.slice(0, 12);
  }
  return splitSlides(text);
}

export function previewLine(text: string): string {
  const line = text.replace(/\r/g, "").split("\n").map((item) => item.trim()).find(Boolean) ?? "";
  if (line.length <= 80) return line;
  return `${line.slice(0, 80)}…`;
}

export function folderStatusText(view: FolderView): string {
  if (view.state === "unsupported") return "이 브라우저에서는 폴더를 연결할 수 없습니다.";
  if (view.state === "reconnect") {
    return view.folderName ? `${view.folderName} 폴더 권한이 없습니다. 다시 연결해 주세요.` : "폴더 권한이 없습니다. 다시 연결해 주세요.";
  }
  if (view.state !== "connected") return "아직 연결하지 않았습니다.";
  const folderName = view.folderName || "폴더";
  if (view.txtCount === 0) return `연결됨 · ${folderName} · txt 파일이 없습니다.`;
  return `연결됨 · ${folderName} · txt ${view.txtCount}개 · ${view.names.join(", ")}`;
}

export function scriptureKey(scripture: string): string {
  const match = scripture.trim().match(/([가-힣A-Za-z]+)\s*(\d+)\s*[:：]\s*(\d+)/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function wantedFileNames(query: LibraryQuery): string[] {
  if (query.kind === "hymn" && query.hymnNumber) {
    const number = query.hymnNumber;
    return [`찬송가${number}장.txt`, `hymn-${number}.txt`, `찬송-${number}.txt`, `찬송${number}.txt`, `${number}.txt`, `${number}장.txt`];
  }
  if (query.kind === "bible") {
    const key = scriptureKey(query.scripture);
    const book = bibleBook(query.scripture);
    return [book ? `${book}.txt` : "", key ? `bible-${key}.txt` : "", key ? `${key}.txt` : ""].filter(Boolean);
  }
  const slug = compact(query.title);
  return slug ? [`praise-${slug}.txt`, `찬양-${slug}.txt`, `${slug}.txt`] : [];
}

export function fileMatchesQuery(fileName: string, query: LibraryQuery): boolean {
  const base = fileName.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
  if (!base.endsWith(".txt")) return false;
  const names = new Set(wantedFileNames(query).map((name) => name.toLowerCase()));
  if (names.has(base)) return true;
  const stem = base.slice(0, -4);
  const folded = stem.normalize("NFKC").replace(/\s+/g, "");
  if (query.kind === "hymn" && query.hymnNumber && folded === `찬송가${query.hymnNumber}장`) return true;
  if (query.kind === "bible") {
    const book = bibleBook(query.scripture).normalize("NFKC").replace(/\s+/g, "").toLowerCase();
    if (book && folded.toLowerCase() === book) return true;
  }
  if (query.kind === "praise") {
    const title = query.title.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
    if (title && folded.toLowerCase() === title) return true;
  }
  if (query.kind === "hymn" && query.hymnNumber) {
    return new RegExp(`(^|[^0-9])${query.hymnNumber}([^0-9]|$)`).test(stem);
  }
  if (query.kind === "bible") {
    const key = scriptureKey(query.scripture).toLowerCase();
    return Boolean(key) && stem.includes(key);
  }
  const slug = compact(query.title).toLowerCase();
  return Boolean(slug) && stem.includes(slug);
}

export function preferredFileName(query: LibraryQuery): string {
  return wantedFileNames(query)[0] || "note.txt";
}

export function emptyTemplate(query: LibraryQuery): LibraryTemplate {
  if (query.kind === "hymn") {
    return { kind: "hymn", fileName: preferredFileName(query), caption: `찬송 ${query.hymnNumber}장`, bodyLabel: "가사" };
  }
  if (query.kind === "bible") {
    return { kind: "bible", fileName: preferredFileName(query), caption: query.scripture, bodyLabel: "본문" };
  }
  return { kind: "praise", fileName: preferredFileName(query), caption: query.title || "찬양", bodyLabel: "가사" };
}

export function textFileBody(query: LibraryQuery, body: string): string {
  const written = body.replace(/\r/g, "").trim();
  if (query.kind === "hymn") return `찬송 ${query.hymnNumber}장\n${query.title}\n\n${written}\n`;
  if (query.kind === "bible") return `${query.scripture}\n\n${written}\n`;
  return `${query.title}\n\n${written}\n`;
}

export function splitSlides(text: string): string[] {
  const chunks = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks.slice(0, 12);
}

function digits(value: string): string {
  return (value.match(/\d+/)?.[0] ?? "").slice(0, 6);
}

function compact(value: string): string {
  return value.trim().replace(/\s+/g, "").slice(0, 40);
}
