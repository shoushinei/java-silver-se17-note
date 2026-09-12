#!/usr/bin/env node
/**
 * 模擬試験の各問題に書いた「検証」を実際に javac / java で実行し、
 * 問題と解説が主張している結果になるかを確かめる。
 *
 *   node tools/verify-exams.mjs          すべての試験
 *   node tools/verify-exams.mjs 01       試験 01 だけ
 *   node tools/verify-exams.mjs 01 7     試験 01 の 問7 だけ
 *
 * JDK が必要（javac / java が PATH にあること）。言語仕様は --release 17 に固定する。
 *
 * 問題ファイルの「## 検証」の書き方:
 *
 *   @case 名前                  ケースの始まり。ケースごとに空のフォルダで実行する
 *   @stem                       問題文にある title= 付きの java コードを、そのファイル名で置く
 *   @file Main.java             以降の行をこのファイルに書く（a/A.java のように階層も可）。
 *                               @stem の後に同名で書けば、そのファイルだけ差し替わる
 *   @javac                      すべての .java をコンパイル。成功を期待する
 *   @javac-error [文字列]       コンパイル失敗を期待する（文字列はエラー出力に含まれること）
 *   @run Main 引数...           java -cp out Main を実行（"A B" のような引用符も可）
 *   @stdout                     直前の実行の標準出力。@end までの行と完全一致を期待する
 *   @exception 例外名           直前の実行がこの例外で落ちることを期待する
 *   @sh コマンド                シェルで実行（-d や -cp を試す問題用）
 *   @fails                      直前の @sh が失敗（終了コード 0 以外）することを期待する
 *   @only-jdk 17                その JDK のときだけ残りを実行（違えばこのケースは skip）。
 *                               ソース実行モードのように、Java 17 より後で動きが変わったもの用
 */
import { readdir, readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseQuestion } from "./exam-md.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXAMS = path.join(ROOT, "src", "exams");
const JAVA_OPTS = ["-Duser.language=en", "-Duser.country=US", "-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8"];
const JDK = (() => {
  const r = spawnSync("java", ["-version"], { encoding: "utf8" });
  const m = ((r.stderr || "") + (r.stdout || "")).match(/version "(\d+)/);
  return m ? +m[1] : 0;
})();

function tokenize(s) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

function parseCases(src) {
  const cases = [];
  let cur = null;
  let block = null;           // { kind: "file" | "stdout", name, lines }
  const endBlock = () => {
    if (!block) return;
    if (block.kind === "file") cur.files.push({ name: block.name, text: block.lines.join("\n") + "\n" });
    else cur.steps.push({ op: "stdout", text: block.lines.join("\n") });
    block = null;
  };
  for (const line of src.split("\n")) {
    const d = line.match(/^@(\S+)\s*(.*)$/);
    if (!d || (block && block.kind === "stdout" && d[1] !== "end")) {
      if (block) block.lines.push(line);
      else if (line.trim()) throw new Error("検証の書式が読めない行: " + line);
      continue;
    }
    const [, op, arg] = d;
    if (op === "end") { endBlock(); continue; }
    endBlock();
    if (op === "case") { cur = { name: arg, files: [], steps: [] }; cases.push(cur); continue; }
    if (!cur) throw new Error("@case より前に " + line);
    if (op === "stem") cur.useStem = true;
    else if (op === "file") block = { kind: "file", name: arg, lines: [] };
    else if (op === "stdout") block = { kind: "stdout", lines: [] };
    else cur.steps.push({ op, arg });
  }
  endBlock();
  return cases;
}

async function listJava(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "out") out.push(...await listJava(p, base)); }
    else if (e.name.endsWith(".java")) out.push(path.relative(base, p));
  }
  return out;
}

