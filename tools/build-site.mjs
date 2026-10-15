/**
 * 教材と模擬試験以外のページ（src/site/）を組み立てる。build.mjs から呼ばれる。
 *
 *   index.html        トップ（ポータル）。教材と模擬試験の入口、「続きから」「前回の結果」
 *   guide/index.html  はじめての方へ（使い方）。本物のページを ?guide 付きで開いて説明する
 *   about/index.html  このサイトについて（注意事項・著作権・記録の保存先）
 *
 * 色とフォントは教材の 01-tokens.css と 02-base.css を共有する。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "src", "site");
const NOTE_STYLES = path.join(ROOT, "src", "note", "styles");

const read = (dir, n) => readFile(path.join(dir, n), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 差し込み口を埋める。埋め残しがあれば止める */
function fill(template, slots, name) {
  let html = template;
  for (const [slot, value] of Object.entries(slots)) html = html.split(slot).join(value);
  const left = html.match(/(<!--)?\{\{\w+\}\}(-->)?/g);
  if (left) throw new Error(`${name} の差し込み口が埋まっていません: ${[...new Set(left)].join(", ")}`);
  return html;
}

/**
 * @param note   buildNote() の結果（stats）
 * @param exams  buildExams() の結果（list・questionCount）
 */
export async function buildSite(note, exams) {
  const styles = [
    await read(NOTE_STYLES, "01-tokens.css"),
    await read(NOTE_STYLES, "02-base.css"),
    await read(SITE, "site.css"),
  ].map((s) => s.trim()).join("\n\n");

  const stats = {
    "{{chapters}}": String(note.stats.chapters),
    "{{sections}}": String(note.stats.sections),
    "{{points}}": String(note.stats.points),
    "{{examCount}}": String(exams.list.length),
    "{{questions}}": String(exams.questionCount),
  };
  // base はそのページから見たサイトの先頭（トップは "./"、guide/ と about/ は "../"）
  const header = async (base, cur) => fill(await read(SITE, "header.html"), {
    "{{base}}": base,
    "{{guideCur}}": cur === "guide" ? ' aria-current="page"' : "",
    "{{aboutCur}}": cur === "about" ? ' aria-current="page"' : "",
  }, "header.html");
  const footer = async (base) => fill(await read(SITE, "footer.html"), { "{{base}}": base }, "footer.html");

  const examRows = exams.list.map((x) =>
    `        <li data-exam="${x.id}"><a href="exams/${x.id}/">${esc(x.title)}</a><span class="pt-x-s">未受験</span></li>`).join("\n");
  const meta = JSON.stringify({ exams: exams.list.map((x) => ({ id: x.id, title: x.title })) }).replace(/</g, "\\u003c");

  const files = {};
  files["index.html"] = fill(await read(SITE, "index.html"), {
    ...stats,
    "<!--{{styles}}-->": styles,
    "<!--{{header}}-->": await header("./", ""),
    "<!--{{footer}}-->": await footer("./"),
    "<!--{{examRows}}-->": examRows,
    "{{meta}}": meta,
  }, "index.html");

  // 使い方で見本に開く模擬試験は、いちばん新しい回
  const guideConf = `window.GuideConf = ${JSON.stringify({ exam: exams.list[exams.list.length - 1].id })};`;
  files["guide/index.html"] = fill(await read(SITE, "guide.html"), {
    "<!--{{styles}}-->": styles,
    "<!--{{header}}-->": await header("../", "guide"),
    "<!--{{footer}}-->": await footer("../"),
    "<!--{{guideJs}}-->": guideConf + "\n" + (await read(SITE, "guide.js")).trim(),
  }, "guide.html");

  files["about/index.html"] = fill(await read(SITE, "about.html"), {
    ...stats,
    "<!--{{styles}}-->": styles,
    "<!--{{header}}-->": await header("../", "about"),
    "<!--{{footer}}-->": await footer("../"),
  }, "about.html");

  return { files, summary: Object.keys(files).length + " ページ" };
}
