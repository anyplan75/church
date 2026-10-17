import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.eunhye.worship.operator",
  appName: "은혜로운 예배 조작",
  webDir: "out",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

export default config;
