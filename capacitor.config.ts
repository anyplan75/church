import type { CapacitorConfig } from "@capacitor/cli";

// webDir은 정적보내기 결과(out/)만 쓴다. .next 나 개발 서버를 가리키면 안 된다.
// server.url 절대 금지 — Next RSC 원문($Sreact.fragment)이 시뮬에 그대로 보인다.
const config: CapacitorConfig = {
  appId: "org.eunhye.worship.operator",
  appName: "은혜로운 예배 Remote",
  webDir: "out",
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
    cleartext: true,
    // url: 넣지 말 것
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

if ("url" in (config.server ?? {})) {
  throw new Error("capacitor.config: server.url 은 사용할 수 없습니다. webDir=out 정적 파일만 쓰세요.");
}

export default config;
