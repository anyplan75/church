import { access, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Surge는 없는 경로에 200.html을 준다. Next 정적보내기의 404(not-found) 페이지가
// /services/:id/output 등을 클라이언트에서 열어 주므로 그대로 복사한다.
// CNAME 없이 surge ./out 만 하면 임의 서브도메인으로만 올라가 eunhye-church-app 은 비게 된다.
const SURGE_DOMAIN = "eunhye-church-app.surge.sh";
const directory = path.join(process.cwd(), "out");
const missing = path.join(directory, "404.html");
const fallback = path.join(directory, "200.html");

try {
  await access(missing);
} catch {
  process.exit(0);
}

await copyFile(missing, fallback);
await writeFile(path.join(directory, "CNAME"), `${SURGE_DOMAIN}\n`, "utf8");
console.log(`surge fallback: 404.html → 200.html, CNAME → ${SURGE_DOMAIN}`);
