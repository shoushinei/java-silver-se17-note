/* 受験記録の書き出し・読み込み（JSON ファイル）。試験のページと一覧のページで共通。

   受験記録はブラウザ（localStorage）にだけ保存されるので、別のパソコンやブラウザの記録は見えない。
   書き出したファイルを別の端末で読み込むと、その端末の記録に「足す」ことができる。

   ファイルの形
     { "format": "java-silver-exam-records", "version": 1, "exportedAt": "2026-10-07T12:00:00.000Z",
       "exams": { "03": { "title": "自作模擬試験 3", "records": [ 受験記録, ... ] } } }
   受験記録の形は exam.js の history と同じ。ただし serverId（その端末の backend の番号）は書き出さない。
   手で入力した回は marks（{ "問番号": "ok" | "ng" | "none" }）で ○× を持ち、answers は空。

   読み込みは足すだけで、今ある記録は消さない。日時・得点・回答が同じ回は登録済みとして飛ばす。
   足したあとは、受けた日時の古い順に通し番号（第N回）を振り直す。 */
var ExamRecords = (function () {
  var PREFIX = "java-silver-exam:";
  var FORMAT = "java-silver-exam-records";
  var MAX = 100;

  function read(id, k) {
    try { return JSON.parse(localStorage.getItem(PREFIX + id + ":" + k)); } catch (e) { return null; }
  }
  function write(id, k, v) {
    try { localStorage.setItem(PREFIX + id + ":" + k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function isInt(v) { return typeof v === "number" && isFinite(v) && Math.floor(v) === v; }

  // 受けた日時の古い順に 第1回, 第2回 … を振り直し、新しい順に並べて返す。別の端末の回を足すと日時が前後するため
  function renumber(list) {
    list.sort(function (a, b) { return a.at - b.at; }).forEach(function (r, i) { r.no = i + 1; });
    return list.reverse();
  }

  // ファイルから来た 1 回分を、決まった形の値だけに整える。形が合わなければ null
  function clean(r) {
    if (!r || typeof r !== "object") return null;
    if (!isInt(r.total) || r.total < 1 || r.total > 500) return null;
    if (!isInt(r.correct) || r.correct < 0 || r.correct > r.total) return null;
    if (typeof r.at !== "number" || !isFinite(r.at) || r.at <= 0) return null;
    var out = {
      at: r.at,
      usedMs: typeof r.usedMs === "number" && isFinite(r.usedMs) && r.usedMs >= 0 ? r.usedMs : null,
      correct: r.correct,
      total: r.total,
      rate: r.correct / r.total,
      passed: r.passed === true,
      answers: {},
      flags: [],
      timeUp: r.timeUp === true,
      pauses: isInt(r.pauses) && r.pauses >= 0 ? r.pauses : 0,
      notes: {},
    };
    var key = function (k) { return /^\d+$/.test(k) && +k >= 1 && +k <= r.total; };
    if (r.answers && typeof r.answers === "object") Object.keys(r.answers).forEach(function (k) {
      var a = r.answers[k];
      if (key(k) && Array.isArray(a)) out.answers[k] = a.filter(function (x) { return /^[A-H]$/.test(x); });
    });
    if (Array.isArray(r.flags)) out.flags = r.flags.filter(function (n) { return isInt(n) && n >= 1 && n <= r.total; });
    if (r.notes && typeof r.notes === "object") Object.keys(r.notes).forEach(function (k) {
      if (key(k) && typeof r.notes[k] === "string" && r.notes[k].trim()) out.notes[k] = r.notes[k].slice(0, 5000);
    });
    if (r.marks && typeof r.marks === "object") {
      out.marks = {};
      Object.keys(r.marks).forEach(function (k) {
        if (key(k) && /^(ok|ng|none)$/.test(r.marks[k])) out.marks[k] = r.marks[k];
      });
    }
    if (r.origin === "manual" || r.origin === "import") out.origin = r.origin;
    return out;
  }

  // 同じ回かどうかの見分け方（日時・得点・回答がすべて同じ）
  function sig(r) {
    return [r.at, r.correct, r.total, JSON.stringify(r.marks || r.answers || {})].join("|");
  }

  // exams: [{ id, title }]。記録が 1 回も無い試験はファイルに入れない
  function pack(exams) {
    var out = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), exams: {} };
    exams.forEach(function (e) {
      var h = read(e.id, "history") || [];
      if (!h.length) return;
      out.exams[e.id] = {
        title: e.title,
        records: h.map(function (r) {
          var c = {};
          Object.keys(r).forEach(function (k) { if (k !== "serverId") c[k] = r[k]; });
          return c;
        }),
      };
    });
    return out;
  }
  function count(file) {
    return Object.keys(file.exams).reduce(function (n, id) { return n + file.exams[id].records.length; }, 0);
  }

  function fileName(label) {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return "java-silver-records-" + label + "-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + ".json";
  }
  function download(obj, name) {
    var blob = new Blob([JSON.stringify(obj, null, 2) + "\n"], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function parse(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error("JSON として読めないファイルです。"); }
    if (!obj || obj.format !== FORMAT || !obj.exams || typeof obj.exams !== "object") {
      throw new Error("このノートの受験記録のファイルではありません（「記録を書き出す」で作ったファイルを選んでください）。");
    }
    return obj;
  }

  // 読み込んだファイルの記録を、このブラウザの記録に足す。試験ごとの結果を返す
  function merge(obj) {
    return Object.keys(obj.exams).filter(function (id) { return /^[\w-]+$/.test(id); }).sort().map(function (id) {
      var src = obj.exams[id] || {};
      var list = read(id, "history") || [];
      var have = {};
      list.forEach(function (r) { have[sig(r)] = true; });
      var res = { id: id, title: typeof src.title === "string" ? src.title : "試験 " + id, added: 0, skipped: 0, invalid: 0 };
      var incoming = (Array.isArray(src.records) ? src.records : []).map(function (r) {
        var c = clean(r);
        if (!c) res.invalid++;
        return c;
      }).filter(Boolean).sort(function (a, b) { return a.at - b.at; });
      var ats = {};
      list.forEach(function (r) { ats[r.at] = true; });
      incoming.forEach(function (r) {
        var s = sig(r);
        if (have[s]) { res.skipped++; return; }
        have[s] = true;
        while (ats[r.at]) r.at++;          // 記録は日時で見分けるので、同じ日時の別の回は 1 ミリ秒ずらす
        ats[r.at] = true;
        if (!r.origin) r.origin = "import";
        list.push(r);
        res.added++;
      });
      if (res.added) {
        list = renumber(list).slice(0, MAX);
        if (!write(id, "history", list) || !write(id, "seq", list.length ? list[0].no : 0)) res.failed = true;
      }
      return res;
    });
  }

  // 読み込み結果を、画面に出す文にする
  function summary(results) {
    if (!results.length) return "<p>このファイルには受験記録が入っていませんでした。</p>";
    return "<ul class=\"imp-list\">" + results.map(function (r) {
      var parts = ["<b>" + r.added + " 回分を追加</b>"];
      if (r.skipped) parts.push(r.skipped + " 回分は登録済みのため飛ばしました");
      if (r.invalid) parts.push(r.invalid + " 回分は形が合わず読めませんでした");
      if (r.failed) parts.push("ブラウザに保存できませんでした");
      return "<li>" + r.title.replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }) + "：" + parts.join("、") + "</li>";
    }).join("") + "</ul>";
  }

  // <input type="file"> で選んだファイルを読み込む
  function importFile(file, done) {
    var fr = new FileReader();
    fr.onload = function () {
      try { done(null, merge(parse(String(fr.result)))); } catch (e) { done(e); }
    };
    fr.onerror = function () { done(new Error("ファイルを読めませんでした。")); };
    fr.readAsText(file);
  }

  return { renumber: renumber, pack: pack, count: count, fileName: fileName, download: download, parse: parse, merge: merge, summary: summary, importFile: importFile };
})();
