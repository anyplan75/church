import JSZip from "jszip";
import type { AttendanceMark, Office, Person, PersonCategory } from "./types";
import { OFFICES, PERSON_CATEGORIES } from "./types";
import { isItemPhoto } from "./supplies";
import { categoryMembership } from "./simple";

export type PeopleRow = {
  row: number;
  photo: string;
  name: string;
  phone: string;
  category: PersonCategory;
  office: Office | "";
  address: string;
  email: string;
  memo: string;
};

export type PeopleOverlap = {
  row: number;
  name: string;
  phone: string;
  personId: string | null;
  matchRow: number | null;
};

const HEADERS: Record<string, keyof PeopleRow> = {
  사진: "photo",
  이름: "name",
  전화번호: "phone",
  전화: "phone",
  구분: "category",
  직분: "office",
  주소: "address",
  이메일: "email",
  메모: "memo",
};

export function personKey(name: string, phone: string): string {
  return `${name.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("ko")}\n${phone.replace(/\D/g, "")}`;
}

export function planPeopleImport(people: Person[], rows: PeopleRow[]): { fresh: PeopleRow[]; overlaps: PeopleOverlap[] } {
  const existing = new Map<string, string>();
  for (const person of people) {
    const key = personKey(person.name, person.phone);
    if (person.name.trim() && !existing.has(key)) existing.set(key, person.id);
  }
  const fresh: PeopleRow[] = [];
  const overlaps: PeopleOverlap[] = [];
  const fileRows = new Map<string, number>();
  for (const row of rows) {
    if (!row.name.trim()) continue;
    const key = personKey(row.name, row.phone);
    const personId = existing.get(key);
    if (personId) {
      overlaps.push({ row: row.row, name: row.name.trim(), phone: row.phone.trim(), personId, matchRow: null });
      continue;
    }
    const earlier = fileRows.get(key);
    if (earlier) {
      overlaps.push({ row: row.row, name: row.name.trim(), phone: row.phone.trim(), personId: null, matchRow: earlier });
      continue;
    }
    fileRows.set(key, row.row);
    fresh.push(row);
  }
  return { fresh, overlaps };
}

export function commitPeopleImport(
  people: Person[],
  attendance: AttendanceMark[],
  rows: PeopleRow[],
  choice: "skip" | "update",
): { people: Person[]; attendance: AttendanceMark[]; added: number; updated: number; skipped: number } {
  const plan = planPeopleImport(people, rows);
  const next = people.map((person) => ({ ...person }));
  let marks = attendance.slice();
  for (const row of plan.fresh) next.push(personFromRow(row));
  let updated = 0;
  let skipped = 0;
  for (const overlap of plan.overlaps) {
    const row = rows.find((item) => item.row === overlap.row);
    if (!row || !overlap.personId || choice === "skip") {
      skipped += 1;
      continue;
    }
    const person = next.find((item) => item.id === overlap.personId);
    if (!person) {
      skipped += 1;
      continue;
    }
    applyRow(person, row);
    if (person.membership !== "member") {
      person.attendanceConsent = false;
      marks = marks.filter((mark) => mark.personId !== person.id);
    }
    updated += 1;
  }
  return { people: next, attendance: marks, added: plan.fresh.length, updated, skipped };
}

export async function readPeopleFile(file: File): Promise<PeopleRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type.includes("csv") || name.endsWith(".txt")) {
    return rowsFromMatrix(parseCsv(await file.text()), new Map());
  }
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const matrix = await readXlsxMatrix(zip);
  const photos = await readXlsxPhotos(zip);
  return rowsFromMatrix(matrix, photos);
}

export function rowsFromMatrix(matrix: string[][], photos: Map<number, string>): PeopleRow[] {
  if (matrix.length === 0) return [];
  const header = headerMap(matrix[0]);
  const start = header ? 1 : 0;
  const columns = header ?? { photo: 0, name: 1, phone: 2, category: 3, office: 4, address: 5, email: 6, memo: 7 };
  const rows: PeopleRow[] = [];
  for (let index = start; index < matrix.length; index += 1) {
    const cells = matrix[index] ?? [];
    const name = cell(cells, columns.name).slice(0, 40);
    if (!name) continue;
    const photo = photos.get(index + 1) || cell(cells, columns.photo);
    rows.push({
      row: index + 1,
      photo,
      name,
      phone: cell(cells, columns.phone).slice(0, 30),
      category: categoryOf(cell(cells, columns.category)),
      office: officeOf(cell(cells, columns.office)),
      address: cell(cells, columns.address).slice(0, 120),
      email: cell(cells, columns.email).slice(0, 120),
      memo: cell(cells, columns.memo).slice(0, 400),
    });
  }
  return rows;
}

function personFromRow(row: PeopleRow): Person {
  const membership = categoryMembership(row.category);
  return {
    id: crypto.randomUUID(),
    name: row.name.trim().slice(0, 40),
    roles: row.office ? [row.office] : [],
    phone: row.phone.trim().slice(0, 30),
    active: true,
    membership,
    attendanceConsent: false,
    category: row.category,
    office: row.office,
    address: row.address.trim().slice(0, 120),
    email: row.email.trim().slice(0, 120),
    memo: row.memo.trim().slice(0, 400),
    photo: isItemPhoto(row.photo) ? row.photo : "",
  };
}

