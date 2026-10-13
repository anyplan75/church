import path from "path";

export function dataDir(): string {
  return process.env.CHURCH_DATA_DIR || path.join(process.cwd(), "data");
}
