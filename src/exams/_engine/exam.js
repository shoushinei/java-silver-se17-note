/* 模擬試験（テストモード）の動き。
   問題の HTML はビルド時にすべてページへ書き出してあり、ここでは
   表示の切り替え・回答の記録・時間の管理・採点だけを行う。

   保存（localStorage。キーは java-silver-exam:<試験ID>:...）
     session  受験中の状態。再読み込みしても続きから再開できる
     history  採点結果の履歴（新しい順、最大 20 件）
   制限時間は開始時刻から計算するので、タブを閉じても時間は進む（本番と同じ）。 */
(function () {
  var meta = JSON.parse(document.getElementById("exam-meta").textContent);
  var KEY = "java-silver-exam:" + meta.id + ":";
  var LIMIT_MS = meta.minutes * 60 * 1000;

  function load(k) {
    try { return JSON.parse(localStorage.getItem(KEY + k)); } catch (e) { return null; }
  }
  function save(k, v) {
    try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても受験は続けられる */ }
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
    };
  });
  var S = null;          // 受験中の状態 { startedAt, answers: {no: [key...]}, flags: [no...], cur }
  var timerId = null;

  /* ---------------- 共通 ---------------- */

  function setMode(m) {
    body.className = body.className.replace(/\bmode-\w+/g, "").trim() + " mode-" + m;
    window.scrollTo(0, 0);
  }
  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    return (m < 10 ? "0" : "") + m + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
  }
  function picked(no) { return (S && S.answers[no]) || []; }
  function isFlagged(no) { return !!S && S.flags.indexOf(no) >= 0; }
  function sameSet(a, b) {
    return a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; });
  }

  /* ---------------- 開始前の画面 ---------------- */

  function renderIntro() {
    var sess = load("session");
    var resume = $("resume");
    if (sess && !sess.submitted) {
      var left = sess.startedAt + LIMIT_MS - Date.now();
      var done = Object.keys(sess.answers).filter(function (k) { return sess.answers[k].length; }).length;
      resume.hidden = false;
      $("resume-text").textContent = left > 0
        ? "受験の途中です（回答済み " + done + " / " + qs.length + " 問、残り " + fmt(left) + "）。"
        : "前回の受験は制限時間を過ぎています。続きを開くと、その時点の回答で採点します。";
    } else {
      resume.hidden = true;
    }
    var hist = load("history") || [];
    var box = $("history");
    if (!hist.length) { box.innerHTML = '<p class="empty">まだ受験記録はありません。</p>'; return; }
    var rows = hist.slice(0, 8).map(function (h, i) {
      var d = new Date(h.at);
      var date = d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " " +
                 d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
      return "<tr><td>" + date + "</td><td><b>" + h.correct + "</b> / " + h.total + "（" + Math.round(h.rate * 100) + "%）</td>" +
             '<td class="' + (h.passed ? "pass" : "fail") + '">' + (h.passed ? "合格" : "不合格") + "</td>" +
             "<td>" + fmt(h.usedMs) + "</td>" +
             '<td><button type="button" class="btn ghost" data-hist="' + i + '">結果を見る</button></td></tr>';
    }).join("");
    box.innerHTML = '<div class="tw"><table class="history"><thead><tr><th>日時</th><th>得点</th><th>判定</th><th>所要時間</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>";
  }

  $("history").addEventListener("click", function (e) {
    var b = e.target.closest("[data-hist]");
    if (!b) return;
    var h = (load("history") || [])[+b.dataset.hist];
    if (h) showResult(h);
  });

  /* ---------------- 受験 ---------------- */

  function start(fresh) {
    if (fresh || !S) {
      S = { startedAt: Date.now(), answers: {}, flags: [], cur: 1, submitted: false };
      save("session", S);
    }
    // 採点結果を見たあとに受け直す場合に備えて、結果表示の印を消しておく
    qs.forEach(function (q) {
      q.el.hidden = false;
      q.choices.forEach(function (c) {
        c.classList.remove("is-answer", "is-picked");
        c.setAttribute("tabindex", "0");
        var you = c.querySelector(".you");
        if (you) you.remove();
      });
      paintChoices(q);
      paintFlag(q);
    });
    setMode("test");
    go(S.cur || 1);
    tick();
    clearInterval(timerId);
    timerId = setInterval(tick, 1000);
  }

  function tick() {
    if (!S) return;
    var left = S.startedAt + LIMIT_MS - Date.now();
    var t = $("timer");
    t.textContent = fmt(left);
    t.classList.toggle("warn", left <= 10 * 60 * 1000 && left > 3 * 60 * 1000);
    t.classList.toggle("danger", left <= 3 * 60 * 1000);
    if (left <= 0) submit(true);
  }
  // 別のタブから戻ったときもすぐに時計を合わせる
  document.addEventListener("visibilitychange", function () { if (!document.hidden && body.classList.contains("mode-test")) tick(); });

  function go(no) {
    no = Math.max(1, Math.min(qs.length, no));
    S.cur = no;
    save("session", S);
    qs.forEach(function (q) { q.el.classList.toggle("is-cur", q.no === no); });
    $("prev").disabled = no === 1;
    $("next").textContent = no === qs.length ? "提出へ" : "次へ →";
    paintGrid();
    closeNav();
    window.scrollTo(0, 0);
  }

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
      c.setAttribute("tabindex", "0");
      c.addEventListener("click", function (e) {
        if (!body.classList.contains("mode-test")) return;
        if (e.target.closest("a")) return;
        choose(q, c.dataset.key);
      });
      c.addEventListener("keydown", function (e) {
        if (body.classList.contains("mode-test") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choose(q, c.dataset.key); }
      });
    });
    if (q.flagBtn) q.flagBtn.addEventListener("click", function () { toggleFlag(q); });
  });

  /* ---------------- 問題一覧 ---------------- */

  var navFilter = "all";
  function paintGrid() {
    if (!S) return;
    var answered = 0;
    var html = qs.map(function (q) {
      var sel = picked(q.no);
      if (sel.length) answered++;
      var state = sel.length === 0 ? "" : (sel.length < q.pick ? " partial" : " done");
      var show = navFilter === "all" ||
        (navFilter === "todo" && sel.length < q.pick) ||
        (navFilter === "flag" && isFlagged(q.no));
      if (!show) return "";
      return '<button type="button" class="cell' + state + (isFlagged(q.no) ? " flagged" : "") + (q.no === S.cur ? " cur" : "") +
             '" data-go="' + q.no + '" aria-label="問' + q.no + (sel.length ? " 回答済み" : " 未回答") + (isFlagged(q.no) ? " マーク" : "") + '">' + q.no + "</button>";
    }).join("");
    $("grid").innerHTML = html || '<p class="empty">該当する問題はありません。</p>';
    $("count").textContent = "回答 " + answered + " / " + qs.length;
    $("flagcount").textContent = S.flags.length ? "マーク " + S.flags.length : "";
  }
  $("grid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-go]");
    if (b) go(+b.dataset.go);
  });
  $("navfilter").addEventListener("click", function (e) {
    var b = e.target.closest("[data-filter]");
    if (!b) return;
    navFilter = b.dataset.filter;
    Array.prototype.forEach.call(this.querySelectorAll("[data-filter]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    paintGrid();
  });

  // 狭い画面では下から出すシート
  function openNav() { $("navside").classList.add("open"); $("scrim").hidden = false; }
  function closeNav() { $("navside").classList.remove("open"); $("scrim").hidden = true; }
  $("navopen").addEventListener("click", openNav);
  $("navclose").addEventListener("click", closeNav);
  $("scrim").addEventListener("click", closeNav);

  $("prev").addEventListener("click", function () { go(S.cur - 1); });
  $("next").addEventListener("click", function () { if (S.cur === qs.length) openSubmit(); else go(S.cur + 1); });

  document.addEventListener("keydown", function (e) {
    if (!body.classList.contains("mode-test") || !$("modal").hidden) return;
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var q = qs[S.cur - 1];
    if (e.key === "ArrowLeft") { go(S.cur - 1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { go(S.cur + 1); e.preventDefault(); }
    else if (/^[a-hA-H]$/.test(e.key)) {
      var key = e.key.toUpperCase();
      if (q.choices.some(function (c) { return c.dataset.key === key; })) choose(q, key);
    } else if (e.key === "m" || e.key === "M") { toggleFlag(q); }
  });

  /* ---------------- 提出 ---------------- */

  function chipList(nos) {
    return nos.map(function (n) { return '<button type="button" data-jump="' + n + '">問' + n + "</button>"; }).join("");
  }
  function openSubmit() {
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
    html += '<p>残り時間 <b>' + fmt(S.startedAt + LIMIT_MS - Date.now()) + "</b></p>";
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
    if (e.target.closest("[data-submit]")) { hideModal(); submit(false); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("modal").hidden) hideModal(); });

  function submit(timeUp) {
    if (!S || S.submitted) return;
    clearInterval(timerId);
    var endedAt = Math.min(Date.now(), S.startedAt + LIMIT_MS);
    var right = qs.filter(function (q) { return sameSet(picked(q.no), q.answer); }).map(function (q) { return q.no; });
    var result = {
      at: endedAt,
      usedMs: endedAt - S.startedAt,
      correct: right.length,
      total: qs.length,
      rate: right.length / qs.length,
      passed: right.length / qs.length >= meta.passRate,
      answers: S.answers,
      flags: S.flags,
      timeUp: !!timeUp,
    };
    var hist = load("history") || [];
    hist.unshift(result);
    save("history", hist.slice(0, 20));
    S.submitted = true;
    drop("session");
    showResult(result);
    if (timeUp) {
      showModal("<h2>時間切れです</h2><p>制限時間の " + meta.minutes + " 分が経過したため、その時点の回答で採点しました。未回答の問題は不正解として扱っています。</p>" +
                '<div class="actions"><button type="button" class="btn primary" data-ok>結果を見る</button></div>');
    }
  }

  /* ---------------- 採点結果 ---------------- */

  var resultFilter = "wrong";
  var current = null;
  function showResult(r) {
    current = r;
    S = { answers: r.answers, flags: r.flags || [], cur: 1, submitted: true };
    qs.forEach(function (q) {
      var sel = r.answers[q.no] || [];
      var ok = sameSet(sel, q.answer);
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
      v.className = "verdict " + (sel.length === 0 ? "none" : ok ? "ok" : "ng");
      v.textContent = sel.length === 0 ? "未回答" : ok ? "正解" : "不正解";
      q.el.querySelector(".flagmark").hidden = !(r.flags || []).some(function (n) { return n === q.no; });
      q.el.dataset.ok = ok ? "1" : "0";
      q.el.dataset.none = sel.length ? "0" : "1";
    });

    var d = new Date(r.at);
    $("r-score").innerHTML = r.correct + "<small> / " + r.total + "</small>";
    $("r-judge").textContent = r.passed ? "合格ライン到達" : "合格ラインに届かず";
    $("r-judge").className = "judge " + (r.passed ? "pass" : "fail");
    $("r-meta").innerHTML = "正答率 <b>" + Math.round(r.rate * 100) + "%</b>（合格ライン " + Math.round(meta.passRate * 100) + "%）<br>" +
      "所要時間 " + fmt(r.usedMs) + " / " + meta.minutes + ":00" + (r.timeUp ? "（時間切れで提出）" : "") + "<br>" +
      d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " に受験";

    // 章ごとの正答率（どの章を読み直せばよいか）
    var byCh = {};
    qs.forEach(function (q) {
      var c = byCh[q.ch] || (byCh[q.ch] = { ok: 0, n: 0 });
      c.n++;
      if (sameSet(r.answers[q.no] || [], q.answer)) c.ok++;
    });
    $("r-bars").innerHTML = Object.keys(meta.chapters).filter(function (k) { return byCh[k]; }).map(function (k) {
      var c = byCh[k], p = Math.round(c.ok / c.n * 100);
      return '<div class="bar2"><a href="' + meta.noteHref + "#ch" + k.slice(1) + '">' + meta.chapters[k] + '</a>' +
             '<div class="track"><div class="fill' + (p < meta.passRate * 100 ? " low" : "") + '" style="width:' + p + '%"></div></div>' +
             '<span class="num">' + c.ok + "/" + c.n + "</span></div>";
    }).join("");

    setMode("result");
    applyResultFilter();
  }

  function applyResultFilter() {
    var shown = 0;
    qs.forEach(function (q) {
      var show = resultFilter === "all" ||
        (resultFilter === "wrong" && q.el.dataset.ok === "0") ||
        (resultFilter === "flag" && (current.flags || []).indexOf(q.no) >= 0);
      q.el.hidden = !show;
      q.el.classList.add("is-cur");
      if (show) shown++;
    });
    $("r-empty").hidden = shown > 0;
    Array.prototype.forEach.call(document.querySelectorAll("#rtabs [data-rf]"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.rf === resultFilter));
    });
  }
  $("rtabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-rf]");
    if (!b) return;
    resultFilter = b.dataset.rf;
    applyResultFilter();
  });

  /* ---------------- ボタン ---------------- */

  $("start").addEventListener("click", function () {
    var sess = load("session");
    if (sess && !sess.submitted) {
      showModal("<h2>最初から受け直しますか？</h2><p>途中の回答は消えます。</p>" +
                '<div class="actions"><button type="button" class="btn" data-close>やめる</button>' +
                '<button type="button" class="btn danger" id="restart-ok">最初から始める</button></div>');
      $("restart-ok").addEventListener("click", function () { hideModal(); drop("session"); S = null; start(true); });
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
  $("again").addEventListener("click", function () { S = null; start(true); });
  $("to-intro").addEventListener("click", function () {
    qs.forEach(function (q) { q.el.hidden = false; });
    S = null;
    renderIntro();
    setMode("intro");
  });

  renderIntro();
  setMode("intro");
})();
