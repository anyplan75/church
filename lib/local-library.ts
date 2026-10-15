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
  "성경은 파일 이름에 창세기 같은 책 이름이 들어 있으면 그 파일에서 주보의 장절을 읽습니다. 앞의 숫자는 무시합니다.",
  "찬송은 파일 이름에 찬송가N장이 들어 있으면 됩니다. 앞의 숫자는 무시합니다.",
  "찬양은 파일 이름에 제목이 들어 있으면 됩니다. 띄어쓰기와 앞의 숫자는 무시합니다.",
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
  const colonVerse = new RegExp(`^(?:[가-힣A-Za-z]{1,8}\\s*)?(?:제\\s*)?${span.chapter}\\s*(?:장\\s*)?[:：]\\s*(\\d+)\\s*(?:절)?\\s*(.*)$`);
  const chapterVerse = new RegExp(`^(?:제\\s*)?${span.chapter}\\s*장\\s*(\\d+)\\s*절\\s*(.*)$`);
  const direct = lines.flatMap((line) => {
    const match = line.match(colonVerse) || line.match(chapterVerse);
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
    const match = line.match(/^[<\[（(]?\s*(\d+)\s*[>\]）)]?\s*(?:절|[.)])?\s*(.*)$/);
    if (!match) continue;
    const verse = Number(match[1]);
    if (verse < span.start || verse > span.end) continue;
    const words = match[2].trim();
    if (words) block.push(words);
  }
  return block.slice(0, 24);
}

const SLIDE_LINE = 18;

export function readableLines(text: string): string[] {
  const rows = text.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const row of rows) {
    let rest = row;
    while (rest.length > SLIDE_LINE) {
      const space = rest.lastIndexOf(" ", SLIDE_LINE);
      const cut = space >= 8 ? space : SLIDE_LINE;
      lines.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) lines.push(rest);
  }
  return lines;
}

export function twoLineSlides(text: string): string[] {
  const lines = readableLines(text);
  const slides: string[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const pair = [lines[index], lines[index + 1]].filter(Boolean);
    if (pair.length > 0) slides.push(pair.join("\n"));
  }
  return slides.slice(0, 40);
}

export function fileSlides(query: LibraryQuery, text: string): string[] {
  if (query.kind === "bible") {
    const verses = passageFromBook(text, query.scripture);
    const rows = text.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
    const source = verses.length > 0 ? verses.join("\n") : rows.length > 0 && rows.length <= 40 ? rows.join("\n") : "";
    return twoLineSlides(source);
  }
  return twoLineSlides(text);
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

export function foldedStem(fileName: string): string {
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? "";
  return base.replace(/\.txt$/i, "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

export function stripLeadingNumber(value: string): string {
  return value.replace(/^\d+[_-]?/, "");
}

export function nameContains(fileName: string, label: string): boolean {
  const needle = label.normalize("NFKC").replace(/\s+/g, "").replace(/\.txt$/i, "").toLowerCase();
  if (!needle) return false;
  const folded = foldedStem(fileName);
  return folded.includes(needle) || stripLeadingNumber(folded).includes(needle);
}

export function fileMatchesQuery(fileName: string, query: LibraryQuery): boolean {
  const base = fileName.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
  if (!base.endsWith(".txt")) return false;
  const folded = foldedStem(fileName);
  if (query.kind === "hymn" && query.hymnNumber) {
    if (nameContains(fileName, `찬송가${query.hymnNumber}장`)) return true;
    return new RegExp(`(^|[^0-9])${query.hymnNumber}([^0-9]|$)`).test(folded);
  }
  if (query.kind === "bible") {
    const book = bibleBook(query.scripture);
    if (book && nameContains(fileName, book)) return true;
    const key = scriptureKey(query.scripture).toLowerCase();
    return Boolean(key) && folded.includes(key);
  }
  const title = query.title.normalize("NFKC").replace(/\s+/g, "");
  return Boolean(title) && nameContains(fileName, title);
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
