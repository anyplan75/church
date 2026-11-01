const SKIP_DESTINATIONS = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "object",
  "footer",
  "footerf",
  "footerl",
  "footerr",
  "header",
  "headerf",
  "headerl",
  "headerr",
  "footnote",
  "fldinst",
  "xmlnstbl",
  "themedata",
  "datastore",
  "latentstyles",
  "listtable",
  "listoverridetable",
  "revtbl",
  "rsidtbl",
  "generator",
  "nonshppict",
  "background",
  "filetbl",
  "colorschememapping",
  "pgdsctbl",
]);

export function extractRtf(data: Buffer): string {
  const source = data.toString("latin1");
  if (!source.trimStart().startsWith("{\\rtf")) throw new Error("RTF 파일에서 글을 읽지 못했습니다.");
  const text = parseRtf(source).replace(/\r/g, "").trim();
  if (!text) throw new Error("RTF 파일에서 글을 읽지 못했습니다.");
  return text;
}

function parseRtf(source: string): string {
  let index = 0;
  let skipping = false;
  let ignoreNext = false;
  let uc = 1;
  let pendingSkip = 0;
  let codepage = "windows-1252";
  const skipStack: boolean[] = [];
  const ucStack: number[] = [];
  const bytes: number[] = [];
  let text = "";

  function flushBytes() {
    if (bytes.length === 0) return;
    const chunk = Buffer.from(bytes);
    bytes.length = 0;
    if (skipping) return;
    text += new TextDecoder(codepage).decode(chunk);
  }

  while (index < source.length) {
    const char = source[index];
    if (char === "{") {
      flushBytes();
      skipStack.push(skipping);
      ucStack.push(uc);
      index += 1;
      continue;
    }
    if (char === "}") {
      flushBytes();
      skipping = skipStack.pop() ?? false;
      uc = ucStack.pop() ?? 1;
      ignoreNext = false;
      index += 1;
      continue;
    }
    if (char === "\\") {
      const next = source[index + 1];
      if (next === "'") {
        const byte = Number.parseInt(source.slice(index + 2, index + 4), 16);
        index += 4;
        if (Number.isNaN(byte)) continue;
        if (pendingSkip > 0) {
          pendingSkip -= 1;
          continue;
        }
        if (!skipping) bytes.push(byte);
        continue;
      }
      if (next === "*" ) {
        ignoreNext = true;
        index += 2;
        continue;
      }
      if (next === "{" || next === "}" || next === "\\") {
        flushBytes();
        if (pendingSkip > 0) pendingSkip -= 1;
        else if (!skipping) text += next;
        index += 2;
        continue;
      }
      if (next === "~") {
        flushBytes();
        if (pendingSkip > 0) pendingSkip -= 1;
        else if (!skipping) text += " ";
        index += 2;
        continue;
      }
      if (next === "_" || next === "-") {
        flushBytes();
        if (pendingSkip > 0) pendingSkip -= 1;
        else if (!skipping && next === "_") text += "-";
        index += 2;
        continue;
      }
      index += 1;
      let word = "";
      while (index < source.length && /[a-zA-Z]/.test(source[index])) {
        word += source[index];
        index += 1;
      }
      let number = "";
      if (source[index] === "-" || (source[index] >= "0" && source[index] <= "9")) {
        number += source[index];
        index += 1;
        while (index < source.length && source[index] >= "0" && source[index] <= "9") {
          number += source[index];
          index += 1;
        }
      }
      if (source[index] === " ") index += 1;
      if (!word) continue;
      if (word === "bin") {
        flushBytes();
        const count = Number(number);
        if (Number.isFinite(count) && count > 0) index += count;
        continue;
      }
      if (ignoreNext || SKIP_DESTINATIONS.has(word)) {
        skipping = true;
        ignoreNext = false;
        continue;
      }
      if (word === "uc") {
        const nextUc = Number(number);
        if (Number.isFinite(nextUc) && nextUc >= 0) uc = nextUc;
        continue;
      }
      if (word === "ansicpg") {
        flushBytes();
        codepage = codepageFor(Number(number));
        continue;
      }
      if (word === "u") {
        flushBytes();
        let code = Number(number);
        if (!Number.isFinite(code)) continue;
        if (code < 0) code += 65536;
        if (pendingSkip > 0) pendingSkip -= 1;
        else if (!skipping) text += String.fromCharCode(code);
        pendingSkip += uc;
        continue;
      }
      if (word === "par" || word === "line" || word === "page") {
        flushBytes();
        if (!skipping && pendingSkip === 0) text += "\n";
        continue;
      }
      if (word === "tab") {
        flushBytes();
        if (!skipping && pendingSkip === 0) text += "\t";
      }
      continue;
    }
    if (char === "\r" || char === "\n") {
      index += 1;
      continue;
    }
    if (pendingSkip > 0) pendingSkip -= 1;
    else if (!skipping) bytes.push(char.charCodeAt(0) & 0xff);
    index += 1;
  }
  flushBytes();
  return text;
}

function codepageFor(page: number): string {
  if (page === 949 || page === 51949) return "euc-kr";
  if (page === 65001) return "utf-8";
  if (page === 932) return "shift_jis";
  if (page === 936) return "gbk";
  if (page === 950) return "big5";
  return "windows-1252";
}
