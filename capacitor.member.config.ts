import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 성도용 iOS 앱 설정.
 * 조작 Remote(`capacitor.config.ts`, org.eunhye.worship.operator)와 번들·이름을 분리합니다.
 * webDir은 정적보내기 결과(out/)만 씁니다. server.url 금지.
 */
const config: CapacitorConfig = {
  appId: "org.eunhye.worship.member",
  appName: "은혜로운 예배 성도",
  webDir: "out",
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
    cleartext: true,
  },
  ios: {
    // 조작용 ios/ 과 분리 — Capacitor가 이 경로만 읽고 쓴다.
    path: "ios-member",
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

if ("url" in (config.server ?? {})) {
  throw new Error("capacitor.member.config: server.url 은 사용할 수 없습니다. webDir=out 정적 파일만 쓰세요.");
}

export default config;
