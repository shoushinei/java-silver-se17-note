/**
 * 教材（src/note/）を 1 枚の docs/note/index.html に組み立てる。
 * build.mjs から呼ばれる。
 *
 * 論点番号
 *   節は「章-節」（2-3）、節の中の小見出し（h3）は「章-節-項」（2-3-4）。
 *   番号は manifest.json の並びと h3 の出現順からビルドのたびに振り直すので、
 *   本文に番号を手で書く必要はない。h3 に data-toc="短い名前" があれば、目次にはそちらを出す。
 *
 * 索引
 *   data/index-terms.json の語句が、どの論点に載っているかを本文から探して、
 *   教材の最後に記号・数字・A〜Z・50音の順で並べる。
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

const ENTITIES = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
const decode = (s) => s.replace(/&(lt|gt|amp|quot|#39|nbsp);/g, (m) => ENTITIES[m]);
const textOf = (html) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 節の番号（2-3）。tn は manifest の "03" */
export const sectionNo = (ch, s) => `${ch.key.slice(1)}-${+s.tn}`;

/**
 * 節の HTML に論点番号を振る。
 *   <span class="num">03</span>  → 2-3
 *   <h3>見出し</h3>               → <h3 id="p2-3-4"><span class="pn">2-3-4</span>見出し</h3>
 * 返す points は目次と索引に使う。先頭の要素は「節の冒頭（最初の h3 まで）」
 */
function numberSection(ch, s, html) {
  const no = sectionNo(ch, s);
  html = html.replace(/<span class="num">[^<]*<\/span>/, `<span class="num">${no}</span>`);
  const points = [{ no, id: s.id, label: s.label, start: 0 }];
  let i = 0;
  html = html.replace(/<h3([^>]*)>([\s\S]*?)<\/h3>/g, (all, attrs, inner, offset) => {
    i++;
    const pno = `${no}-${i}`;
    const toc = /\sdata-toc="([^"]*)"/.exec(attrs);
    attrs = attrs.replace(/\sdata-toc="[^"]*"/, "");
    const idm = /\sid="([^"]*)"/.exec(attrs);
    const id = idm ? idm[1] : `p${pno}`;
    if (!idm) attrs = ` id="${id}"` + attrs;
    points.push({ no: pno, id, label: toc ? decode(toc[1]) : textOf(inner), start: offset });
    return `<h3${attrs}><span class="pn">${pno}</span>${inner}</h3>`;
  });
  // 索引用に、論点ごとの本文の範囲を切り出す（番号を振る前の HTML 上の位置なので、振ったあとの HTML で探し直す）
  const cuts = [0];
  const re = /<h3[\s>]/g;
  let m;
  while ((m = re.exec(html))) cuts.push(m.index);
  cuts.push(html.length);
  points.forEach((p, k) => { p.html = html.slice(cuts[k], cuts[k + 1]); });
  return { html, points };
}

/* ---------------- 索引 ---------------- */

const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const ROWS = [["あ", "あ-おぁ-ぉゔ"], ["か", "か-ごゕゖ"], ["さ", "さ-ぞ"], ["た", "た-どっ"], ["な", "な-の"],
              ["は", "は-ぽ"], ["ま", "ま-も"], ["や", "や-よゃ-ょ"], ["ら", "ら-ろ"], ["わ", "わ-ん"]];

function groupOf(term) {
  const c = term.t[0];
  if (/[A-Za-z]/.test(c)) return c.toUpperCase();
  if (/[0-9]/.test(c)) return "数字";
  const k = toHira(term.y || term.t)[0];
  for (const [row, range] of ROWS) if (new RegExp(`[${range}]`).test(k)) return row + "行";
  return "記号";
}

function keyRegex(k) {
  const q = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const left = /^\w/.test(k) ? "(?<!\\w)" : "";
  const right = /\w$/.test(k) ? "(?![\\w])" : "";
  return new RegExp(left + q + right);
}

/** 論点 1 つぶんの「目立つ場所」の文字列。見出し・太字・表の見出し・本文中のコード */
function spots(p) {
  const body = p.html.replace(/<pre[\s\S]*?<\/pre>/g, " ").replace(/<figure[\s\S]*?<\/figure>/g, " ");
  const pick = (re) => [...body.matchAll(re)].map((m) => textOf(m[1])).join(" \u0001 ");
  const head = p.start === 0 ? p.label + " \u0001 " + pick(/<h2[^>]*>([\s\S]*?)<\/h2>/g) : pick(/<h3[^>]*>([\s\S]*?)<\/h3>/g);
  return {
    head,
    strong: pick(/<(?:strong|b|th|dt)\b[^>]*>([\s\S]*?)<\/(?:strong|b|th|dt)>/g),
    code: pick(/<code\b[^>]*>([\s\S]*?)<\/code>/g),
    plain: textOf(body),
  };
}

