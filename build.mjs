#!/usr/bin/env node
/**
 * src/ を docs/ に組み立てる。
 *
 *   node build.mjs          ビルド
 *   node build.mjs --check  ビルド結果が docs/ と一致するか検証（CI 用・書き込みなし）
 *
 * src/site/   トップ・使い方・このサイトについて → docs/index.html, docs/guide/, docs/about/
 * src/note/   教材                                → docs/note/index.html
 * src/exams/  模擬試験                            → docs/exams/ 以下
 *
 * 依存パッケージなし。Node 18 以上で動く。
 * 各ページは CSS も JS も埋め込んだ 1 枚の HTML にしている。GitHub Pages でも、
 * ダウンロードして file:// で開いても、オフラインでも同じように動かすため。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNote } from "./tools/build-note.mjs";
import { buildExams } from "./tools/build-exams.mjs";
import { buildSite } from "./tools/build-site.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, "docs");

const note = await buildNote();
const exams = await buildExams(note.manifest);
const site = await buildSite(note, exams);

const files = { ...site.files, ...note.files };
for (const [rel, content] of Object.entries(exams.files)) files[path.posix.join("exams", rel)] = content;
const summary = `サイト: ${site.summary} / 教材: ${note.summary} / 模擬試験: ${exams.summary}`;

if (process.argv.includes("--check")) {
  const stale = [];
  for (const [rel, content] of Object.entries(files)) {
    const out = path.join(OUT_DIR, rel);
    const current = existsSync(out) ? await readFile(out, "utf8") : null;
    if (current !== content) stale.push(rel);
  }
  if (stale.length) {
    console.error("docs/ が src/ と一致しません。`node build.mjs` を実行してコミットしてください。\n  " + stale.join("\n  "));
    process.exit(1);
  }
  console.log(`docs/ は最新です  (${summary})`);
} else {
  for (const [rel, content] of Object.entries(files)) {
    const out = path.join(OUT_DIR, rel);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, content, "utf8");
  }
  console.log(`docs/ を生成しました  (${summary})`);
}
