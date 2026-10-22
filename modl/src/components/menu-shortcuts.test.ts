import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveMenuShortcut } from "@/components/menu-shortcuts";
import { MENU_ITEMS } from "@/theme/menus";
import { TERM_DICTIONARY } from "@/theme/dictionary";

describe("메뉴 이동 글자", () => {
  it("g 다음에 h 를 누르면 첫 화면으로 갑니다", () => {
    assert.equal(resolveMenuShortcut("g", "h"), "/");
  });

  it("메뉴마다 서로 다른 둘째 글자가 있습니다", () => {
    const keys = MENU_ITEMS.map((item) => item.key).sort();
    const dictionaryKeys = Object.keys(TERM_DICTIONARY.menus).sort();
    assert.deepEqual(keys, dictionaryKeys);
    const shortcuts = MENU_ITEMS.map((item) => item.shortcut);
    assert.equal(new Set(shortcuts).size, shortcuts.length);
    assert.equal(new Set<string>(shortcuts).has("h"), false);
  });

  it("g 와 메뉴 글자로 그 메뉴 주소가 나옵니다", () => {
    for (const item of MENU_ITEMS) {
      assert.equal(resolveMenuShortcut("g", item.shortcut), `/${item.key}`);
      assert.equal(resolveMenuShortcut("G", item.shortcut.toUpperCase()), `/${item.key}`);
    }
  });

  it("g 가 아니면 이동하지 않습니다", () => {
    assert.equal(resolveMenuShortcut("b", "b"), null);
    assert.equal(resolveMenuShortcut("g", "z"), null);
  });
});
