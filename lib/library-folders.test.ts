import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const library = require("../desktop/library-folders.cjs") as typeof import("../desktop/library-folders.cjs");

describe("라이브러리 폴더 userData 저장", () => {
  it("설치 폴더의 예전 경로를 userData 로 옮긴다", () => {
    const root = mkdtempSync(path.join(tmpdir(), "eunhye-lib-"));
    const userData = path.join(root, "userData");
    const install = path.join(root, "install");
    mkdirSync(userData, { recursive: true });
    mkdirSync(install, { recursive: true });
    writeFileSync(
      path.join(install, "library-folders.json"),
      JSON.stringify({ bible: "/Users/church/Bible", hymn: "C:/Hymns", praise: "" }),
      "utf8",
    );

    const folders = library.migrateLibraryFolders({
      userDataDir: userData,
      installDirs: [install],
      packaged: true,
    });

    assert.equal(folders.bible, "/Users/church/Bible");
    assert.equal(folders.hymn, "C:/Hymns");
    const store = JSON.parse(readFileSync(path.join(userData, "eunhye-desktop.json"), "utf8"));
    assert.equal(store.libraryFolders.bible, "/Users/church/Bible");
    assert.equal(existsSync(path.join(install, "library-folders.json")), false);

    rmSync(root, { recursive: true, force: true });
  });

  it("이미 userData 에 있으면 설치 폴더 값으로 덮어쓰지 않는다", () => {
    const root = mkdtempSync(path.join(tmpdir(), "eunhye-lib-"));
    const userData = path.join(root, "userData");
    const install = path.join(root, "install");
    mkdirSync(userData, { recursive: true });
    mkdirSync(install, { recursive: true });
    writeFileSync(
      path.join(userData, "eunhye-desktop.json"),
      JSON.stringify({ libraryFolders: { bible: "/keep/me", hymn: "", praise: "" } }),
      "utf8",
    );
    writeFileSync(path.join(install, "library-folders.json"), JSON.stringify({ bible: "/old/path", hymn: "/old/hymn" }), "utf8");

    const folders = library.migrateLibraryFolders({ userDataDir: userData, installDirs: [install] });
    assert.equal(folders.bible, "/keep/me");
    assert.equal(folders.hymn, "/old/hymn");

    rmSync(root, { recursive: true, force: true });
  });

  it("폴더 요약과 txt 읽기·쓰기를 한다", () => {
    const root = mkdtempSync(path.join(tmpdir(), "eunhye-lib-"));
    const folder = path.join(root, "찬양");
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, "은혜.txt"), "주께 감사하세", "utf8");

    const view = library.summarizeFolder(folder);
    assert.equal(view.state, "connected");
    assert.equal(view.folderName, "찬양");
    assert.equal(view.txtCount, 1);
    assert.deepEqual(view.names, ["은혜.txt"]);

    const bytes = library.readTxtFile(folder, "은혜.txt");
    assert.ok(bytes);
    assert.equal(Buffer.from(bytes!).toString("utf8"), "주께 감사하세");
    assert.equal(library.writeTxtFile(folder, "새노래.txt", "새 가사\n"), true);
    assert.equal(readFileSync(path.join(folder, "새노래.txt"), "utf8"), "새 가사\n");
    assert.equal(library.readTxtFile(folder, "../escape.txt"), null);

    rmSync(root, { recursive: true, force: true });
  });

  it("Mac 설치 후보에 앱 번들 옆 폴더를 넣는다", () => {
    const dirs = library.installDirCandidates({
      execPath: "/Applications/은혜로운 예배.app/Contents/MacOS/은혜로운 예배",
      platform: "darwin",
      cwd: "/tmp",
      packaged: true,
    });
    assert.ok(dirs.some((dir: string) => dir.includes("Applications")));
    assert.ok(dirs.some((dir: string) => dir.endsWith("은혜로운 예배.app") || dir.includes("MacOS")));
  });
});
