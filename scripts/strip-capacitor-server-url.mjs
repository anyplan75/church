import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

// cap sync / livereload가 남긴 server.url 을 제거한다.
// url이 Next 개발 서버를 가리키면 iOS에서 RSC 원문·빈 화면이 난다.
const candidates = [
  path.join(process.cwd(), "ios", "App", "App", "capacitor.config.json"),
  path.join(process.cwd(), "capacitor.config.json"),
];

let changed = 0;
for (const file of candidates) {
  try {
    await access(file);
  } catch {
    continue;
  }
  const raw = await readFile(file, "utf8");
  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    console.error(`JSON 파싱 실패: ${file}`);
    process.exit(1);
  }
  if (config?.server && "url" in config.server) {
    delete config.server.url;
    if (Object.keys(config.server).length === 0) {
      delete config.server;
    }
    await writeFile(file, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    console.log(`server.url 제거: ${file}`);
    changed += 1;
  }
}

if (changed === 0) {
  console.log("server.url 없음 (정상)");
}