async function runCase(c, stemFiles) {
  const dir = await mkdtemp(path.join(tmpdir(), "exam-verify-"));
  const fail = (msg) => ({ ok: false, msg });
  try {
    const files = new Map();
    if (c.useStem) for (const f of stemFiles) files.set(f.name, f.text);
    for (const f of c.files) files.set(f.name, f.text);
    for (const [name, text] of files) {
      const f = { name, text };
      const p = path.join(dir, f.name);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, f.text, "utf8");
    }
    let last = null;
    for (const s of c.steps) {
      if (s.op === "javac" || s.op === "javac-error") {
        const files = await listJava(dir);
        const r = spawnSync("javac", ["-J-Duser.language=en", "--release", "17", "-encoding", "UTF-8", "-d", "out", ...files], { cwd: dir, encoding: "utf8" });
        const err = (r.stderr || "") + (r.stdout || "");
        if (s.op === "javac" && r.status !== 0) return fail("コンパイルが通るはずが失敗:\n" + err);
        if (s.op === "javac-error") {
          if (r.status === 0) return fail("コンパイルエラーのはずが通った");
          if (s.arg && !err.includes(s.arg)) return fail(`エラーに「${s.arg}」が含まれない:\n` + err);
        }
      } else if (s.op === "run") {
        const [cls, ...args] = tokenize(s.arg);
        last = spawnSync("java", [...JAVA_OPTS, "-cp", "out", cls, ...args], { cwd: dir, encoding: "utf8" });
      } else if (s.op === "sh") {
        last = spawnSync(s.arg, { cwd: dir, encoding: "utf8", shell: true });
      } else if (s.op === "stdout") {
        if (!last) return fail("@stdout の前に実行がない");
        const got = (last.stdout || "").replace(/\r\n/g, "\n").replace(/\n$/, "");
        if (last.status !== 0) return fail("正常終了のはずが失敗:\n" + last.stderr);
        if (got !== s.text) return fail(`出力が違う\n  期待: ${JSON.stringify(s.text)}\n  実際: ${JSON.stringify(got)}`);
      } else if (s.op === "exception") {
        if (!last) return fail("@exception の前に実行がない");
        if (last.status === 0) return fail(`${s.arg} で落ちるはずが正常終了: ${JSON.stringify(last.stdout)}`);
        if (!(last.stderr || "").includes(s.arg)) return fail(`${s.arg} ではなく:\n` + last.stderr);
      } else if (s.op === "only-jdk") {
        if (JDK !== +s.arg) return { ok: true, skipped: `JDK ${JDK} では確かめられないので skip（JDK ${s.arg} の CI で確認）` };
      } else if (s.op === "fails") {
        if (!last || last.status === 0) return fail("失敗するはずのコマンドが成功した");
      } else {
        return fail("知らない命令 @" + s.op);
      }
    }
    return { ok: true };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const [onlyExam, onlyQ] = process.argv.slice(2);
const ids = (await readdir(EXAMS, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && (!onlyExam || d.name === onlyExam))
  .map((d) => d.name).sort();

let bad = 0, total = 0, noVerify = [];
for (const id of ids) {
  const files = (await readdir(path.join(EXAMS, id))).filter((n) => /^q\d+\.md$/.test(n)).sort();
  for (const f of files) {
    const no = +f.match(/\d+/)[0];
    if (onlyQ && no !== +onlyQ) continue;
    const q = parseQuestion(await readFile(path.join(EXAMS, id, f), "utf8"), `${id}/${f}`);
    const cases = parseCases(q.verifySource);
    if (!cases.length) { noVerify.push(`${id}/${f}`); continue; }
    for (const c of cases) {
      total++;
      const r = await runCase(c, q.stemFiles);
      if (r.skipped) console.log(`  skip ${id}/${f}  ${c.name}  … ${r.skipped}`);
      else if (r.ok) console.log(`  ok   ${id}/${f}  [正解 ${q.answer.join(",")}]  ${c.name}`);
      else { bad++; console.log(`  NG   ${id}/${f}  ${c.name}\n       ${r.msg.replace(/\n/g, "\n       ")}`); }
    }
  }
}
console.log(`\n${total - bad} / ${total} ケース成功` + (noVerify.length ? `　検証なし: ${noVerify.join(", ")}` : ""));
if (bad || noVerify.length) process.exit(1);
