import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function listFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...listFiles(full));
      continue;
    }
    if (full.endsWith(".ts") || full.endsWith(".tsx")) found.push(full);
  }
  return found;
}

describe("화면과 서버 경계", () => {
  it("화면 코드는 권한 모듈과 데이터베이스 꾸러미를 직접 부르지 않습니다", () => {
    const root = path.resolve("src");
    const files = [...listFiles(path.join(root, "app")), ...listFiles(path.join(root, "components"))];
    assert.ok(files.length > 0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(text, /server\/auth/);
      assert.doesNotMatch(text, /server\/db/);
      assert.doesNotMatch(text, /from ["']pg["']/);
      assert.doesNotMatch(text, /drizzle-orm/);
    }
  });

  it("로그인 화면에는 공동체 만들기와 등급 고르기가 없습니다", () => {
    const account = readFileSync(path.join(path.resolve("src"), "app/account/page.tsx"), "utf8");
    assert.doesNotMatch(account, /community\/new|create_community|planTier|field_role|사용 등급/);
    const church = readFileSync(path.join(path.resolve("src"), "app/signup/church/page.tsx"), "utf8");
    const form = readFileSync(path.join(path.resolve("src"), "components/signup-church-form.tsx"), "utf8");
    const together = `${church}\n${form}`;
    assert.match(together, /이 교회 선택/);
    assert.match(together, /목록에 없으면 직접 등록/);
    assert.match(together, /ChurchTagFilters/);
    assert.doesNotMatch(together, /planTier|field_role|사용 등급|name="region"|제주시|서귀포시/);
  });
});
