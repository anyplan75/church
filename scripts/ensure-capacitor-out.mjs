import { access, readFile } from "node:fs/promises";
import path from "node:path";

// Capacitor는 out/ 정적 HTML만 묶어야 한다. Next 개발 서버(RSC) 원문을
// 그대로 넣으면 시뮬레이터에 빈 화면이나 flight 텍스트가 보인다.
// (정적보내기 HTML 안의 self.__next_f 는 정상이다.)
const indexPath = path.join(process.cwd(), "out", "index.html");

try {
  await access(indexPath);
} catch {
  console.error(
    "out/index.html이 없습니다. STATIC_EXPORT=1 next build 로 정적보내기를 먼저 하세요.",
  );
  process.exit(1);
}

const html = await readFile(indexPath, "utf8");
const trimmed = html.trimStart();
const hasHtmlShell =
  /<!DOCTYPE\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
const looksLikeRawRsc =
  !hasHtmlShell &&
  (trimmed.startsWith("0:") ||
    trimmed.includes("text/x-component") ||
    trimmed.includes("$Sreact.fragment") ||
    /^[0-9]+:/.test(trimmed));

if (looksLikeRawRsc) {
  console.error(
    "out/index.html이 Next RSC 원문처럼 보입니다. server.url/라이브 리로드 없이 정적보내기(npm run build / mobile:build-web)로 다시 빌드하세요.",
  );
  process.exit(1);
}

if (!hasHtmlShell) {
  console.error("out/index.html이 HTML이 아닙니다. 정적보내기 결과를 확인하세요.");
  process.exit(1);
}

console.log("capacitor out/ 확인: index.html OK");
