/**
 * 自作模擬試験（src/exams/）をページに組み立てる。build.mjs から呼ばれる。
 *
 * src/exams/_engine/   すべての試験で共通の見た目と動き
 * src/exams/01/        試験 1 つぶん。exam.json と q01.md 〜
 *
 * 出力（docs/exams/ からの相対パス）
 *   index.html          試験の一覧
 *   01/index.html       テストモード（開始画面・受験・採点結果）
 *   01/review.html      振り返りモード（全問・正解・解説）
 *
 * 問題の解説にある「統合ノートの参照」は、ノートの manifest.json で節が
 * 実在するかを確かめ、無ければビルドを止める。
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseQuestion, escapeHtml } from "./exam-md.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXAMS = path.join(ROOT, "src", "exams");
const ENGINE = path.join(EXAMS, "_engine");
const NOTE = path.join(ROOT, "src", "note");
const NOTE_HREF = "../../index.html";   // docs/exams/01/ から見た統合ノート

// ノートと同じ色・フォント・コード表示を使う
const SHARED_STYLES = ["01-tokens.css", "02-base.css", "07-code.css", "09-table.css", "10-list.css"];

async function styles() {
  const parts = [];
  for (const n of SHARED_STYLES) parts.push(`/* ---- note/styles/${n} ---- */\n` + (await readFile(path.join(NOTE, "styles", n), "utf8")).trim());
  parts.push("/* ---- exams/_engine/exam.css ---- */\n" + (await readFile(path.join(ENGINE, "exam.css"), "utf8")).trim());
  return parts.join("\n\n");
}

/** 差し込み口を埋める。埋め残し（テンプレートにあるのに値を渡していない口）があれば止める */
function fill(template, slots, name) {
  let html = template;
  for (const [slot, value] of Object.entries(slots)) {
    html = html.split(slot).join(value);   // 同じ差し込み口が複数あってもよい。$ も特別扱いしない
  }
  const left = template.match(/(<!--)?\{\{\w+\}\}(-->)?/g) || [];
  const unfilled = left.filter((s) => !(s in slots));
  if (unfilled.length) throw new Error(`${name} の差し込み口が埋まっていません: ${[...new Set(unfilled)].join(", ")}`);
  return html;
}

/** ノートの節 id → 「第5章 10「default / static / private」」のような表示名 */
function sectionIndex(manifest) {
  const map = {};
  for (const ch of manifest.chapters) {
    const chNo = ch.num.replace(/\D/g, "");
    for (const s of ch.sections) {
      const label = /^\d+$/.test(s.tn) ? `第${chNo}章 ${s.tn}「${s.label}」` : `第${chNo}章「${s.label}」`;
      map[s.id] = { label, chapter: ch.key };
    }
  }
  return map;
}

function chapterNames(manifest) {
  const names = {};
  for (const ch of manifest.chapters) names[ch.key] = ch.tocHeading.replace(/　/, " ");
  return names;
}

/** 問題 1 問ぶんの HTML。テスト・採点結果・振り返りで同じものを使う */
function renderArticle(q, no, sections, mode) {
  const pick = q.answer.length;
  const primary = sections[q.refs[0].id].chapter;
  const choices = q.choices.map((c) => {
    const ans = mode === "review" && q.answer.includes(c.key) ? " is-answer" : "";
    return `<li class="choice${ans}" data-key="${c.key}"><span class="key">${c.key}</span><div class="ct">${c.html}</div></li>`;
  }).join("\n");
  const refs = q.refs.map((r) => {
    const s = sections[r.id];
    return `<li><a href="${NOTE_HREF}#${r.id}">${escapeHtml(s.label)}</a> <span>── ${escapeHtml(r.note)}</span></li>`;
  }).join("");
  const chName = `第${primary.slice(1)}章`;
  return `<article class="q" id="q${no}" data-no="${no}" data-answer="${q.answer.join(",")}" data-pick="${pick}" data-ch="${primary}">
