/**
 * 기간에 해당하는 영수증만 압축에 들어가는지 확인합니다.
 * 사진이 없으면 빈 압축을 만들지 않습니다.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { receiptsInRange } from "@/finance/rules";
import { zipReceiptFiles } from "@/server/finance/zip";

const INSIDE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const OUTSIDE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("기간 압축", () => {
  it("시작일과 종료일 사이 영수증만 압축에 넣습니다", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "modl-zip-"));
    const insideName = "phase6-inside.png";
    const outsideName = "phase6-outside.png";
    const publicDir = path.join(process.cwd(), "public");
    const insidePath = path.join(publicDir, insideName);
    const outsidePath = path.join(publicDir, outsideName);
    writeFileSync(insidePath, INSIDE);
    writeFileSync(outsidePath, OUTSIDE);
    try {
      const picked = receiptsInRange(
        [
          { transactionDate: "2026-10-15", receiptImageUrls: [`/${insideName}`] },
          { transactionDate: "2026-01-02", receiptImageUrls: [`/${outsideName}`] },
        ],
        "2026-10-01",
        "2026-10-31",
      );
      assert.deepEqual(picked, [`/${insideName}`]);
      const bytes = await zipReceiptFiles(picked);
      assert.ok(bytes);
      const zip = await JSZip.loadAsync(bytes);
      const names = Object.keys(zip.files);
      assert.equal(names.length, 1);
      const packed = await zip.files[names[0]!]!.async("nodebuffer");
      assert.deepEqual(Buffer.from(packed), INSIDE);
      assert.equal(Buffer.from(packed).equals(OUTSIDE), false);
    } finally {
      rmSync(insidePath, { force: true });
      rmSync(outsidePath, { force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("사진이 없으면 빈 압축을 만들지 않습니다", async () => {
    assert.equal(await zipReceiptFiles([]), null);
    assert.equal(await zipReceiptFiles(["/없는-영수증.png"]), null);
  });
});
