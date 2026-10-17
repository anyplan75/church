import { spawnSync } from "node:child_process";

// Capacitor·데스크톱·Surge는 항상 out/ 정적보내기만 쓴다.
// NEXT_SERVER=1 은 start:server 전용. 그 밖에서는 STATIC_EXPORT를 강제로 켠다.
if (process.env.NEXT_SERVER === "1") {
  console.error("run-static-export: NEXT_SERVER=1 에서는 쓸 수 없습니다. npm run start:server 를 쓰세요.");
  process.exit(1);
}

const env = { ...process.env, STATIC_EXPORT: "1", NEXT_SERVER: "0" };
const result = spawnSync("npx", ["next", "build"], { stdio: "inherit", env, shell: process.platform === "win32" });
process.exit(result.status ?? 1);
