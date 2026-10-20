import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const appleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apple");

function readProject(relative: string): string {
  return readFileSync(path.join(appleRoot, relative), "utf8");
}

describe("폰 패드 맥 껍데기", () => {
  it("한 프로젝트가 아이폰, 아이패드, 맥 카탈리스트를 가리킵니다", () => {
    const project = readProject("Modl.xcodeproj/project.pbxproj");
    const scheme = readProject("Modl.xcodeproj/xcshareddata/xcschemes/Modl.xcscheme");
    assert.match(project, /TARGETED_DEVICE_FAMILY = "1,2";/);
    assert.match(project, /SUPPORTS_MACCATALYST = YES;/);
    assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = "\$\(MODL_BUNDLE_ID\)";/);
    assert.match(project, /DEVELOPMENT_TEAM = "\$\(APPLE_TEAM_ID\)";/);
    assert.match(project, /productType = "com\.apple\.product-type\.application";/);
    assert.match(scheme, /BlueprintName = "Modl"/);
    assert.match(readProject("Modl/Info.plist"), /UISupportedInterfaceOrientations~ipad/);
  });

  it("서버 주소를 빌드에 적지 않고, 주소가 없으면 안내 문구가 있습니다", () => {
    const swiftFiles = readdirSync(path.join(appleRoot, "Modl")).filter((name) => name.endsWith(".swift"));
    assert.ok(swiftFiles.length >= 4);
    const swift = swiftFiles.map((name) => readProject(path.join("Modl", name))).join("\n");
    assert.match(swift, /서버 주소는 나중에 연결됩니다/);
    assert.match(swift, /UserDefaults/);
    assert.doesNotMatch(swift, /https?:\/\/[A-Za-z0-9]/);
    assert.doesNotMatch(swift, /trycloudflare/);
    assert.doesNotMatch(swift, /가지/);
    const signing = readProject("Config/Signing.xcconfig");
    assert.match(signing, /MODL_BUNDLE_ID =/);
    assert.doesNotMatch(signing, /MODL_BUNDLE_ID = \S+/);
    assert.doesNotMatch(signing, /APPLE_TEAM_ID = \S+/);
  });
});
