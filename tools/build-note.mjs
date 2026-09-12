/**
 * 統合ノート（src/note/）を 1 枚の docs/index.html に組み立てる。
 * build.mjs から呼ばれる。
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src", "note");

const read = (...p) => readFile(path.join(SRC, ...p), "utf8");

/** ディレクトリ内のファイルをファイル名順に連結する（01-, 02- … の順序がそのまま意味を持つ） */
async function concatDir(dir, ext) {
  const names = (await readdir(path.join(SRC, dir)))
    .filter((n) => n.endsWith(ext))
    .sort();
  const parts = [];
  for (const n of names) {
    parts.push(`/* ---- ${dir}/${n} ---- */\n${(await read(dir, n)).trim()}`);
  }
  return { text: parts.join("\n\n"), names };
}

/** サイドバーの目次。スマホではこの要素がそのままドロワーになる（20-mobile.css） */
function buildNav(manifest) {
  const out = [];
  out.push('<nav class="toc" id="toc-nav" aria-label="目次">');
  out.push('  <button type="button" class="toc-close" id="mnav-close" aria-label="目次を閉じる">×</button>');
  out.push(`  <div class="toc-brand">${manifest.brand}</div>`);
  out.push(`  <div class="toc-sub">${manifest.brandSub}</div>`);
  // 目次の中で唯一ページの外へ出るリンク。scrollspy と検索は a[href^="#"] だけを見るので巻き込まれない
  out.push('  <a class="toc-exam" href="exams/index.html"><span class="tn">✎</span>自作模擬試験</a>');
  out.push('  <div class="search">');
  out.push('    <input id="q" type="search" placeholder="論点を検索（/ で移動）" autocomplete="off" aria-label="ノート内を検索">');
  out.push('    <span class="x" id="qx" role="button" tabindex="0" aria-label="検索を解除">×</span>');
  out.push('    <p class="shits" id="qhits" aria-live="polite"></p>');
  out.push('  </div>');
  out.push('  <a href="#idx"><span class="tn">◎</span>論点インデックス</a>');
  for (const ch of manifest.chapters) {
    // 章ごとに包むのは、スマホで章単位に折り畳めるようにするため。
    // PC では .toc-ch に見た目の指定がないので、素通しの div として振る舞う。
    out.push(`  <div class="toc-ch" data-chapter="${ch.key}">`);
    out.push(`    <div class="toc-h"><span class="mark" aria-hidden="true"></span>${ch.tocHeading}</div>`);
    for (const s of ch.sections) {
      out.push(`    <a href="#${s.id}"><span class="tn">${s.tn}</span>${s.label}</a>`);
    }
    out.push('  </div>');
  }
  out.push("</nav>");
  return out.join("\n");
}

/** スマホ用の上部バー。PC では 20-mobile.css が display:none にする */
function buildMobileBar() {
  return [
    '<div class="mbar" id="mnav-bar">',
    '  <button type="button" class="mbar-open" id="mnav-open" aria-controls="toc-nav" aria-expanded="false">',
    '    <span class="bars" aria-hidden="true"></span>目次',
    '  </button>',
    '  <button type="button" class="mbar-now" id="mnav-now" aria-label="現在の位置。押すと目次を開く">',
    '    <span class="ch"></span><span class="se"></span>',
    '  </button>',
    '  <button type="button" class="mbar-top" id="mnav-top" aria-label="先頭に戻る">▲</button>',
    '</div>',
    '<div class="mscrim" id="mnav-scrim" hidden></div>',
  ].join("\n");
}

async function buildChapters(manifest) {
  const parts = [];
  for (const ch of manifest.chapters) {
    parts.push(`<!-- ==================== ${ch.num} ==================== -->`);
    parts.push((await read("content", ch.id, "_chapter.html")).trim());
    for (const s of ch.sections) {
      parts.push(`\n<!-- ${ch.id}/${s.file} · ${s.label} -->`);
      parts.push((await read("content", ch.id, s.file)).trim());
    }
    parts.push("");
  }
  return parts.join("\n");
}

