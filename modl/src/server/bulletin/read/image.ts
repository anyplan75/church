/**
 * 사진 속 글을 읽습니다.
 * 은혜로운 예배의 lib/extract-image.ts 와 같이 tesseract 명령으로 한글을 읽습니다.
 * 명령이 없거나 글을 못 읽으면 그 안내만 던집니다. 문장을 만들지 않습니다.
 */

import { spawn, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const IMAGE_MISS = "이 컴퓨터에서는 사진 속 한글을 읽지 못합니다. 텍스트나 문서로 올려 주세요.";
const IMAGE_EMPTY = "사진에서 글을 읽지 못했습니다. 글자가 선명한 사진으로 올려 주세요.";
const IMAGE_SLOW = "사진에서 글을 읽는 데 너무 오래 걸립니다.";

let koreanImages: boolean | null = null;

function vendorRoot(): string | null {
  const bases = [process.cwd(), path.join(process.cwd(), "modl"), "/var/task"];
  for (const base of bases) {
    const root = path.join(base, "vendor", "tesseract");
    if (existsSync(path.join(root, "tesseract")) && existsSync(path.join(root, "tessdata", "kor.traineddata"))) {
      return root;
    }
  }
  return null;
}

function tesseractCommand(): { bin: string; args: string[] } {
  const root = vendorRoot();
  if (!root) return { bin: "tesseract", args: [] };
  const dest = "/tmp/modl-tesseract";
  const bin = path.join(dest, "tesseract");
  const tessdata = path.join(dest, "tessdata");
  if (!existsSync(bin)) {
    mkdirSync(tessdata, { recursive: true });
    copyFileSync(path.join(root, "tesseract"), bin);
    chmodSync(bin, 0o755);
    copyFileSync(path.join(root, "tessdata", "kor.traineddata"), path.join(tessdata, "kor.traineddata"));
  }
  return { bin, args: ["--tessdata-dir", tessdata] };
}

export function canReadKoreanImages(): boolean {
  if (koreanImages !== null) return koreanImages;
  try {
    const command = tesseractCommand();
    const result = spawnSync(command.bin, [...command.args, "--list-langs"], { encoding: "utf8", timeout: 4000 });
    koreanImages = result.status === 0 && /(^|\n)kor(\n|$)/.test(result.stdout ?? "");
  } catch {
    koreanImages = false;
  }
  return koreanImages;
}

export async function readBulletinImage(bytes: Buffer): Promise<string> {
  if (!canReadKoreanImages()) throw new Error(IMAGE_MISS);
  const text = (await readWithTesseract(bytes)).replace(/\f/g, "\n").replace(/\r/g, "").trim();
  if (!text) throw new Error(IMAGE_EMPTY);
  return text;
}

function readWithTesseract(data: Buffer): Promise<string> {
  const command = tesseractCommand();
  return new Promise((resolve, reject) => {
    const child = spawn(command.bin, [...command.args, "stdin", "stdout", "-l", "kor", "--psm", "6"], {
      cwd: "/tmp",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      run();
    };
    timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error(IMAGE_SLOW)));
    }, 20000);
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", () => {});
    child.stdin.on("error", () => finish(() => reject(new Error(IMAGE_MISS))));
    child.on("error", () => finish(() => reject(new Error(IMAGE_MISS))));
    child.on("close", (code) => {
      finish(() => {
        if (code !== 0) {
          reject(new Error(IMAGE_EMPTY));
          return;
        }
        resolve(Buffer.concat(out).toString("utf8"));
      });
    });
    child.stdin.write(data);
    child.stdin.end();
  });
}
