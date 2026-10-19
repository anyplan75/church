import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  isMobileMemberApp,
  isMobileOperatorApp,
  isNativeShell,
  MEMBER_APP_ID,
  nativeAppId,
  OPERATOR_APP_ID,
} from "./mobile-app";

type StubWindow = {
  __EUNHYE_APP_ID__?: string;
  Capacitor?: { isNativePlatform?: () => boolean; config?: { appId?: string } };
};

function stubShell(opts: { appId?: string; capacitorNative?: boolean; configAppId?: string }) {
  const metaContent = opts.appId || "";
  const meta = metaContent ? { getAttribute: () => metaContent } : null;
  // @ts-expect-error test stub
  globalThis.document = {
    querySelector: (sel: string) => (sel.includes("eunhye-app-id") ? meta : null),
  };
  const win: StubWindow = {};
  if (opts.appId) win.__EUNHYE_APP_ID__ = opts.appId;
  if (opts.capacitorNative || opts.configAppId) {
    win.Capacitor = {
      isNativePlatform: () => Boolean(opts.capacitorNative),
      config: opts.configAppId ? { appId: opts.configAppId } : undefined,
    };
  }
  // @ts-expect-error test stub
  globalThis.window = win;
}

describe("mobile-app shell detection", () => {
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
    // @ts-expect-error test cleanup
    delete globalThis.document;
  });

  it("appId 메타만으로 성도 셸을 알아챕니다(Capacitor 브리지 없음)", () => {
    stubShell({ appId: MEMBER_APP_ID });
    assert.equal(nativeAppId(), MEMBER_APP_ID);
    assert.equal(isNativeShell(), true);
    assert.equal(isMobileMemberApp(), true);
    assert.equal(isMobileOperatorApp(), false);
  });

  it("조작 appId면 조작 셸로 봅니다", () => {
    stubShell({ appId: OPERATOR_APP_ID });
    assert.equal(isNativeShell(), true);
    assert.equal(isMobileMemberApp(), false);
    assert.equal(isMobileOperatorApp(), true);
  });

  it("appId 없는 구형 Capacitor는 조작으로 봅니다", () => {
    stubShell({ capacitorNative: true });
    assert.equal(isNativeShell(), true);
    assert.equal(isMobileMemberApp(), false);
    assert.equal(isMobileOperatorApp(), true);
  });

  it("웹(윈도우만)에서는 네이티브 셸이 아닙니다", () => {
    // @ts-expect-error test stub
    globalThis.document = { querySelector: () => null };
    // @ts-expect-error test stub
    globalThis.window = {};
    assert.equal(nativeAppId(), "");
    assert.equal(isNativeShell(), false);
    assert.equal(isMobileMemberApp(), false);
    assert.equal(isMobileOperatorApp(), false);
  });
});
