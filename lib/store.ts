import fs from "fs";
import path from "path";
import { buildSeed } from "./seed";
import type { Db } from "./types";

const file = path.join(process.cwd(), "data", "church.json");

function write(db: Db) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(db, null, 2));
  fs.renameSync(temporary, file);
}

export function readDb(): Db {
  if (!fs.existsSync(file)) {
    const db = buildSeed();
    write(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as Db;
}

export function updateDb(mutator: (db: Db) => void): Db {
  const db = readDb();
  mutator(db);
  write(db);
  return db;
}
