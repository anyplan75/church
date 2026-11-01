function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}


type Cell = { row: number; col: number; colSpan: number; text: string };
type HeaderKind = "pair" | "praise" | "wednesday" | "dawn";

function decodeHwpText(buf: Buffer): string {
  let text = "";
  let index = 0;
  while (index + 1 < buf.length) {
    const code = buf.readUInt16LE(index);
    if (code < 32) {
      if (code === 9 || code === 30 || code === 31) {
        text += " ";
        index += 2;
        continue;
      }
      if (code === 10 || code === 13) {
        text += "\n";
        index += 2;
        continue;
      }
      if (code === 0 || code >= 24) {
        index += 2;
        continue;
      }
      index += 16;
      continue;
    }
    text += String.fromCharCode(code);
    index += 2;
  }
  return text.replace(/\n+$/g, "").trim();
}

const CTRL_HEADER = 71;
const LIST_HEADER = 72;
const PARA_TEXT = 67;

export function worshipLinesFromHwpBody(body: Buffer): string {
  const tables = readTables(body);
  const issue = findIssueDate(tables);
  const lines = tables.flatMap((table) => linesFromTable(table, issue));
  const news = newsFromTables(tables);
  if (news.length > 0) {
    lines.push("교회소식");
    for (const item of news) lines.push(`- ${item}`);
  }
  const text = lines.map((line) => line.trim()).filter(Boolean).join("\n").trim();
  if (!/예배|기도회/.test(text)) return "";
  return text;
}

function readTables(body: Buffer): Cell[][] {
  const records = readRecords(body);
  const tables: Cell[][] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.tag !== CTRL_HEADER || record.size < 4) continue;
    const id = record.payload.subarray(0, 4).toString("latin1").split("").reverse().join("");
    if (id !== "tbl ") continue;
    const cells: Cell[] = [];
    let current: Cell | null = null;
    for (let childIndex = index + 1; childIndex < records.length && records[childIndex].level > record.level; childIndex += 1) {
      const child = records[childIndex];
      if (child.tag === LIST_HEADER && child.level === record.level + 1 && child.size >= 16) {
        if (current?.text) cells.push(current);
        current = {
          row: child.payload.readUInt16LE(10),
          col: child.payload.readUInt16LE(8),
          colSpan: Math.max(1, child.payload.readUInt16LE(12)),
          text: "",
        };
      }
      if (child.tag === PARA_TEXT && current) {
        const text = decodeHwpText(child.payload).replace(/[^\S\n]+/g, " ").trim();
        if (text) current.text = current.text ? `${current.text}\n${text}` : text;
      }
    }
    if (current?.text) cells.push(current);
    if (cells.length > 0) tables.push(cells);
  }
  return tables;
}

function readRecords(body: Buffer): Array<{ tag: number; level: number; size: number; payload: Buffer }> {
  const records: Array<{ tag: number; level: number; size: number; payload: Buffer }> = [];
  let offset = 0;
  while (offset + 4 <= body.length) {
    const value = body.readUInt32LE(offset);
    const tag = value & 0x3ff;
    const level = (value >> 10) & 0x3ff;
    let size = (value >> 20) & 0xfff;
    offset += 4;
    if (size === 4095) {
      if (offset + 4 > body.length) break;
      size = body.readUInt32LE(offset);
      offset += 4;
    }
    if (offset + size > body.length) break;
    records.push({ tag, level, size, payload: body.subarray(offset, offset + size) });
    offset += size;
  }
  return records;
}

function findIssueDate(tables: Cell[][]): string {
  for (const table of tables) {
    for (const cell of table) {
      const year = cell.text.match(/(\d{4})\s*-\s*\d+\s*호/);
      const day = cell.text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
      if (!year || !day) continue;
      const iso = isoDate(Number(year[1]), Number(day[1]), Number(day[2]));
      if (iso) return iso;
    }
  }
  return "";
}

function linesFromTable(table: Cell[], issue: string): string[] {
  const headers = table
    .map((cell) => ({ cell, kind: headerKind(cell.text) }))
    .filter((entry): entry is { cell: Cell; kind: HeaderKind } => entry.kind !== null);
  const rows = [...new Set(headers.map((entry) => entry.cell.row))].sort((left, right) => left - right);
  const lines: string[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const nextRow = rows[index + 1] ?? Number.POSITIVE_INFINITY;
    const rowHeaders = headers.filter((entry) => entry.cell.row === row).sort((left, right) => left.cell.col - right.cell.col);
    if (rowHeaders.some((entry) => entry.kind === "dawn")) {
      lines.push(...dawnLines(table, rowHeaders.find((entry) => entry.kind === "dawn")!.cell, nextRow, issue));
      continue;
    }
    if (rowHeaders.some((entry) => entry.kind === "pair")) {
      lines.push(...sundayLines(table, rowHeaders.find((entry) => entry.kind === "pair")!.cell, nextRow, issue));
      continue;
    }
    lines.push(...sideLines(table, rowHeaders, nextRow, issue));
  }
  return lines;
}