/** 節ファイルの id と manifest の id がずれていないか確かめる */
async function verify(manifest) {
  const problems = [];
  const seen = new Set();
  for (const ch of manifest.chapters) {
    for (const s of ch.sections) {
      const file = path.join(SRC, "content", ch.id, s.file);
      if (!existsSync(file)) {
        problems.push(`${ch.id}/${s.file} が見つかりません`);
        continue;
      }
      const html = await readFile(file, "utf8");
      const m = html.match(/<section id="([^"]+)"/);
      if (!m) problems.push(`${ch.id}/${s.file} に <section id="..."> がありません`);
      else if (m[1] !== s.id) {
        problems.push(`${ch.id}/${s.file} の id は "${m[1]}" ですが manifest は "${s.id}" です`);
      }
      if (seen.has(s.id)) problems.push(`id "${s.id}" が重複しています`);
      seen.add(s.id);
      if (!s.id.startsWith(ch.key + "-")) {
        problems.push(`${ch.id}/${s.file} の id "${s.id}" が接頭辞 "${ch.key}-" で始まっていません`);
      }
    }
    // 04-checklist.js は #<key>-cklist / #<key>-barfill / #<key>-barlab を掴む。
    // manifest の key と本文の id がずれると無言で効かなくなるので、ここで落とす。
    const ck = await readFile(path.join(SRC, "content", ch.id, "checklist.html"), "utf8")
      .catch(() => "");
    for (const suffix of ["cklist", "barfill", "barlab"]) {
      if (!ck.includes(`id="${ch.key}-${suffix}"`)) {
        problems.push(`${ch.id}/checklist.html に id="${ch.key}-${suffix}" がありません`);
      }
    }
  }
  return problems;
}

export async function buildNote() {
  const manifest = JSON.parse(await read("manifest.json"));

  const problems = await verify(manifest);
  if (problems.length) {
    console.error("ビルド中止:\n  " + problems.join("\n  "));
    process.exit(1);
  }

  const styles = await concatDir("styles", ".css");
  const scripts = await concatDir("scripts", ".js");
  const topicIndex = JSON.parse(await read("data", "topic-index.json"));

  const config = [
    "/* ---- build.mjs が manifest.json / topic-index.json から生成 ---- */",
    `window.NoteApp = { chapters: ${JSON.stringify(manifest.chapters.map((c) => c.key))},`,
    `  topicIndex: ${JSON.stringify(topicIndex)} };`,
  ].join("\n");

  const slots = {
    "{{title}}": manifest.title,
    "{{description}}": manifest.description,
    "<!--{{styles}}-->": styles.text,
    "<!--{{mobileBar}}-->": buildMobileBar(),
    "<!--{{nav}}-->": buildNav(manifest),
    "<!--{{hero}}-->": (await read("content", "hero.html")).trim(),
    "<!--{{topicIndex}}-->": (await read("content", "topic-index.html")).trim(),
    "<!--{{chapters}}-->": await buildChapters(manifest),
    "<!--{{footer}}-->": (await read("content", "footer.html")).trim(),
    "<!--{{scripts}}-->": config + "\n\n" + scripts.text,
  };

  let html = await read("template.html");
  for (const [slot, value] of Object.entries(slots)) {
    if (!html.includes(slot)) {
      console.error("ビルド中止: template.html に " + slot + " がありません");
      process.exit(1);
    }
    // 置換文字列中の $ を特殊扱いさせないため、関数形式で渡す
    html = html.replace(slot, () => value);
  }

  const sections = manifest.chapters.reduce((n, c) => n + c.sections.length, 0);
  return {
    manifest,
    files: { "index.html": html },
    summary: `${manifest.chapters.length} 章 / ${sections} 節 · css ${styles.names.length} · js ${scripts.names.length} · ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`,
  };
}
