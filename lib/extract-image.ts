import { spawn, spawnSync } from "child_process";

const IMAGE_MISS = "이 컴퓨터에서는 사진 속 한글을 읽지 못합니다. 텍스트나 문서로 올려 주세요.";
const IMAGE_EMPTY = "사진에서 글을 읽지 못했습니다. 글자가 선명한 사진으로 올려 주세요.";

let koreanImages: boolean | null = null;

export function canReadKoreanImages(): boolean {
  if (koreanImages !== null) return koreanImages;
  try {
    const result = spawnSync("tesseract", ["--list-langs"], { encoding: "utf8", timeout: 4000 });
    koreanImages = result.status === 0 && /(^|\n)kor(\n|$)/.test(result.stdout ?? "");
  } catch {
    koreanImages = false;
  }
  return koreanImages;
}

export async function extractImage(data: Buffer): Promise<string> {
  if (!canReadKoreanImages()) throw new Error(IMAGE_MISS);
  const text = (await readWithTesseract(data)).replace(/\f/g, "\n").replace(/\r/g, "").trim();
  if (!text) throw new Error(IMAGE_EMPTY);
  return text;
}

function readWithTesseract(data: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("tesseract", ["stdin", "stdout", "-l", "kor", "--psm", "6"], { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("사진에서 글을 읽는 데 너무 오래 걸립니다."));
    }, 20000);
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error(IMAGE_MISS));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(IMAGE_EMPTY));
        return;
      }
      resolve(Buffer.concat(out).toString("utf8"));
    });
    child.stdin.write(data);
    child.stdin.end();
  });
}
