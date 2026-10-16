import { access, copyFile } from "node:fs/promises";
import path from "node:path";

const directory = path.join(process.cwd(), "out");
const missing = path.join(directory, "404.html");
const fallback = path.join(directory, "200.html");

try {
  await access(missing);
} catch {
  process.exit(0);
}

await copyFile(missing, fallback);
