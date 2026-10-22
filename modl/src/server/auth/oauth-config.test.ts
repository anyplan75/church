import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { GUEST_HOME_NOTICE } from "@/components/guest-notice";
import {
  KAKAO_REDIRECT_URI,
  NAVER_REDIRECT_URI,
  kakaoAuthorizeUrl,
  naverAuthorizeUrl,
  parseKakaoProfile,
  parseNaverProfile,
} from "@/server/auth/oauth-config";

const ENV_KEYS = ["KAKAO_REST_API_KEY", "KAKAO_CLIENT_SECRET", "NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"] as const;
const previous = new Map<string, string | undefined>();

function rememberEnv() {
  for (const key of ENV_KEYS) previous.set(key, process.env[key]);
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("간편 로그인 주소", () => {
  afterEach(() => restoreEnv());

  it("콜백은 지정한 두 주소만 씁니다", () => {
    assert.equal(KAKAO_REDIRECT_URI, "https://modl-jeju.vercel.app/api/auth/callback/kakao");
    assert.equal(NAVER_REDIRECT_URI, "https://modl-jeju.vercel.app/api/auth/callback/naver");
  });

  it("열쇠가 없으면 로그인 주소를 만들지 않습니다", () => {
    rememberEnv();
    for (const key of ENV_KEYS) delete process.env[key];
    assert.equal(kakaoAuthorizeUrl("state"), null);
    assert.equal(naverAuthorizeUrl("state"), null);
  });

  it("공식 로그인 주소에 고정 콜백만 붙입니다", () => {
    rememberEnv();
    process.env.KAKAO_REST_API_KEY = "unit-test-kakao";
    process.env.NAVER_CLIENT_ID = "unit-test-naver";
    process.env.NAVER_CLIENT_SECRET = "unit-test-naver-secret";
    const kakao = new URL(kakaoAuthorizeUrl("abc") ?? "");
    assert.equal(`${kakao.origin}${kakao.pathname}`, "https://kauth.kakao.com/oauth/authorize");
    assert.equal(kakao.searchParams.get("redirect_uri"), KAKAO_REDIRECT_URI);
    const naver = new URL(naverAuthorizeUrl("abc") ?? "");
    assert.equal(`${naver.origin}${naver.pathname}`, "https://nid.naver.com/oauth2.0/authorize");
    assert.equal(naver.searchParams.get("redirect_uri"), NAVER_REDIRECT_URI);
  });

  it("프로필에서 제공자 번호만 읽습니다", () => {
    const kakao = parseKakaoProfile({ id: 12, kakao_account: { profile: { nickname: "하나" }, email: "a@b.c" } });
    assert.equal(kakao?.providerUserId, "12");
    assert.equal(kakao?.name, "하나");
    assert.equal(parseKakaoProfile({}), null);
    const naver = parseNaverProfile({ resultcode: "00", response: { id: "n1", nickname: "둘" } });
    assert.equal(naver?.providerUserId, "n1");
    assert.equal(naver?.name, "둘");
    assert.equal(parseNaverProfile({ resultcode: "024" }), null);
  });
});

describe("첫 화면 안내", () => {
  it("로그인하지 않았을 때 보여 주는 문장을 그대로 둡니다", () => {
    assert.equal(
      GUEST_HOME_NOTICE,
      "로그인하면 모바일주보와 일정관리, 재정관리 등 여러가지 기능을 사용할 수 있습니다.",
    );
  });
});
