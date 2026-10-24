/**
 * 배포 함수 안에 은혜로운 예배와 같은 tesseract 명령을 넣습니다.
 * 이미 있으면 다시 받지 않습니다.
 */

import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "vendor", "tesseract");
const binary = path.join(root, "tesseract");
const trained = path.join(root, "tessdata", "kor.traineddata");
const binaryUrl = "https://github.com/DanielMYT/tesseract-static/releases/download/tesseract-5.5.3-rebuild/tesseract.x86_64";
const trainedUrl = "https://github.com/tesseract-ocr/tessdata_fast/raw/main/kor.traineddata";

async function download(url, file) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`tesseract 파일을 받지 못했습니다. ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000) throw new Error("tesseract 파일이 너무 짧습니다.");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

const { existsSync } = await import("node:fs");
if (!existsSync(binary)) await download(binaryUrl, binary);
if (!existsSync(trained)) await download(trainedUrl, trained);
await chmod(binary, 0o755);
console.log("tesseract ready");
