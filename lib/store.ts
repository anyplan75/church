import fs from "fs";
import path from "path";
import { isOverlayPosition, normalizeDb } from "./db-shape";
import { buildSeed } from "./seed";
import type { Db } from "./types";

const file = path.join(process.cwd(), "data", "church.json");

function write(db: Db) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = JSON.stringify(db, null, 2);
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === body) return;
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, body);
  fs.renameSync(temporary, file);
}

export function readDb(): Db {
  if (!fs.existsSync(file)) {
    const db = buildSeed();
    write(db);
    return db;
  }
  return normalizeDb(JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Db>);
}

export function updateDb(mutator: (db: Db) => void): Db {
  const db = readDb();
  mutator(db);
  const next = JSON.stringify(db, null, 2);
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== next) write(db);
  return db;
}

export { isOverlayPosition };
