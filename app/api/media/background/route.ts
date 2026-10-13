import fs from "fs";
import path from "path";
import { denyApi } from "@/lib/guard";
import { readDb } from "@/lib/store";

export async function GET() {
  const denied = await denyApi(["screen.output", "screen.settings"]);
  if (denied) return denied;
  const filename = readDb().settings.backgroundFile;
  if (!filename) return new Response(null, { status: 404 });
  const safe = path.basename(filename);
  const directory = path.join(process.cwd(), "data", "backgrounds");
  const full = path.join(directory, safe);
  if (!full.startsWith(directory) || !fs.existsSync(full)) return new Response(null, { status: 404 });
  const data = fs.readFileSync(full);
  const ext = path.extname(safe).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return new Response(data, { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
}
