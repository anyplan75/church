import type { CapacitorConfig } from "@capacitor/cli";

// webDir은 STATIC_EXPORT=1 next build 결과(out/)만 쓴다.
// server.url 을 넣지 않는다. Next 개발/RSC 서버를 가리키면
// iPhone·iPad 시뮬레이터에 빈 화면이나 RSC 원문이 보인다.
const config: CapacitorConfig = {
  appId: "org.eunhye.worship.operator",
  appName: "은혜로운 예배 조작",
  webDir: "out",
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
    cleartext: true,
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

export default config;
