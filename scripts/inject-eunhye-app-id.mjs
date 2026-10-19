#!/usr/bin/env node
/**
 * Capacitor public HTML 에 eunhye-app-id 메타를 넣습니다.
 * (Capacitor JSExport 가 config.appId 를 window 에 안 내려 주기 때문)
 *
 * 사용: node scripts/inject-eunhye-app-id.mjs <publicDir> <appId>
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const publicDir = process.argv[2];
const appId = process.argv[3];

if (!publicDir || !appId) {
  console.error("사용법: node scripts/inject-eunhye-app-id.mjs <publicDir> <appId>");
  process.exit(1);
}

const META_RE = /<meta\s+name=["']eunhye-app-id["'][^>]*>/i;
const metaTag = `<meta name="eunhye-app-id" content="${appId}"/>`;
const bootScript = `<script>window.__EUNHYE_APP_ID__=${JSON.stringify(appId)};</script>`;

async function walkHtml(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_next" || entry.name === "node_modules") continue;
      await walkHtml(full, out);
    } else if (entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

const files = await walkHtml(publicDir);
let changed = 0;
for (const file of files) {
  let html = await readFile(file, "utf8");
  const before = html;
  if (META_RE.test(html)) {
    html = html.replace(META_RE, metaTag);
  } else if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${metaTag}${bootScript}`);
  } else {
    html = `${metaTag}${bootScript}${html}`;
  }
  if (!html.includes("__EUNHYE_APP_ID__")) {
    html = html.replace(metaTag, `${metaTag}${bootScript}`);
  } else {
    html = html.replace(/window\.__EUNHYE_APP_ID__\s*=\s*["'][^"']*["']\s*;?/g, `window.__EUNHYE_APP_ID__=${JSON.stringify(appId)};`);
  }
  if (html !== before) {
    await writeFile(file, html, "utf8");
    changed += 1;
  }
}

console.log(`eunhye-app-id=${appId} → ${changed}/${files.length} HTML (${publicDir})`);
