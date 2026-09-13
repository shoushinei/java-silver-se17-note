/* 模擬試験ページの動き。テストのページ（index.html）と振り返りのページ（review.html）で共通。
   問題の HTML はビルド時にすべてページへ書き出してあり、ここでは
   1 問ずつの表示・問題一覧・回答の記録・時間の管理・採点・受験記録を扱う。

   画面（body のクラス）
     mode-intro   開始前の説明と受験記録（テストのページだけ）
     mode-test    受験中
     mode-result  採点結果。「結果の概要」（at-summary）と、1 問ずつの見直しを行き来する
     mode-review  振り返りのページ

   保存（localStorage。キーは java-silver-exam:<試験ID>:...）
     session  受験中の状態。再読み込みしても続きから再開できる
     history  受験記録（新しい順、最大 100 回）。得点・選んだ答え・見直しマーク・振り返りメモ
     seq      受験回の通し番号
   制限時間は開始時刻から計算するので、タブを閉じても時間は進む（本番と同じ）。 */
(function () {
  var meta = JSON.parse(document.getElementById("exam-meta").textContent);
  var KEY = "java-silver-exam:" + meta.id + ":";
  var LIMIT_MS = meta.minutes * 60 * 1000;
  var MAX_HISTORY = 100;

  function load(k) {
    try { return JSON.parse(localStorage.getItem(KEY + k)); } catch (e) { return null; }
  }
  function save(k, v) {
    try { localStorage.setItem(KEY + k, JSON.stringify(v)); return true; } catch (e) { return false; /* 保存できなくても受験は続けられる */ }
  }
  function drop(k) {
    try { localStorage.removeItem(KEY + k); } catch (e) { /* 同上 */ }
  }

  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;
  var qs = Array.prototype.map.call(document.querySelectorAll("#qlist .q"), function (el) {
    return {
      el: el,
      no: +el.dataset.no,
      answer: el.dataset.answer.split(","),
      pick: +el.dataset.pick,
      ch: el.dataset.ch,
      choices: Array.prototype.slice.call(el.querySelectorAll(".choice")),
      flagBtn: el.querySelector(".flag"),
      hint: el.querySelector(".pickhint"),
      memo: null,
    };
  });
  var N = qs.length;
  var mode = "";
  var cur = 1;           // 表示中の問題番号。採点結果では 0 が「結果の概要」
  var filter = "all";    // 問題一覧の絞り込み
  var S = null;          // 受験中の状態 { startedAt, answers: {no: [key...]}, flags: [no...], cur, submitted }
  var R = null;          // 表示中の受験記録（history の 1 件）
  var timerId = null;

  /* ---------------- 共通 ---------------- */

  function setMode(m) {
    mode = m;
    body.className = body.className.replace(/\bmode-\w+|\bat-summary\b/g, "").replace(/\s+/g, " ").trim() + " mode-" + m;
    window.scrollTo(0, 0);
  }
  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    return (m < 10 ? "0" : "") + m + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
  }
  function fmtDate(t) {
    var d = new Date(t);
    return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " " +
           d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
  }
  function sameSet(a, b) {
    return a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; });
  }
  function setHash(h) {
    try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (e) { /* file:// などで失敗しても表示には影響しない */ }
  }

  // 受験中は S、採点結果では R を見る
  function picked(no) {
    var src = mode === "result" ? R : S;
    return (src && src.answers[no]) || [];
  }
  function flags() {
    var src = mode === "result" ? R : S;
    return (src && src.flags) || [];
  }
  function isFlagged(no) { return flags().indexOf(no) >= 0; }
  function status(q) {           // 採点結果での状態
    var sel = picked(q.no);
    return sel.length === 0 ? "none" : sameSet(sel, q.answer) ? "ok" : "ng";
  }

  /* ---------------- 受験記録 ---------------- */

  function historyList() {
    var h = load("history") || [];
    // 通し番号が無い古い記録には、古い順に番号を振っておく
    if (h.some(function (x) { return !x.no; })) {
      var asc = h.slice().sort(function (a, b) { return a.at - b.at; });
      var seq = 0;
      asc.forEach(function (x) { seq = x.no ? Math.max(seq, x.no) : seq + 1; if (!x.no) x.no = seq; });
      save("history", h);
      if ((load("seq") || 0) < seq) save("seq", seq);
    }
    return h;
  }
  function updateRecord(rec) {
    var h = historyList();
    for (var i = 0; i < h.length; i++) if (h[i].at === rec.at) { h[i] = rec; break; }
    return save("history", h);
  }

  function renderHistory() {
    var h = historyList();
    var box = $("history");
    if (!box) return;
    if (!h.length) { box.innerHTML = '<p class="empty">まだ受験記録はありません。</p>'; return; }
    var best = h.reduce(function (m, x) { return x.correct > m.correct ? x : m; }, h[0]);
    var rows = h.map(function (r) {
      var memo = r.notes ? Object.keys(r.notes).filter(function (k) { return r.notes[k]; }).length : 0;
      return '<tr' + (r === best ? ' class="best"' : "") + '><td class="n">第' + r.no + "回</td><td>" + fmtDate(r.at) + "</td>" +
             "<td><b>" + r.correct + "</b> / " + r.total + "（" + Math.round(r.rate * 100) + "%）" + (r === best && h.length > 1 ? ' <span class="tag-best">最高</span>' : "") + "</td>" +
             '<td class="' + (r.passed ? "pass" : "fail") + '">' + (r.passed ? "合格" : "不合格") + "</td>" +
             "<td>" + fmt(r.usedMs) + (r.timeUp ? "（時間切れ）" : "") + "</td>" +
             "<td>" + (memo ? "メモ " + memo + " 件" : "") + "</td>" +
             '<td class="ops"><button type="button" class="btn" data-open="' + r.at + '">結果を開く</button>' +
             '<button type="button" class="btn ghost del" data-del="' + r.at + '" aria-label="第' + r.no + '回の記録を削除">削除</button></td></tr>';
    }).join("");
    box.innerHTML = '<div class="tw"><table class="history"><thead><tr><th>回</th><th>日時</th><th>得点</th><th>判定</th><th>所要時間</th><th>メモ</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>";
  }

  if ($("history")) $("history").addEventListener("click", function (e) {
    var o = e.target.closest("[data-open]");
    var d = e.target.closest("[data-del]");
    var h = historyList();
    if (o) {
      var r = h.filter(function (x) { return x.at === +o.dataset.open; })[0];
      if (r) openResult(r, 0);
    } else if (d) {
      var t = h.filter(function (x) { return x.at === +d.dataset.del; })[0];
      if (!t) return;
      showModal("<h2>第" + t.no + "回の記録を削除しますか？</h2><p>" + fmtDate(t.at) + " の受験（" + t.correct + " / " + t.total + "）の結果と振り返りメモが消えます。元に戻せません。</p>" +
                '<div class="actions"><button type="button" class="btn" data-close>やめる</button>' +
                '<button type="button" class="btn danger" data-del-ok="' + t.at + '">削除する</button></div>');
    }
  });

  /* ---------------- 開始前の画面 ---------------- */

  function renderIntro() {
    var sess = load("session");
    var resume = $("resume");
    if (sess && !sess.submitted) {
      var left = sess.startedAt + LIMIT_MS - Date.now();
      var done = Object.keys(sess.answers).filter(function (k) { return sess.answers[k].length; }).length;
      resume.hidden = false;
      $("resume-text").textContent = left > 0
        ? "受験の途中です（回答済み " + done + " / " + N + " 問、残り " + fmt(left) + "）。"
        : "前回の受験は制限時間を過ぎています。続きを開くと、その時点の回答で採点します。";
    } else {
      resume.hidden = true;
    }
    renderHistory();
  }
  function toIntro() {
    S = null; R = null;
    clearInterval(timerId);
    setHash("");
    renderIntro();
    setMode("intro");
  }

  /* ---------------- 1 問ずつの表示と問題一覧 ---------------- */

  function passes(q) {
    if (filter === "all") return true;
    if (mode === "test") {
      if (filter === "todo") return picked(q.no).length < q.pick;
      if (filter === "flag") return isFlagged(q.no);
    } else if (mode === "result") {
      if (filter === "wrong") return status(q) !== "ok";
      if (filter === "ok") return status(q) === "ok";
      if (filter === "flag") return isFlagged(q.no);
    } else if (mode === "review") {
      return q.ch === filter;
    }
    return true;
  }
  function order() {
    var list = qs.filter(passes).map(function (q) { return q.no; });
    return list.length ? list : qs.map(function (q) { return q.no; });
  }
  function nextOf(no) { var l = order(); for (var i = 0; i < l.length; i++) if (l[i] > no) return l[i]; return 0; }
  function prevOf(no) { var l = order(); for (var i = l.length - 1; i >= 0; i--) if (l[i] < no) return l[i]; return 0; }

  function go(no) {
    if (mode === "result" && no === 0) {
      cur = 0;
      body.classList.add("at-summary");
    } else {
      cur = Math.max(1, Math.min(N, no));
      body.classList.remove("at-summary");
    }
    qs.forEach(function (q) { q.el.classList.toggle("is-cur", q.no === cur); });
    if (mode === "test") { S.cur = cur; save("session", S); }
    if (mode === "result") setHash("r" + R.at + (cur ? "-q" + cur : ""));
    if (mode === "review") setHash(cur > 1 ? "q" + cur : "");
    paintPager();
    paintGrid();
    closeNav();
    window.scrollTo(0, 0);
  }

  function paintPager() {
    var p = prevOf(cur), n = nextOf(cur);
    $("prev").disabled = mode === "result" ? cur === 0 : !p;
    if (mode === "test" && !n) $("next").textContent = "提出へ";
    else $("next").textContent = "次へ →";
    $("next").disabled = mode !== "test" && !n;
    var inFilter = filter !== "all" && qs.filter(passes).length;
    var l = order();
    $("pos").textContent = cur ? (inFilter ? "絞り込み中 " + (l.indexOf(cur) + 1 || "-") + " / " + l.length + "　" : "") + "問 " + cur + " / " + N : "";
  }
  $("prev").addEventListener("click", function () {
    var p = prevOf(cur);
    if (p) go(p); else if (mode === "result") go(0);
  });
  $("next").addEventListener("click", function () {
    var n = nextOf(cur);
    if (n) go(n); else if (mode === "test") openSubmit();
  });

  var FILTERS = {
    test: [["all", "すべて"], ["todo", "未回答"], ["flag", "見直しマーク"]],
    result: [["all", "すべて"], ["wrong", "不正解・未回答"], ["ok", "正解"], ["flag", "見直しマーク"]],
  };
  var LEGENDS = {
    test: '<span><i class="l-done"></i>回答済み</span><span><i class="l-part"></i>選ぶ数が不足</span><span><i class="l-flag"></i>見直し</span>',
    result: '<span><i class="l-ok">○</i>正解</span><span><i class="l-ng">×</i>不正解</span><span><i class="l-none">−</i>未回答</span><span><i class="l-flag"></i>見直し</span>',
    review: "",
  };
  function paintFilters() {
    var list = FILTERS[mode] || [["all", "すべて"]].concat(Object.keys(meta.chapters).map(function (k) { return [k, "第" + k.slice(1) + "章"]; }));
    $("navfilter").innerHTML = list.map(function (f) {
      return '<button type="button" data-filter="' + f[0] + '" aria-pressed="' + (f[0] === filter) + '">' + f[1] + "</button>";
    }).join("");
    $("legend").innerHTML = LEGENDS[mode] || "";
    $("legend").hidden = !LEGENDS[mode];
  }
  function setFilter(f) {
    filter = f;
    Array.prototype.forEach.call($("navfilter").querySelectorAll("[data-filter]"), function (x) { x.setAttribute("aria-pressed", String(x.dataset.filter === f)); });
    paintGrid();
    paintPager();
  }

  function paintGrid() {
    var html = qs.map(function (q) {
      if (!passes(q)) return "";
      var cls = "cell", mk = "", label = "問" + q.no;
      if (mode === "test") {
        var n = picked(q.no).length;
        cls += n === 0 ? "" : n < q.pick ? " partial" : " done";
        label += n ? " 回答済み" : " 未回答";
      } else if (mode === "result") {
        var st = status(q);
        cls += " " + st;
        mk = '<span class="mk" aria-hidden="true">' + { ok: "○", ng: "×", none: "−" }[st] + "</span>";
        label += { ok: " 正解", ng: " 不正解", none: " 未回答" }[st];
      }
      if (isFlagged(q.no)) { cls += " flagged"; label += " 見直しマーク"; }
      if (q.no === cur) cls += " cur";
      return '<button type="button" class="' + cls + '" data-go="' + q.no + '" aria-label="' + label + '"' + (q.no === cur ? ' aria-current="true"' : "") + ">" + q.no + mk + "</button>";
    }).join("");
    $("grid").innerHTML = html || '<p class="empty">該当する問題はありません。</p>';
    if (mode === "test") {
      var answered = qs.filter(function (q) { return picked(q.no).length; }).length;
      $("count").textContent = "回答 " + answered + " / " + N;
      $("flagcount").textContent = S.flags.length ? "マーク " + S.flags.length : "";
    }
    $("tosum").setAttribute("aria-current", String(mode === "result" && cur === 0));
  }
  $("grid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-go]");
    if (b) go(+b.dataset.go);
  });
  $("navfilter").addEventListener("click", function (e) {
    var b = e.target.closest("[data-filter]");
    if (!b) return;
    setFilter(b.dataset.filter);
    // 見ている問題が絞り込みから外れたら、絞り込みの先頭へ
    var q = qs[cur - 1];
    if (cur && q && !passes(q) && qs.some(passes)) go(order()[0]);
  });
  $("tosum").addEventListener("click", function () { go(0); });

  // 狭い画面では下から出すシート
  function openNav() { $("navside").classList.add("open"); $("scrim").hidden = false; }
  function closeNav() { $("navside").classList.remove("open"); $("scrim").hidden = true; }
  $("navopen").addEventListener("click", openNav);
  $("navclose").addEventListener("click", closeNav);
  $("scrim").addEventListener("click", closeNav);

  document.addEventListener("keydown", function (e) {
    if (mode === "intro" || !$("modal").hidden) return;
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowLeft") { $("prev").click(); e.preventDefault(); }
    else if (e.key === "ArrowRight") { if (mode !== "test" || nextOf(cur)) $("next").click(); e.preventDefault(); }
    else if (mode === "test") {
      var q = qs[cur - 1];
      if (/^[a-hA-H]$/.test(e.key)) {
        var key = e.key.toUpperCase();
        if (q.choices.some(function (c) { return c.dataset.key === key; })) choose(q, key);
      } else if (e.key === "m" || e.key === "M") { toggleFlag(q); }
    }
  });

  /* ---------------- 受験 ---------------- */

  function clearMarks() {
    qs.forEach(function (q) {
      q.choices.forEach(function (c) {
        c.classList.remove("is-answer", "is-picked", "is-sel");
        var you = c.querySelector(".you");
        if (you) you.remove();
      });
      var v = q.el.querySelector(".verdict");
      if (v) { v.className = "verdict"; v.textContent = ""; }
      var fm = q.el.querySelector(".flagmark");
      if (fm) fm.hidden = true;
    });
  }

  function start(fresh) {
    if (fresh || !S) {
      S = { startedAt: Date.now(), answers: {}, flags: [], cur: 1, submitted: false };
      save("session", S);
    }
    R = null;
    clearMarks();
    setMode("test");
    setHash("");
    filter = "all";
    paintFilters();
    qs.forEach(function (q) {
      q.choices.forEach(function (c) { c.setAttribute("tabindex", "0"); });
      paintChoices(q);
      paintFlag(q);
    });
    go(S.cur || 1);
    tick();
    clearInterval(timerId);
    timerId = setInterval(tick, 1000);
  }

  function tick() {
    if (!S || mode !== "test") return;
    var left = S.startedAt + LIMIT_MS - Date.now();
    var t = $("timer");
    t.textContent = fmt(left);
    t.classList.toggle("warn", left <= 10 * 60 * 1000 && left > 3 * 60 * 1000);
    t.classList.toggle("danger", left <= 3 * 60 * 1000);
    if (left <= 0) submit(true);
  }
  // 別のタブから戻ったときもすぐに時計を合わせる
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });

  function paintChoices(q) {
    var sel = picked(q.no);
    q.choices.forEach(function (c) {
      var on = sel.indexOf(c.dataset.key) >= 0;
      c.classList.toggle("is-sel", on);
      c.setAttribute("aria-checked", String(on));
    });
    if (q.hint) q.hint.textContent = "";
  }
  function paintFlag(q) { if (q.flagBtn) q.flagBtn.setAttribute("aria-pressed", String(isFlagged(q.no))); }

  function choose(q, key) {
    var sel = picked(q.no).slice();
    var i = sel.indexOf(key);
    if (q.pick === 1) {
      sel = i >= 0 ? [] : [key];
    } else if (i >= 0) {
      sel.splice(i, 1);
    } else if (sel.length >= q.pick) {
      q.hint.textContent = q.pick + " つまで選べます。先にどれかの選択を外してください。";
      return;
    } else {
      sel.push(key);
    }
    S.answers[q.no] = sel.sort();
    save("session", S);
    paintChoices(q);
    paintGrid();
  }

  function toggleFlag(q) {
    var i = S.flags.indexOf(q.no);
    if (i >= 0) S.flags.splice(i, 1); else S.flags.push(q.no);
    save("session", S);
    paintFlag(q);
    paintGrid();
  }

  qs.forEach(function (q) {
    q.choices.forEach(function (c) {
      c.setAttribute("role", q.pick === 1 ? "radio" : "checkbox");
      c.addEventListener("click", function (e) {
        if (mode !== "test") return;
        if (e.target.closest("a")) return;
        choose(q, c.dataset.key);
      });
      c.addEventListener("keydown", function (e) {
        if (mode === "test" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choose(q, c.dataset.key); }
      });
    });
    if (q.flagBtn) q.flagBtn.addEventListener("click", function () { if (mode === "test") toggleFlag(q); });
  });

  /* ---------------- 提出 ---------------- */

  function chipList(nos) {
    return nos.map(function (n) { return '<button type="button" data-jump="' + n + '">問' + n + "</button>"; }).join("");
  }
  function openSubmit() {
    if (mode !== "test" || !S) return;
    var none = [], short = [];
    qs.forEach(function (q) {
      var n = picked(q.no).length;
      if (n === 0) none.push(q.no); else if (n < q.pick) short.push(q.no);
    });
    var html = "<h2>解答を提出しますか？</h2>";
    if (none.length || short.length) {
      html += '<div class="warnbox">まだ ' + (none.length + short.length) + " 問が解答し終わっていません。提出すると、これらは不正解として採点されます。</div>";
      if (none.length) html += "<p>未回答（" + none.length + " 問）</p><div class=\"chips\">" + chipList(none) + "</div>";
      if (short.length) html += "<p>選ぶ数が足りない（" + short.length + " 問）</p><div class=\"chips\">" + chipList(short) + "</div>";
    } else {
      html += "<p>すべての問題に回答しています。</p>";
    }
    if (S.flags.length) {
      html += "<p>見直しマークを付けた問題（" + S.flags.length + " 問）</p><div class=\"chips\">" + chipList(S.flags.slice().sort(function (a, b) { return a - b; })) + "</div>";
    }
    html += "<p>残り時間 <b>" + fmt(S.startedAt + LIMIT_MS - Date.now()) + "</b></p>";
    html += '<div class="actions"><button type="button" class="btn" data-close>問題に戻る</button>' +
            '<button type="button" class="btn ' + (none.length || short.length ? "danger" : "primary") + '" data-submit>' +
            (none.length || short.length ? "このまま提出する" : "提出する") + "</button></div>";
    showModal(html);
  }
  $("submit").addEventListener("click", openSubmit);

  function showModal(html) {
    $("dialog").innerHTML = html;
    $("modal").hidden = false;
    var b = $("dialog").querySelector("[data-close], [data-ok]");
    if (b) b.focus();
  }
  function hideModal() { $("modal").hidden = true; }
  $("modal").addEventListener("click", function (e) {
    if (e.target === this || e.target.closest("[data-close]") || e.target.closest("[data-ok]")) { hideModal(); return; }
    var j = e.target.closest("[data-jump]");
    if (j) { hideModal(); go(+j.dataset.jump); return; }
    if (e.target.closest("[data-submit]")) { hideModal(); submit(false); return; }
    if (e.target.closest("#restart-ok")) { hideModal(); drop("session"); S = null; start(true); return; }
    var d = e.target.closest("[data-del-ok]");
    if (d) {
      save("history", historyList().filter(function (x) { return x.at !== +d.dataset.delOk; }));
      hideModal();
      renderHistory();
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("modal").hidden) hideModal(); });

  function submit(timeUp) {
    if (!S || S.submitted) return;
    clearInterval(timerId);
    var endedAt = Math.min(Date.now(), S.startedAt + LIMIT_MS);
    var right = qs.filter(function (q) { return sameSet(picked(q.no), q.answer); }).length;
    var seq = Math.max(load("seq") || 0, historyList().reduce(function (m, x) { return Math.max(m, x.no || 0); }, 0)) + 1;
    var rec = {
      no: seq,
      at: endedAt,
      usedMs: endedAt - S.startedAt,
      correct: right,
      total: N,
      rate: right / N,
      passed: right / N >= meta.passRate,
      answers: S.answers,
      flags: S.flags,
      timeUp: !!timeUp,
      notes: {},
    };
    var hist = historyList();
    hist.unshift(rec);
    save("history", hist.slice(0, MAX_HISTORY));
    save("seq", seq);
    S.submitted = true;
    drop("session");
    openResult(rec, 0);
    if (timeUp) {
      showModal("<h2>時間切れです</h2><p>制限時間の " + meta.minutes + " 分が経過したため、その時点の回答で採点しました。未回答の問題は不正解として扱っています。</p>" +
                '<div class="actions"><button type="button" class="btn primary" data-ok>結果を見る</button></div>');
    }
  }

  /* ---------------- 採点結果と見直し ---------------- */

  function openResult(r, no) {
    R = r;
    S = null;
    clearInterval(timerId);
    r.notes = r.notes || {};
    setMode("result");
    filter = "all";
    paintFilters();

    qs.forEach(function (q) {
      var sel = r.answers[q.no] || [];
      var st = status(q);
      q.choices.forEach(function (c) {
        var k = c.dataset.key;
        c.classList.remove("is-sel");
        c.classList.toggle("is-answer", q.answer.indexOf(k) >= 0);
        c.classList.toggle("is-picked", sel.indexOf(k) >= 0);
        c.removeAttribute("tabindex");
        var you = c.querySelector(".you");
        if (sel.indexOf(k) >= 0 && !you) { you = document.createElement("span"); you.className = "you"; you.textContent = "あなたの選択"; c.querySelector(".ct").appendChild(you); }
        if (sel.indexOf(k) < 0 && you) you.remove();
      });
      var v = q.el.querySelector(".verdict");
      v.className = "verdict " + st;
      v.textContent = { ok: "○ 正解", ng: "× 不正解", none: "未回答" }[st];
      q.el.querySelector(".flagmark").hidden = !isFlagged(q.no);
      if (!q.memo) q.memo = makeMemo(q);
      q.memo.querySelector("textarea").value = r.notes[q.no] || "";
      q.memo.querySelector(".saved").textContent = "";
    });

    var cnt = { ok: 0, ng: 0, none: 0 };
    qs.forEach(function (q) { cnt[status(q)]++; });
    $("r-score").innerHTML = r.correct + "<small> / " + r.total + "</small>";
    $("r-judge").textContent = r.passed ? "合格ライン到達" : "合格ラインに届かず";
    $("r-judge").className = "judge " + (r.passed ? "pass" : "fail");
    $("r-meta").innerHTML = "第" + r.no + "回 ・ " + fmtDate(r.at) + " に受験<br>" +
      "正答率 <b>" + Math.round(r.rate * 100) + "%</b>（合格ライン " + Math.round(meta.passRate * 100) + "%）<br>" +
      "所要時間 " + fmt(r.usedMs) + " / " + meta.minutes + ":00" + (r.timeUp ? "（時間切れで提出）" : "");
    $("r-tally").innerHTML =
      '<button type="button" data-tally="ok" class="t-ok"><b>○ ' + cnt.ok + "</b>正解</button>" +
      '<button type="button" data-tally="wrong" class="t-ng"><b>× ' + (cnt.ng + cnt.none) + "</b>不正解・未回答" + (cnt.none ? "（未回答 " + cnt.none + "）" : "") + "</button>" +
      '<button type="button" data-tally="flag" class="t-flag"><b>' + (r.flags || []).length + "</b>見直しマーク</button>";
    $("hscore").textContent = "第" + r.no + "回 " + r.correct + " / " + r.total;

    // 章ごとの正答率（どの章を読み直せばよいか）
    var byCh = {};
    qs.forEach(function (q) {
      var c = byCh[q.ch] || (byCh[q.ch] = { ok: 0, n: 0 });
      c.n++;
      if (status(q) === "ok") c.ok++;
    });
    $("r-bars").innerHTML = Object.keys(meta.chapters).filter(function (k) { return byCh[k]; }).map(function (k) {
      var c = byCh[k], p = Math.round(c.ok / c.n * 100);
      return '<div class="bar2"><a href="' + meta.noteHref + "#ch" + k.slice(1) + '">' + meta.chapters[k] + "</a>" +
             '<div class="track"><div class="fill' + (p < meta.passRate * 100 ? " low" : "") + '" style="width:' + p + '%"></div></div>' +
             '<span class="num">' + c.ok + "/" + c.n + "</span></div>";
    }).join("");
    $("review-wrong").hidden = cnt.ng + cnt.none === 0;

    go(no || 0);
  }

  $("r-tally").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tally]");
    if (!b) return;
    setFilter(b.dataset.tally);
    if (qs.some(passes)) go(order()[0]);
  });
  $("review-start").addEventListener("click", function () { setFilter("all"); go(1); });
  $("review-wrong").addEventListener("click", function () { setFilter("wrong"); go(order()[0]); });

  // 振り返りメモ。その回の受験記録に保存する
  function makeMemo(q) {
    var box = document.createElement("div");
    box.className = "memo";
    box.innerHTML = '<label for="memo' + q.no + '">振り返りメモ <small>この回の受験記録に保存されます</small></label>' +
                    '<textarea id="memo' + q.no + '" rows="3" placeholder="なぜ間違えたか、次に気をつけることなど"></textarea><span class="saved" aria-live="polite"></span>';
    q.el.appendChild(box);
    var ta = box.querySelector("textarea"), msg = box.querySelector(".saved"), t = null;
    ta.addEventListener("input", function () {
      if (!R) return;
      clearTimeout(t);
      msg.textContent = "";
      t = setTimeout(function () {
        var v = ta.value.trim();
        if (v) R.notes[q.no] = ta.value; else delete R.notes[q.no];
        msg.textContent = updateRecord(R) ? "保存しました" : "保存できませんでした（ブラウザの保存領域がいっぱいか、無効です）";
      }, 500);
    });
    return box;
  }

  /* ---------------- 振り返りのページ ---------------- */

  function startReview() {
    setMode("review");
    filter = "all";
    paintFilters();
    var m = /^#q(\d+)$/.exec(location.hash);
    go(m ? +m[1] : 1);
  }
  if ($("hide-toggle")) $("hide-toggle").addEventListener("click", function () {
    var b = this, on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    b.textContent = on ? "正解と解説を表示する" : "正解と解説を隠す";
    body.classList.toggle("hide-answers", on);
    qs.forEach(function (q) { q.el.classList.remove("revealed"); });
  });
  $("qlist").addEventListener("click", function (e) {
    var b = e.target.closest(".reveal");
    if (b) b.closest(".q").classList.add("revealed");
  });

  /* ---------------- ボタンと起動 ---------------- */

  if (body.classList.contains("page-review")) {
    startReview();
    return;
  }

  $("start").addEventListener("click", function () {
    var sess = load("session");
    if (sess && !sess.submitted) {
      showModal("<h2>最初から受け直しますか？</h2><p>途中の回答は消えます。</p>" +
                '<div class="actions"><button type="button" class="btn" data-close>やめる</button>' +
                '<button type="button" class="btn danger" id="restart-ok">最初から始める</button></div>');
      return;
    }
    S = null;
    start(true);
  });
  $("resume-btn").addEventListener("click", function () {
    S = load("session");
    if (!S) return;
    if (S.startedAt + LIMIT_MS <= Date.now()) { submit(true); return; }
    start(false);
  });
  $("again").addEventListener("click", function () {
    var sess = load("session");
    if (sess && !sess.submitted) { toIntro(); return; }
    S = null;
    start(true);
  });
  $("to-intro").addEventListener("click", toIntro);

  // #r<記録>-q<問> で開かれたら、その回の結果を開く（再読み込みしても見直しの位置に戻れる）
  var hm = /^#r(\d+)(?:-q(\d+))?$/.exec(location.hash);
  var rec = hm && historyList().filter(function (x) { return x.at === +hm[1]; })[0];
  if (rec) openResult(rec, hm[2] ? +hm[2] : 0);
  else toIntro();
})();