function applyRow(person: Person, row: PeopleRow) {
  const membership = categoryMembership(row.category);
  person.name = row.name.trim().slice(0, 40);
  person.phone = row.phone.trim().slice(0, 30);
  person.category = row.category;
  person.office = row.office;
  person.roles = row.office ? [row.office] : [];
  person.address = row.address.trim().slice(0, 120);
  person.email = row.email.trim().slice(0, 120);
  person.memo = row.memo.trim().slice(0, 400);
  person.membership = membership;
  person.active = true;
  if (isItemPhoto(row.photo)) person.photo = row.photo;
}

function categoryOf(value: string): PersonCategory {
  const found = PERSON_CATEGORIES.find((item) => item.id === value || item.label === value);
  return found?.id ?? "registered";
}

function officeOf(value: string): Office | "" {
  return OFFICES.find((office) => office === value) ?? "";
}

function cell(cells: string[], index: number | undefined): string {
  if (index === undefined || index < 0) return "";
  return String(cells[index] ?? "").trim();
}

function headerMap(row: string[]): Record<keyof Omit<PeopleRow, "row">, number> | null {
  const map = new Map<keyof PeopleRow, number>();
  row.forEach((value, index) => {
    const key = HEADERS[value.replace(/\s+/g, "")];
    if (key && !map.has(key)) map.set(key, index);
  });
  if (!map.has("name")) return null;
  return {
    photo: map.get("photo") ?? -1,
    name: map.get("name") ?? 1,
    phone: map.get("phone") ?? -1,
    category: map.get("category") ?? -1,
    office: map.get("office") ?? -1,
    address: map.get("address") ?? -1,
    email: map.get("email") ?? -1,
    memo: map.get("memo") ?? -1,
  };
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          value += '"';
          index += 1;
        } else quoted = false;
      } else value += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value.trim());
      value = "";
    } else if (char === "\n") {
      row.push(value.trim());
      if (row.some((cell) => cell)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value.trim());
  if (row.some((cell) => cell)) rows.push(row);
  return rows;
}

async function readXlsxMatrix(zip: JSZip): Promise<string[][]> {
  const shared = await zip.file("xl/sharedStrings.xml")?.async("string");
  const strings = shared ? readSharedStrings(shared) : [];
  const sheetName = Object.keys(zip.files).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const sheet = sheetName ? await zip.file(sheetName)?.async("string") : "";
  if (!sheet) return [];
  const rows: string[][] = [];
  for (const row of sheet.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const index = Number(row[1]) - 1;
    const cells: string[] = [];
    for (const cell of row[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = cell[1].match(/\br="([A-Z]+)\d+"/);
      const column = ref ? columnIndex(ref[1]) : cells.length;
      const type = cell[1].match(/\bt="([^"]+)"/)?.[1] ?? "";
      const raw = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? cell[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
      const text = decodeXml(type === "s" ? strings[Number(raw)] ?? "" : raw);
      while (cells.length < column) cells.push("");
      cells[column] = text;
    }
    rows[index] = cells;
  }
  return Array.from({ length: rows.length }, (_, index) => rows[index] ?? []);
}

async function readXlsxPhotos(zip: JSZip): Promise<Map<number, string>> {
  const photos = new Map<number, string>();
  const drawingName = Object.keys(zip.files).find((name) => /^xl\/drawings\/drawing\d+\.xml$/.test(name));
  if (!drawingName) return photos;
  const drawing = await zip.file(drawingName)?.async("string");
  const rels = await zip.file(drawingName.replace("drawings/", "drawings/_rels/") + ".rels")?.async("string");
  if (!drawing || !rels) return photos;
  const targets = new Map<string, string>();
  for (const rel of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    const target = rel[2].replace(/^\.\.\//, "xl/");
    targets.set(rel[1], target);
  }
  for (const anchor of drawing.matchAll(/<(?:\w+:)?twoCellAnchor[\s\S]*?<\/(?:\w+:)?twoCellAnchor>/g)) {
    const row = Number(anchor[0].match(/<(?:\w+:)?row>(\d+)<\/(?:\w+:)?row>/)?.[1] ?? "");
    const id = anchor[0].match(/\b(?:r:)?embed="([^"]+)"/)?.[1] ?? "";
    const target = targets.get(id);
    if (!target || !Number.isInteger(row)) continue;
    const file = zip.file(target);
    if (!file) continue;
    const bytes = await file.async("base64");
    const type = target.endsWith(".png") ? "image/png" : target.endsWith(".webp") ? "image/webp" : "image/jpeg";
    photos.set(row + 1, `data:${type};base64,${bytes}`);
  }
  return photos;
}

function readSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  for (const item of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const parts = [...item[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1]));
    strings.push(parts.join(""));
  }
  return strings;
}

function columnIndex(letters: string): number {
  return letters.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}