function sideLines(table: Cell[], headers: Array<{ cell: Cell; kind: HeaderKind }>, nextRow: number, issue: string): string[] {
  const lines: string[] = [];
  const wednesday = wednesdayDate(table, issue);
  const groups = headers.map(() => new Map<number, Cell[]>());
  const body = table.filter((cell) => cell.row > headers[0].cell.row && cell.row < nextRow);
  for (const cell of body) {
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    headers.forEach((header, index) => {
      const gap = Math.abs(cell.col - header.cell.col);
      if (gap < distance) {
        nearest = index;
        distance = gap;
      }
    });
    const row = groups[nearest].get(cell.row) ?? [];
    row.push(cell);
    groups[nearest].set(cell.row, row);
  }
  headers.forEach((header, index) => {
    const date = header.kind === "wednesday" ? wednesday || issue : issue;
    const itemLines: string[] = [];
    for (const row of [...groups[index].keys()].sort((left, right) => left - right)) {
      const parts = groups[index].get(row)!.sort((left, right) => left.col - right.col);
      const item = formatItem(parts[0].text, parts.slice(1).map((cell) => cell.text).join(" "));
      if (item) itemLines.push(item);
    }
    if (itemLines.length === 0) return;
    if (date) lines.push(koreanDate(date));
    lines.push(serviceHeading(header.cell.text, header.kind));
    lines.push(...itemLines);
  });
  return lines;
}

function sundayLines(table: Cell[], header: Cell, nextRow: number, issue: string): string[] {
  const parts = [...header.text.matchAll(/([1-3])\s*부\s*[（(]\s*(오전|오후)\s*(\d{1,2})\s*(?:[:시]\s*(\d{1,2}))?/g)];
  if (parts.length === 0) return [];
  const edge = header.col + header.colSpan;
  const leader = header.text.match(/인도(?:\s*및\s*말씀)?\s*[:：]?\s*(.+)$/)?.[1]?.trim() ?? "";
  const rows = [...new Set(table.filter((cell) => cell.row > header.row && cell.row < nextRow && cell.col >= header.col && cell.col < edge).map((cell) => cell.row))].sort((a, b) => a - b);
  const steps: Array<{ shared: string | null; parts: Map<string, string> }> = [];
  for (const row of rows) {
    const cells = table.filter((cell) => cell.row === row && cell.col >= header.col && cell.col < edge).sort((left, right) => left.col - right.col);
    if (cells.length === 0) continue;
    const label = cells[0].text;
    const value = cells.slice(1).map((cell) => cell.text).join(" ");
    const split = splitParts(value);
    if (split.size > 0) {
      const formatted = new Map<string, string>();
      for (const [part, detail] of split) {
        const item = formatItem(label, detail);
        if (item) formatted.set(part, item);
      }
      if (formatted.size > 0) steps.push({ shared: null, parts: formatted });
      continue;
    }
    const item = formatItem(label, value);
    if (item) steps.push({ shared: item, parts: new Map() });
  }
  const lines: string[] = [];
  for (const part of parts) {
    const clock = clockFrom(part[2], part[3]);
    if (issue) lines.push(koreanDate(issue));
    lines.push(`${part[1]}부 예배 ${part[2]} ${clock}`);
    if (leader) lines.push(`인도 ${normalizeRoles(leader)}`);
    for (const step of steps) {
      const own = step.parts.get(part[1]);
      if (own) lines.push(own);
      else if (step.shared) lines.push(step.shared);
    }
  }
  return lines;
}

function dawnLines(table: Cell[], header: Cell, nextRow: number, issue: string): string[] {
  const rows = [...new Set(table.filter((cell) => cell.row > header.row && cell.row < nextRow).map((cell) => cell.row))].sort((left, right) => left - right);
  const dateRow = rows.find((row) => table.filter((cell) => cell.row === row && slashDate(cell.text, issue)).length >= 2);
  if (dateRow === undefined) return [];
  const dates = table.filter((cell) => cell.row === dateRow && slashDate(cell.text, issue)).sort((left, right) => left.col - right.col);
  const following = rows.filter((row) => row > dateRow);
  const hymnRow = following.find((row) => aligned(table, row, dates).filter((cell) => /\d+\s*장/.test(cell.text)).length >= 2);
  const passageRow = following.find((row) => row !== hymnRow && aligned(table, row, dates).filter((cell) => looksLikePassage(cell.text)).length >= 2);
  const time = header.text.match(/(\d{1,2})\s*:\s*(\d{2})/);
  const clock = time ? `${time[1].padStart(2, "0")}:${time[2]}` : "05:30";
  const lines: string[] = [];
  for (const dateCell of dates) {
    const iso = slashDate(dateCell.text, issue);
    if (!iso) continue;
    lines.push(koreanDate(iso));
    lines.push(`새벽기도회 오전 ${clock}`);
    const hymn = hymnRow === undefined ? undefined : table.find((cell) => cell.row === hymnRow && cell.col === dateCell.col);
    const passage = passageRow === undefined ? undefined : table.find((cell) => cell.row === passageRow && cell.col === dateCell.col);
    if (hymn) lines.push(`찬송 ${hymn.text}`);
    if (passage) lines.push(`성경봉독 ${stripPage(passage.text)}`);
  }
  return lines;
}

function aligned(table: Cell[], row: number, dates: Cell[]): Cell[] {
  return dates.map((date) => table.find((cell) => cell.row === row && cell.col === date.col)).filter((cell): cell is Cell => Boolean(cell));
}

function wednesdayDate(table: Cell[], issue: string): string {
  const dates = table.map((cell) => slashDate(cell.text, issue)).filter(Boolean);
  return dates.find((iso) => utcWeekday(iso) === 3) ?? "";
}

function serviceHeading(text: string, kind: HeaderKind): string {
  if (kind === "praise") return `주일찬양예배 ${dayHalf(text)} ${clockOn(text, "14:00")}`.replace(/\s+/g, " ").trim();
  if (kind === "wednesday") return `수요기도회 ${dayHalf(text)} ${clockOn(text, "19:00")}`.replace(/\s+/g, " ").trim();
  return text;
}

function dayHalf(text: string): string {
  if (text.includes("오후") || text.includes("저녁")) return "오후";
  if (text.includes("오전") || text.includes("새벽")) return "오전";
  return "";
}

function clockOn(text: string, fallback: string): string {
  const ampm = text.match(/(오전|오후|저녁)\s*(\d{1,2})\s*(?:[:시]\s*(\d{1,2}))?/);
  if (ampm) return clockFrom(ampm[1] === "오전" ? "오전" : "오후", ampm[2], ampm[3]);
  const clock = text.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!clock) return fallback;
  return `${clock[1].padStart(2, "0")}:${clock[2]}`;
}

