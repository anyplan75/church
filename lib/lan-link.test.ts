import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const protocol = require("../desktop/protocol.cjs") as {
  cueLines: (lines: unknown) => string[];
  parseMessage: (raw: unknown) => { type: string; lines?: string[]; serviceId?: string; seq?: number } | null;
  linesPayload: (serviceId: string, lines: string[], seq?: number) => string;
  DEFAULT_PORT: number;
};

describe("desktop protocol", () => {
  it("keeps only two short lines", () => {
    assert.deepEqual(protocol.cueLines(["  하나  ", "둘", "셋"]), ["하나", "둘"]);
  });

  it("parses line messages", () => {
    const raw = protocol.linesPayload("svc-1", ["첫째", "둘째"], 3);
    const message = protocol.parseMessage(raw);
    assert.equal(message?.type, "lines");
    assert.equal(message?.serviceId, "svc-1");
    assert.equal(message?.seq, 3);
    assert.deepEqual(message?.lines, ["첫째", "둘째"]);
  });

  it("uses a fixed local port", () => {
    assert.equal(protocol.DEFAULT_PORT, 18765);
  });

  it("ships electron entry files", () => {
    const root = path.join(process.cwd(), "desktop");
    for (const name of ["main.cjs", "preload.cjs", "output-server.cjs", "discovery.cjs", "after-pack.cjs", "builder.json"]) {
      assert.ok(readFileSync(path.join(root, name), "utf8").length > 20);
    }
  });

  it("ships mac launchers for operator output overlay", () => {
    const dir = path.join(process.cwd(), "desktop", "mac-launchers");
    for (const name of ["은혜로운 예배 조작.command", "은혜로운 예배 송출.command", "은혜로운 예배 오버레이.command"]) {
      const body = readFileSync(path.join(dir, name), "utf8");
      assert.match(body, /--mode=/);
    }
  });
});
