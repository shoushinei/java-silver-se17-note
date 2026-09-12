/**
 * 模擬試験の問題ファイル（src/exams/<id>/q01.md など）を読む。
 *
 * 書式（Markdown に似せた、この試験専用の小さな書式）:
 *
 *   ---
 *   answer: B              複数選択なら "A, C"
 *   refs:                  統合ノートの節 id と、その問題で使う論点のひとこと
 *     - c5-s10 サブインタフェースの default でも抽象メソッドを実装できる
 *   ---
 *   問題文の段落。`code` と **強調** が使える。
 *
 *   ```java title=Main.java
 *   コード（java は行番号付きで表示される）
 *   ```
 *
 *   - A. 選択肢の文
 *   - B.
 *     ```java
 *     コードそのものが選択肢になる場合は、2 字下げでコードブロックを書く
 *     ```
 *
 *   ## 解説
 *   段落・コードブロック・「- 」の箇条書き。
 *
 *   ## 検証
 *   @case ...  （tools/verify-exams.mjs が読む。ページには出ない）
 */

export function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** `code` と **強調** だけを解釈する。先にエスケープしてから置き換えるので安全 */
export function renderInline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*(.+?)\*\*/g, (_, b) => `<strong>${b}</strong>`);
  return s;
}

/** コードブロック。java は行番号の欄を横に付ける（問題文で「N 行目」と言えるように） */
export function renderCode(info, src, { numbered = false } = {}) {
  const lang = (info.match(/^(\w+)/) || [, ""])[1];
  const title = (info.match(/title=(\S+)/) || [, ""])[1];
  const lines = src.replace(/\s+$/, "").split("\n");
  const cap = title ? `<div class="cap">${escapeHtml(title)}</div>` : "";
  const gut = numbered
    ? `<pre class="gut" aria-hidden="true">${lines.map((_, i) => i + 1).join("\n")}</pre>`
    : "";
  const kind = lang === "console" ? " console" : "";
  return `<div class="code${kind}">${cap}<div class="cbody">${gut}<pre><code>${escapeHtml(lines.join("\n"))}</code></pre></div></div>`;
}

/** 段落・コードブロック・箇条書きを HTML にする */
export function renderBlocks(md, { numberJava = false } = {}) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let para = [];
  let list = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${renderInline(para.join(""))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${renderInline(li)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flushPara(); flushList();
      const body = [];
      for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i]);
      const info = fence[1].trim();
      const numbered = /\bnolines\b/.test(info) ? false : (/\blines\b/.test(info) || (numberJava && /^java\b/.test(info)));
      out.push(renderCode(info, body.join("\n"), { numbered }));
      continue;
    }
    if (/^- /.test(line)) { flushPara(); list.push(line.slice(2).trim()); continue; }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    flushList();
    para.push(line.trim());
  }
  flushPara(); flushList();
  return out.join("\n");
}

/** 選択肢を読む。「- A. 文」と、2 字下げで続く行（コードブロック可） */
function parseChoices(lines) {
  const choices = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^- ([A-H])\.\s?(.*)$/);
    if (m) { cur = { key: m[1], head: m[2], body: [] }; choices.push(cur); continue; }
    if (cur && (/^ {2}/.test(line) || !line.trim())) { cur.body.push(line.replace(/^ {2}/, "")); continue; }
    if (line.trim()) throw new Error("選択肢の書式が読めない行: " + line);
  }
  return choices.map((c) => {
    const body = c.body.join("\n").trim();
    let html = c.head ? renderInline(c.head) : "";
    if (body) html += renderBlocks(body, { numberJava: false });
    return { key: c.key, html };
  });
}

/** 問題ファイルを読み取り、ページに埋める部品と検証用の生テキストを返す */
export function parseQuestion(text, file) {
  const src = text.replace(/\r\n/g, "\n");
  const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error(`${file}: 先頭の --- で囲んだ設定がありません`);
  const meta = { answer: [], refs: [] };
  let inRefs = false;
  for (const line of fm[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      inRefs = kv[1] === "refs";
      if (kv[1] === "answer") meta.answer = kv[2].split(/[,\s]+/).filter(Boolean);
      continue;
    }
    const ref = line.match(/^\s+-\s+(c\d-s\d+|c\d-quiz|c\d-check)\s+(.*)$/);
    if (inRefs && ref) meta.refs.push({ id: ref[1], note: ref[2].trim() });
    else if (line.trim()) throw new Error(`${file}: 設定の行が読めません: ${line}`);
  }
  if (!meta.answer.length) throw new Error(`${file}: answer がありません`);
  if (!meta.refs.length) throw new Error(`${file}: refs（統合ノートの参照）がありません`);

  const rest = src.slice(fm[0].length);
  const [body, explainAndVerify = ""] = rest.split(/^## 解説\s*$/m);
  const [explain, verify = ""] = explainAndVerify.split(/^## 検証\s*$/m);

  // 本文のうち、最初の「- A.」以降が選択肢
  const bodyLines = body.split("\n");
  const firstChoice = bodyLines.findIndex((l) => /^- [A-H]\./.test(l));
  if (firstChoice < 0) throw new Error(`${file}: 選択肢（- A. ...）がありません`);
  const stemMd = bodyLines.slice(0, firstChoice).join("\n");
  const choices = parseChoices(bodyLines.slice(firstChoice));

  const keys = choices.map((c) => c.key);
  const expected = "ABCDEFGH".slice(0, keys.length).split("");
  if (keys.join("") !== expected.join("")) throw new Error(`${file}: 選択肢は A から順に並べてください (${keys.join("")})`);
  for (const a of meta.answer) {
    if (!keys.includes(a)) throw new Error(`${file}: 正解 ${a} が選択肢にありません`);
  }
  if (!explain.trim()) throw new Error(`${file}: ## 解説 がありません`);

  // 問題文のうち title= 付きの java コードは、検証の @stem でそのままファイルとして使う
  const stemFiles = [];
  const fenceRe = /^```java[^\n]*\btitle=(\S+)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
  let fm2;
  while ((fm2 = fenceRe.exec(stemMd))) stemFiles.push({ name: fm2[1], text: fm2[2] });

  return {
    stemFiles,
    answer: meta.answer,
    refs: meta.refs,
    stemHtml: renderBlocks(stemMd.trim(), { numberJava: true }),
    choices,
    explainHtml: renderBlocks(explain.trim()),
    verifySource: verify.trim(),
  };
}