const MAX_REFS = 6;

function buildIndex(terms, points) {
  const sp = points.map((p) => ({ p, s: spots(p) }));
  const collator = new Intl.Collator("ja");
  const entries = [];
  const missing = [];
  for (const term of terms) {
    const res = (term.k || [term.t]).map(keyRegex);
    const hit = (s) => res.some((r) => r.test(s));
    const scored = [];
    sp.forEach(({ p, s }, order) => {
      if (term.x && term.x.includes(p.no)) return;
      const score = hit(s.head) ? 5 : hit(s.strong) ? 3 : hit(s.code) ? 2 : hit(s.plain) ? 1 : 0;
      if (score) scored.push({ p, score, order });
    });
    let refs = scored.filter((x) => x.score >= 2);
    if (!refs.length) refs = scored;
    refs = refs.sort((a, b) => b.score - a.score || a.order - b.order).slice(0, MAX_REFS)
      .sort((a, b) => a.order - b.order);
    if (!refs.length) { missing.push(term.t); continue; }
    entries.push({ term, group: groupOf(term), refs: refs.map((x) => x.p) });
  }

  const order = ["記号", "数字", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", ...ROWS.map((r) => r[0] + "行")];
  const groups = order.map((g) => ({ g, list: entries.filter((e) => e.group === g) })).filter((x) => x.list.length);
  const sortKey = (e) => (/^[A-Za-z]/.test(e.term.t) ? e.term.t.toLowerCase() : toHira(e.term.y || e.term.t));
  for (const x of groups) x.list.sort((a, b) => collator.compare(sortKey(a), sortKey(b)));

  const out = [];
  out.push('<section id="idx">');
  out.push('  <div class="sh"><span class="num">INDEX</span><h2>索引</h2></div>');
  out.push('  <p class="ix-lead">語句から、それを扱っている論点を引けます。番号を押すとその論点へ飛びます（太字の番号は、見出しにその語句がある論点です）。本文を全文で探したいときは、目次の上の検索窓を使ってください。</p>');
  out.push('  <nav class="ix-jump" aria-label="索引の見出しへ移動">' +
    groups.map((x) => `<a href="#ix-${encodeURIComponent(x.g)}">${x.g.replace("行", "")}</a>`).join("") + "</nav>");
  out.push('  <div class="ix-cols">');
  for (const x of groups) {
    out.push(`    <div class="ix-g" id="ix-${encodeURIComponent(x.g)}"><div class="ix-h">${x.g}</div>`);
    for (const e of x.list) {
      const heads = new Set(e.refs.filter((p) => spots(p).head && (e.term.k || [e.term.t]).map(keyRegex).some((r) => r.test(spots(p).head))).map((p) => p.no));
      const links = e.refs.map((p) => `<a href="#${p.id}"${heads.has(p.no) ? ' class="h"' : ""}>${p.no}</a>`).join(", ");
      out.push(`      <div class="ix-e"><span class="ix-t">${esc(e.term.t)}</span><span class="ix-d" aria-hidden="true"></span><span class="ix-r">${links}</span></div>`);
    }
    out.push("    </div>");
  }
  out.push("  </div>");
  out.push("</section>");
  return { html: out.join("\n"), count: entries.length, missing };
}

/* ---------------- 目次 ---------------- */

/** サイドバーの目次。スマホではこの要素がそのままドロワーになる（20-mobile.css） */
function buildNav(manifest, pointsBySection) {
  const out = [];
  out.push('<nav class="toc" id="toc-nav" aria-label="目次">');
  out.push('  <button type="button" class="toc-close" id="mnav-close" aria-label="目次を閉じる">×</button>');
  out.push(`  <a class="toc-brand" href="../">${manifest.brand}</a>`);
  out.push(`  <div class="toc-sub">${manifest.brandSub}</div>`);
  // ページの外へ出るリンク。scrollspy と検索は a[href^="#"] だけを見るので巻き込まれない
  out.push('  <div class="toc-out"><a href="../">トップ</a><a href="../exams/">模擬試験</a><a href="../guide/">使い方</a></div>');
  out.push('  <div class="search">');
  out.push('    <input id="q" type="search" placeholder="教材を検索（/ で移動）" autocomplete="off" aria-label="教材の中を検索">');
  out.push('    <span class="x" id="qx" role="button" tabindex="0" aria-label="検索を解除">×</span>');
  out.push('    <p class="shits" id="qhits" aria-live="polite"></p>');
  out.push('  </div>');
  for (const ch of manifest.chapters) {
    // 章ごとに包むのは、スマホで章単位に折り畳めるようにするため。
    // PC では .toc-ch に見た目の指定がないので、素通しの div として振る舞う。
    out.push(`  <div class="toc-ch" data-chapter="${ch.key}">`);
    out.push(`    <div class="toc-h"><span class="mark" aria-hidden="true"></span>${ch.tocHeading}</div>`);
    for (const s of ch.sections) {
      out.push(`    <a class="sec" href="#${s.id}"><span class="tn">${sectionNo(ch, s)}</span>${s.label}</a>`);
      const pts = pointsBySection[s.id].slice(1);
      if (pts.length) {
        // 小さい論点は、読んでいる節（と検索でヒットした節）のぶんだけ開く
        out.push(`    <div class="toc-pts" data-sec="${s.id}">` +
          pts.map((p) => `<a class="pt" href="#${p.id}"><span class="tn">${p.no}</span>${esc(p.label)}</a>`).join("") + "</div>");
      }
    }
    out.push('  </div>');
  }
  out.push('  <a class="sec toc-idx" href="#idx"><span class="tn">◎</span>索引</a>');
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
  const pointsBySection = {};
  const all = [];
  for (const ch of manifest.chapters) {
    parts.push(`<!-- ==================== ${ch.num} ==================== -->`);
    parts.push((await read("content", ch.id, "_chapter.html")).trim());
    for (const s of ch.sections) {
      const { html, points } = numberSection(ch, s, (await read("content", ch.id, s.file)).trim());
      pointsBySection[s.id] = points;
      all.push(...points);
      parts.push(`\n<!-- ${ch.id}/${s.file} · ${s.label} -->`);
      parts.push(html);
    }
    parts.push("");
  }
  return { html: parts.join("\n"), pointsBySection, points: all };
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
      if (!/^\d+$/.test(s.tn)) problems.push(`${ch.id}/${s.file} の tn "${s.tn}" は数字にしてください（論点番号に使います）`);
      const html = await readFile(file, "utf8");
      const m = html.match(/<section id="([^"]+)"/);
      if (!m) problems.push(`${ch.id}/${s.file} に <section id="..."> がありません`);
      else if (m[1] !== s.id) {
        problems.push(`${ch.id}/${s.file} の id は "${m[1]}" ですが manifest は "${s.id}" です`);
      }
      if (!html.includes('<span class="num">')) problems.push(`${ch.id}/${s.file} に <span class="num"> がありません`);
      if (seen.has(s.id)) problems.push(`id "${s.id}" が重複しています`);
      seen.add(s.id);
      if (!s.id.startsWith(ch.key + "-")) {
        problems.push(`${ch.id}/${s.file} の id "${s.id}" が接頭辞 "${ch.key}-" で始まっていません`);
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
  const chapters = await buildChapters(manifest);
  const index = buildIndex(JSON.parse(await read("data", "index-terms.json")).terms, chapters.points);
  if (index.missing.length) {
    console.error("ビルド中止: 索引の語句が本文に見つかりません（index-terms.json の k を直すか、語句を消してください）:\n  " + index.missing.join("\n  "));
    process.exit(1);
  }

  const config = [
    "/* ---- build.mjs が manifest.json から生成 ---- */",
    `window.NoteApp = { chapters: ${JSON.stringify(manifest.chapters.map((c) => c.key))} };`,
  ].join("\n");

  const slots = {
    "{{title}}": manifest.title,
    "{{description}}": manifest.description,
    "<!--{{styles}}-->": styles.text,
    "<!--{{mobileBar}}-->": buildMobileBar(),
    "<!--{{nav}}-->": buildNav(manifest, chapters.pointsBySection),
    "<!--{{hero}}-->": (await read("content", "hero.html")).trim(),
    "<!--{{chapters}}-->": chapters.html,
    "<!--{{index}}-->": index.html,
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
  const subPoints = chapters.points.length - sections;
  return {
    manifest,
    stats: { chapters: manifest.chapters.length, sections, points: subPoints },
    files: { "note/index.html": html },
    summary: `${manifest.chapters.length} 章 / ${sections} 節 / ${subPoints} 論点 / 索引 ${index.count} 語 · css ${styles.names.length} · js ${scripts.names.length} · ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`,
  };
}