<div class="qhead"><span class="qno">問 ${no}</span><span class="pick${pick > 1 ? " multi" : ""}">${pick}つ選択</span><span class="qch">${chName}</span><span class="verdict"></span><span class="flagmark" hidden>見直しマーク</span>${mode === "test" ? '<button type="button" class="flag" aria-pressed="false">見直し</button>' : ""}</div>
<div class="stem">${q.stemHtml}</div>
<ol class="choices">
${choices}
</ol>
${mode === "test" ? '<p class="pickhint" aria-live="polite"></p>' : ""}
${mode === "review" ? '<button type="button" class="btn reveal">答えを見る</button>' : ""}
<div class="explain">
<p class="ans">正解：<b>${q.answer.join(", ")}</b></p>
${q.explainHtml}
<div class="refs"><p class="refs-h">統合ノートで確認する</p><ul>${refs}</ul></div>
</div>
</article>`;
}

export async function loadExam(id, manifest) {
  const dir = path.join(EXAMS, id);
  const meta = JSON.parse(await readFile(path.join(dir, "exam.json"), "utf8"));
  const sections = sectionIndex(manifest);
  const files = (await readdir(dir)).filter((n) => /^q\d+\.md$/.test(n)).sort();
  const questions = [];
  for (const f of files) {
    const q = parseQuestion(await readFile(path.join(dir, f), "utf8"), `${id}/${f}`);
    for (const r of q.refs) {
      if (!sections[r.id]) throw new Error(`${id}/${f}: 統合ノートに節 ${r.id} がありません`);
    }
    questions.push({ ...q, file: f });
  }
  return { id, meta, questions, sections };
}

export async function buildExams(manifest) {
  const ids = (await readdir(EXAMS, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();

  const css = await styles();
  const highlight = (await readFile(path.join(NOTE, "scripts", "01-highlight.js"), "utf8")).trim();
  const examJs = (await readFile(path.join(ENGINE, "exam.js"), "utf8")).trim();
  const reviewJs = (await readFile(path.join(ENGINE, "review.js"), "utf8")).trim();
  const testTpl = await readFile(path.join(ENGINE, "test.html"), "utf8");
  const reviewTpl = await readFile(path.join(ENGINE, "review.html"), "utf8");
  const listTpl = await readFile(path.join(ENGINE, "list.html"), "utf8");
  const chapters = chapterNames(manifest);

  const files = {};
  const cards = [];
  let questionCount = 0;

  for (const id of ids) {
    const { meta, questions, sections } = await loadExam(id, manifest);
    questionCount += questions.length;
    const total = questions.length;
    const common = {
      "{{title}}": escapeHtml(meta.title),
      "{{description}}": escapeHtml(meta.description),
      "{{total}}": String(total),
      "{{minutes}}": String(meta.minutes),
      "{{passPercent}}": String(Math.round(meta.passRate * 100)),
      "{{noteHref}}": NOTE_HREF,
      "<!--{{styles}}-->": css,
    };
    const usedChapters = {};
    for (const q of questions) usedChapters[sections[q.refs[0].id].chapter] = true;
    const chapterMeta = {};
    for (const k of Object.keys(chapters)) if (usedChapters[k]) chapterMeta[k] = chapters[k];

    const metaJson = JSON.stringify({
      id, title: meta.title, minutes: meta.minutes, passRate: meta.passRate, total,
      chapters: chapterMeta, noteHref: NOTE_HREF,
    }).replace(/</g, "\\u003c");

    files[`${id}/index.html`] = fill(testTpl, {
      ...common,
      "<!--{{questions}}-->": questions.map((q, i) => renderArticle(q, i + 1, sections, "test")).join("\n"),
      "{{meta}}": metaJson,
      "<!--{{scripts}}-->": highlight + "\n\n" + examJs,
    }, "test.html");

    files[`${id}/review.html`] = fill(reviewTpl, {
      ...common,
      "<!--{{chapterButtons}}-->": Object.keys(chapterMeta).map((k) => `      <button type="button" data-chf="${k}" aria-pressed="false">第${k.slice(1)}章</button>`).join("\n"),
      "<!--{{index}}-->": questions.map((q, i) => `      <a href="#q${i + 1}" data-ch="${sections[q.refs[0].id].chapter}">${i + 1}</a>`).join("\n"),
      "<!--{{questions}}-->": questions.map((q, i) => renderArticle(q, i + 1, sections, "review")).join("\n"),
      "<!--{{scripts}}-->": highlight + "\n\n" + reviewJs,
    }, "review.html");

    cards.push(`      <div class="xcard">
        <h2>${escapeHtml(meta.title)}</h2>
        <p>${escapeHtml(meta.description)}</p>
        <p>${total} 問 ・ ${meta.minutes} 分 ・ 合格ライン ${Math.round(meta.passRate * 100)}%（目安）</p>
        <div class="row"><a class="btn primary" href="${id}/">テストを受ける</a><a class="btn" href="${id}/review.html">問題と解説を読む</a></div>
        <p class="last" data-exam="${id}"></p>
      </div>`);
  }

  files["index.html"] = fill(listTpl, { "<!--{{styles}}-->": css, "<!--{{cards}}-->": cards.join("\n") }, "list.html");
  return { files, summary: `${ids.length} 回 / ${questionCount} 問` };
}