function clockFrom(half: string, hourText: string, minuteText?: string): string {
  let hour = Number(hourText);
  const minute = Number(minuteText ?? 0);
  if (half === "오후" && hour < 12) hour += 12;
  if (half === "오전" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function headerKind(text: string): HeaderKind | null {
  const compact = text.replace(/\s+/g, "");
  if (!compact || compact.length > 48) return null;
  if (/1부/.test(compact) && /2부/.test(compact) && /오전|오후/.test(compact)) return "pair";
  if (/주일찬양예배/.test(compact) && /오전|오후|\d{1,2}:\d{2}/.test(text)) return "praise";
  if (/수요(?:기도회|예배)/.test(compact) && /오전|오후|저녁|\d{1,2}:\d{2}/.test(text)) return "wednesday";
  if (compact.includes("새벽기도회")) return "dawn";
  return null;
}

export function worshipItemLine(label: string, value: string): string | null {
  return formatItem(label, value);
}

function formatItem(label: string, value: string): string | null {
  const name = label.replace(/^\*\s*/, "").replace(/\s+/g, "");
  const detail = normalizeRoles(stripPage(value)).replace(/\s+/g, " ").trim();
  if (!name) return null;
  if (/^인도/.test(label.replace(/^\*\s*/, "").trim())) {
    const rest = detail || label.replace(/^\*\s*/, "").replace(/^인도(?:\s*및\s*말씀)?\s*[:：]?\s*/, "").trim();
    return rest ? `인도 ${normalizeRoles(rest)}` : null;
  }
  if (/신앙고백|사도신경/.test(name)) return "사도신경";
  if (/찬송/.test(name) || /^\d+\s*장/.test(detail)) return `찬송 ${detail || name}`.trim();
  if (/찬양|경배/.test(name)) return detail ? `찬양 ${detail}` : "찬양";
  if (/대표기도/.test(name)) return detail ? `대표기도 ${detail}` : "대표기도";
  if (/^기도/.test(name)) return detail ? `기도 ${detail}` : "기도";
  if (/성경|봉독|부름/.test(name)) return detail ? `성경봉독 ${detail}` : null;
  if (/설교|말씀/.test(name)) return detail ? `설교 ${detail}` : "설교";
  if (/봉헌/.test(name)) return detail && /^\d+\s*장/.test(detail) ? `봉헌\n찬송 ${detail}` : detail ? `봉헌 ${detail}` : "봉헌";
  if (/축도/.test(name)) return detail ? `축도 ${detail}` : "축도";
  if (/^(광고|교회소식)/.test(name)) {
    if (/\d{2,4}[-\s.]?\d{3,4}[-\s.]?\d{4}/.test(detail)) return null;
    return detail ? `광고 ${detail}` : "광고";
  }
  return null;
}

function splitParts(value: string): Map<string, string> {
  const match = value.replace(/\s+/g, " ").trim().match(/1\s*부\s+(.+?)\s+2\s*부\s+(.+)$/);
  const parts = new Map<string, string>();
  if (!match) return parts;
  parts.set("1", match[1].trim());
  parts.set("2", match[2].trim());
  return parts;
}

function normalizeRoles(text: string): string {
  return text.replace(/담임목사/g, "목사").replace(/원로목사/g, "목사").replace(/기관목사/g, "목사").replace(/교육목사/g, "목사");
}

function stripPage(value: string): string {
  return value.replace(/[（(]\s*(?:구약|신약)?\s*\d+\s*면\s*[)）]/g, " ");
}

function looksLikePassage(text: string): boolean {
  return /[가-힣]/.test(text) && /\d/.test(text) && !/\d+\s*장\s*$/.test(text.trim());
}

function slashDate(text: string, issue: string): string {
  const match = text.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!match) return "";
  let year = issue ? Number(issue.slice(0, 4)) : new Date().getFullYear();
  const month = Number(match[1]);
  if (issue) {
    const issueMonth = Number(issue.slice(5, 7));
    if (month + 6 < issueMonth) year += 1;
  }
  return isoDate(year, month, Number(match[2]));
}

function koreanDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function isoDate(year: number, month: number, day: number): string {
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isISODate(iso) ? iso : "";
}

function utcWeekday(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const NEWS_COLUMN = new Set(["연번", "등록일", "이름", "성별", "인도자", "기관", "구역"]);

export function newsFromTables(tables: Cell[][]): string[] {
  const candidates = tables.filter((table) => !isOrderTable(table) && !isOverviewTable(table) && table.some((cell) => /^[✜❏]/.test(cell.text.trim())));
  if (candidates.length === 0) return [];
  const best = candidates.slice().sort((left, right) => newsScore(right) - newsScore(left))[0];
  return bulletsFromCells(best.map((cell) => cell.text).filter((text) => !text.trim().startsWith("<")));
}

function isOverviewTable(table: Cell[]): boolean {
  return table.some((cell) => /주일찬양예배/.test(cell.text) && /교회소식|새벽기도회/.test(cell.text));
}

function isOrderTable(table: Cell[]): boolean {
  return table.some((cell) => {
    if (headerKind(cell.text)) return true;
    const compact = cell.text.replace(/\s+/g, "");
    return compact.length <= 40 && /주일찬양예배|새벽기도회|수요기도회/.test(compact);
  });
}

function newsScore(table: Cell[]): number {
  return table.reduce((sum, cell) => sum + (cell.text.match(/[✜❏]/g)?.length ?? 0), 0);
}

export function bulletsFromCells(texts: string[]): string[] {
  const chunks: string[] = [];
  for (const text of texts) {
    const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
    let current = "";
    const flush = () => {
      pushChunk(chunks, current);
      current = "";
    };
    for (const line of lines) {
      if (isSensitiveLine(line) || isScriptureQuote(line) || NEWS_COLUMN.has(line.replace(/\s+/g, ""))) continue;
      if (startsNewsItem(line) && current) flush();
      current = current ? `${current} ${line}` : line;
    }
    flush();
  }
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    const key = chunk.replace(/\s+/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pushChunk(chunks: string[], value: string) {
  let rest = value.replace(/\s+/g, " ").trim();
  while (rest.length > 500) {
    let cut = rest.lastIndexOf(" ", 500);
    if (cut < 200) cut = 500;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length >= 2) chunks.push(rest);
}

function isScriptureQuote(text: string): boolean {
  const clean = text.replace(/\s+/g, " ").trim();
  return !/[✜❏•]/.test(clean) && /[가-힣]\s*\d+\s*:\s*\d+/.test(clean) && clean.length < 180;
}

function startsNewsItem(line: string): boolean {
  return /^[✜❏•▪●]/.test(line) || /^\d+\s*[.)]/.test(line);
}

function isSensitiveLine(text: string): boolean {
  return /\d{2,4}[)\-\s.]?\d{3,4}[-\s.]\d{4}/.test(text) || /TEL|FAX|전화|계좌/i.test(text);
}
