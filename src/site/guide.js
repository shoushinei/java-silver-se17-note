/* はじめての方へ（使い方）のページの動き。

   右の枠（iframe）に本物のページを「?guide」付きで開き、説明している部品に枠（.gd-spot）を重ねる。
   ?guide を付けたページは、受験記録などを localStorage に書かず、見本の値を出す（exam.js・03-scrollspy.js・トップページ）。

   手順（step）
     url  開くページ。省略すると前の手順と同じページのまま続ける
     act  そのページで行う操作（ボタンを押す・検索する など）。戻るときは、ページを開き直して最初から操作をやり直す
     sel  枠を重ねる要素（CSS セレクタか、要素を返す関数）。m に書いたものは、狭い画面（スマホの表示）のときだけ使う
   file:// で開いたときなど、枠の中のページを触れない環境では、操作と枠を省いて説明だけを出す。 */
(function () {
  var EXAM = (window.GuideConf && window.GuideConf.exam) || "05";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 枠の中のページへの操作 ---------------- */

  function q(c, sel) { return typeof sel === "function" ? sel(c) : c.doc.querySelector(sel); }
  function click(sel) { return function (c) { var el = q(c, sel); if (el) el.click(); }; }
  function jump(id) {
    return function (c) {
      var el = c.doc.getElementById(id);
      if (el) c.win.scrollTo({ top: el.getBoundingClientRect().top + c.win.scrollY - 70, behavior: "instant" });
      // 目次の現在地は scroll イベントの次のフレームで動くので、待たずにここで合わせておく
      if (c.win.NoteApp && c.win.NoteApp.spy) c.win.NoteApp.spy();
    };
  }
  function drawer(open) {      // 教材の目次。スマホの表示のときだけ開け閉めする
    return function (c) {
      if (!c.mobile) return;
      var nav = c.doc.getElementById("toc-nav");
      if (nav && nav.classList.contains("open") !== open) c.doc.getElementById(open ? "mnav-open" : "mnav-close").click();
    };
  }
  function search(word) {
    return function (c) {
      var s = c.win.NoteApp && c.win.NoteApp.search;
      if (!s) return;
      s.input.value = word;
      s.apply(word);
    };
  }
  function all() {
    var fns = Array.prototype.slice.call(arguments);
    return function (c) { fns.forEach(function (f) { f(c); }); };
  }
  // 模擬試験：問 1 は前の手順で選んであるので、残りに答えを入れて提出する（4 問に 1 問はわざと間違える）
  function fillAndSubmit(c) {
    Array.prototype.forEach.call(c.doc.querySelectorAll("#qlist .q"), function (art) {
      var no = +art.dataset.no;
      if (no === 1) return;
      var ans = art.dataset.answer.split(",");
      var keys = Array.prototype.map.call(art.querySelectorAll(".choice"), function (x) { return x.dataset.key; });
      var pick = no % 4 === 0 ? [keys.filter(function (k) { return ans.indexOf(k) < 0; })[0]] : ans;
      pick.forEach(function (k) { var ch = art.querySelector('.choice[data-key="' + k + '"]'); if (ch) ch.click(); });
    });
    c.doc.getElementById("submit").click();
    var ok = c.doc.querySelector("#modal [data-submit]");
    if (ok) ok.click();
  }
  function chooseRight(c) {
    var art = c.doc.getElementById("q1");
    if (!art) return;
    var ch = art.querySelector('.choice[data-key="' + art.dataset.answer.split(",")[0] + '"]');
    if (ch && !ch.classList.contains("is-sel")) ch.click();
  }
  function indexEntry(word) {
    return function (c) {
      return Array.prototype.filter.call(c.doc.querySelectorAll("#idx .ix-e"), function (e) {
        return e.querySelector(".ix-t").textContent === word;
      })[0] || null;
    };
  }

  /* ---------------- 説明の中身 ---------------- */

  var EXAM_URL = "../exams/" + EXAM + "/?guide";
  var TOURS = [
    { id: "all", name: "全体の流れ", steps: [
      { url: "../?guide", sel: ".pt-hero", t: "トップページ",
        d: "サイトの入口です。ここから「教材」と「模擬試験」に分かれます。上のメニューからも、いつでも行き来できます。" },
      { sel: "#card-note", t: "教材で学ぶ",
        d: "試験範囲をまとめた教材です。前に読んだところが「続きから」に出るので、そこからすぐ再開できます。" },
      { sel: "#card-exam", t: "模擬試験を解く",
        d: "本番と同じ 90 分・60 問の模擬試験です。いちばん最近の結果と、試験ごとの受験回数・最高点が出ます。" },
      { sel: "#pt-flow", t: "おすすめの進め方",
        d: "教材を読む → 模擬試験を解く → 間違えた論点を教材で読み直す、の繰り返しで仕上げます。" },
      { sel: ".pt-links", t: "使い方と注意事項",
        d: "このページ（使い方）・注意事項・GitHub はここから開けます。誤りを見つけたら GitHub の Issues で教えてください。" },
    ] },
    { id: "note", name: "教材", steps: [
      { url: "../note/?guide", act: drawer(true), sel: "#toc-nav", t: "目次",
        d: "左が目次です。章 → 節（2-3 型変換）→ 小さい論点（2-3-4 …）の順に並び、読んでいる節の論点だけが開きます。スマホでは左上の「目次」から開きます。" },
      { act: all(drawer(false), jump("p2-3-4")), sel: "#p2-3-4", t: "論点番号",
        d: "見出しの左の 2-3-4 が論点番号です。「第2章・3節・4つ目の論点」という意味で、模擬試験の解説や索引も、この番号で教材を指します。" },
      { act: drawer(true), sel: ".toc-pts.open", t: "目次も一緒に動く",
        d: "本文を読み進めると、目次の現在地（黒い帯）も一緒に動きます。目次の論点を押せば、その論点へ飛べます。" },
      { act: all(drawer(false), function (c) {
          var el = c.doc.querySelector('#c2-s03 .code[data-v="err"]');
          if (el) c.win.scrollTo({ top: el.getBoundingClientRect().top + c.win.scrollY - 120, behavior: "instant" });
        }), sel: '#c2-s03 .code[data-v="err"]', t: "コード例は3色",
        d: "コード例は、緑＝コンパイルも実行も通る、赤＝コンパイルエラー、橙＝実行時に例外、に色分けしてあります。試験は実質この三択の判定です。" },
      { act: all(drawer(true), search("フォールスルー")), sel: ".search", t: "検索",
        d: "目次の上の検索窓に語句を入れると、その語句がある節と論点だけが目次に残り、それぞれの件数が出ます（/ キーで検索窓へ）。" },
      { act: drawer(false), sel: "mark.hit", t: "本文の該当箇所",
        d: "本文の該当箇所には黄色の印が付きます。検索窓で Enter を押すと最初の箇所へ飛び、Esc で検索を解除します。" },
      { act: all(search(""), jump("idx")), sel: "#idx .ix-jump", t: "索引",
        d: "教材の最後には索引があります。記号・数字・A〜Z・50音の順に並び、上の文字を押すとその見出しへ飛べます。" },
      { sel: indexEntry("ArrayList"), t: "索引の番号から論点へ",
        d: "語句の右の番号が論点番号です。押すとその論点へ飛び、見出しが黄色く光ります。太字の番号は、見出しにその語句がある論点です。" },
    ] },
    { id: "exam", name: "模擬試験", steps: [
      { url: EXAM_URL, sel: ".facts", t: "試験の概要",
        d: "どの試験も 60 問・90 分・合格ラインの目安 65% です。下に、時間を計るテストモードと、問題と解説を読む振り返りモードがあります。" },
      { sel: ".modes", t: "2つのモード",
        d: "本番の練習は「テストを始める」から。時間を気にせず問題と解説を読みたいときは「問題と解説を読む」を使います。" },
      { act: click("#start"), sel: "#timer", t: "残り時間",
        d: "テストが始まると、上のバーに残り時間が出ます。0 になると自動で提出されます。用事ができたら「中断」で時計を止められます。" },
      { act: chooseRight, sel: "#q1 .choices", t: "答えを選ぶ",
        d: "選択肢を押して答えを選びます。「2つ選択」の問題は2つ選びます。キーボードの A〜H でも選べます。" },
      { act: function (c) { var f = c.doc.querySelector("#q1 .flag"); if (f && f.getAttribute("aria-pressed") !== "true") f.click(); },
        sel: "#q1 .flag", t: "見直しマーク",
        d: "自信がない問題には「見直し」を押してマークを付けます。あとで問題一覧から、マークした問題だけを見直せます。" },
      { act: function (c) { if (c.mobile) c.doc.getElementById("navopen").click(); }, sel: ".navpanel", t: "問題一覧",
        d: "問題番号の一覧です。回答済み・未回答・見直しマークが色で分かり、押すとその問題へ飛べます。未回答やマーク付きだけに絞り込めます。スマホでは「問題一覧」から開きます。" },
      { act: function (c) { if (c.mobile) c.doc.getElementById("navclose").click(); }, sel: "#submit", t: "提出",
        d: "解き終わったら「提出」を押します。未回答が残っていても、その数を確かめてから提出できます。" },
      { act: fillAndSubmit, sel: "#summary .score", t: "採点結果",
        d: "提出すると、すぐに得点と合否が出ます（ここでは説明のため、自動で答えを入れて提出しました）。" },
      { sel: "#r-bars", t: "章ごとの正答率",
        d: "どの章で点を落としたかが分かります。章名を押すと、教材のその章へ飛びます。" },
      { act: click("#review-wrong"), sel: ".q.is-cur .refs", t: "解説から教材へ",
        d: "間違えた問題を1問ずつ見直せます。解説の下の「教材で確認する」から、その問題の論点（5-10 など）を教材で読み直せます。" },
      { sel: ".q.is-cur .memo", t: "振り返りメモ",
        d: "なぜ間違えたか、次に気をつけることをメモできます。メモはこの回の受験記録に保存され、あとで読み返せます。" },
    ] },
    { id: "records", name: "受験記録", steps: [
      { url: EXAM_URL, sel: "#history", t: "受験記録",
        d: "提出した回は受験記録に残ります（ここに出ているのは見本の2回分です）。得点・合否・所要時間・メモの数が並び、いちばん良い回に「最高」が付きます。" },
      { sel: "#history [data-open]", t: "結果を開く",
        d: "「結果を開く」で、その回の ○× と解説・振り返りメモを、いつでも見直せます。" },
      { sel: ".hist-tools", t: "別のパソコンへ移す",
        d: "記録はこのブラウザにだけ保存されます。別のパソコンの記録は、そちらで「記録を書き出す」（JSON ファイル）→ こちらで「記録を読み込む」と、今の記録に追加できます。" },
      { act: click("#manual-open"), sel: "#dialog", t: "結果を手で入力する",
        d: "紙やスクリーンショットに ○× だけが残っている回は、番号を押して ○・×・未回答を付ければ記録にできます。" },
      { url: "../?guide", sel: "#card-exam", t: "トップにも出る",
        d: "いちばん最近の結果は、トップページの「前回の結果」にも出ます。押すとその回の結果が開きます。" },
    ] },
  ];

  /* ---------------- 枠（iframe）の大きさ ---------------- */

  var view = $("gd-view"), frame = $("gd-frame"), spot = $("gd-spot"), loading = $("gd-loading");
  var W = 1200, H = 760, scale = 1, mobile = false;

  function layout() {
    var w = frame.parentNode.clientWidth;
    var m = w < 620;
    W = m ? 390 : 1200;
    H = m ? 600 : 760;
    scale = w / W;
    if (!m) {        // PC では、上のバーと説明の下に、枠がまるごと収まる大きさにする
      var room = window.innerHeight - 64 - document.querySelector(".gd-cap").offsetHeight - 24;
      scale = Math.max(0.45, Math.min(scale, room / H));
    }
    frame.style.width = Math.round(W * scale) + "px";
    view.style.width = W + "px";
    view.style.height = H + "px";
    view.style.transform = "scale(" + scale + ")";
    frame.style.height = Math.round(H * scale) + "px";
    var changed = m !== mobile;
    mobile = m;
    return changed;
  }

  function ctx() {
    try {
      var d = view.contentDocument;
      if (!d || !d.body) return null;
      return { doc: d, win: view.contentWindow, mobile: mobile };
    } catch (e) { return null; }    // file:// など、中のページに触れない環境
  }

  /* ---------------- 枠を重ねる ---------------- */

  var target = null;

  function reveal(el, c) {
    // 目次や問題一覧のように、それ自体がスクロールする箱の中にあれば、先に箱を動かす
    for (var p = el.parentElement; p && p !== c.doc.body; p = p.parentElement) {
      var st = c.win.getComputedStyle(p);
      if (/(auto|scroll)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 4) {
        var pr = p.getBoundingClientRect(), er = el.getBoundingClientRect();
        if (er.top < pr.top || er.bottom > pr.bottom) p.scrollTop += er.top - pr.top - Math.max(0, (pr.height - er.height) / 3);
      }
    }
    var r = el.getBoundingClientRect();
    if (r.top < 64 || r.bottom > H - 16) {
      c.win.scrollTo({ top: Math.max(0, c.win.scrollY + r.top - Math.max(64, (H - r.height) / 2)), behavior: "instant" });
    }
  }

  function place() {
    if (!target || !target.isConnected) { spot.hidden = true; return; }
    var r = target.getBoundingClientRect();
    var x1 = Math.max(0, r.left - 6), y1 = Math.max(0, r.top - 6);
    var x2 = Math.min(W, r.right + 6), y2 = Math.min(H, r.bottom + 6);
    if (x2 <= x1 || y2 <= y1) { spot.hidden = true; return; }
    spot.hidden = false;
    spot.style.left = x1 * scale + "px";
    spot.style.top = y1 * scale + "px";
    spot.style.width = (x2 - x1) * scale + "px";
    spot.style.height = (y2 - y1) * scale + "px";
  }
  var placeQueued = false;
  function queuePlace() {
    if (placeQueued) return;
    placeQueued = true;
    requestAnimationFrame(function () { placeQueued = false; place(); });
  }

  function point(s) {
    var c = ctx();
    target = null;
    if (!c) { spot.hidden = true; return; }
    var el = null;
    try { el = q(c, (mobile && s.m && s.m.sel) || s.sel); } catch (e) { el = null; }
    if (!el) { spot.hidden = true; return; }
    target = el;
    reveal(el, c);
    place();
    // スマホの目次や問題一覧は、引き出しが開くアニメーションのあいだ位置が動く。終わるころに測り直す
    [120, 450, 900].forEach(function (ms) { setTimeout(function () { if (target === el) place(); }, ms); });
  }

  /* ---------------- 手順を進める ---------------- */

  var tour = 0, step = -1, scene = -1, busy = false, nonce = 0;

  function steps() { return TOURS[tour].steps; }
  function sceneOf(k) { while (k > 0 && !steps()[k].url) k--; return k; }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function load(url) {
    return new Promise(function (res) {
      loading.hidden = false;
      spot.hidden = true;
      view.onload = function () {
        loading.hidden = true;
        var c = ctx();
        if (c) {
          c.win.addEventListener("scroll", queuePlace, true);
          c.win.addEventListener("resize", queuePlace);
          c.win.addEventListener("transitionend", function () { place(); }, true);   // 引き出しが開き終わったとき
        }
        wait(250).then(res);
      };
      view.src = url + "&n=" + (++nonce);
    });
  }

  function act(k) {
    var s = steps()[k], c = ctx();
    if (!s.act || !c) return Promise.resolve();
    try { s.act(c); } catch (e) { /* 画面が想定と違っても、説明は続ける */ }
    return wait(320);
  }
  function chain(from, to) {
    var p = Promise.resolve();
    for (var k = from; k <= to; k++) (function (k) { p = p.then(function () { return act(k); }); })(k);
    return p;
  }

  function go(k, force) {
    var list = steps();
    k = Math.max(0, Math.min(list.length - 1, k));
    if (busy || (k === step && !force)) return;
    busy = true;
    var sc = sceneOf(k);
    var p;
    if (force || sc !== scene || k < step) {
      var url = list[sc].url;
      p = load(url).then(function () { return chain(sc, k); });
    } else {
      p = chain(step + 1, k);
    }
    scene = sc;
    step = k;
    paintCaption();
    p.then(function () { point(list[k]); busy = false; paintCaption(); }, function () { busy = false; });
  }

  // 説明と画面がそろって見える位置まで、このページを送る（ボタンを押したときだけ）
  function toStage() {
    var st = document.querySelector(".gd-stage");
    var top = st.getBoundingClientRect().top;
    if (top > 80 || top < 0) window.scrollTo({ top: Math.max(0, top + window.scrollY - 64), behavior: "smooth" });
  }

  function paintCaption() {
    var list = steps(), s = list[step];
    $("gd-n").textContent = TOURS[tour].name + "　" + (step + 1) + " / " + list.length;
    $("gd-t").textContent = s.t;
    $("gd-d").textContent = s.d;
    $("gd-prev").disabled = step === 0 || busy;
    $("gd-next").disabled = busy;
    var next = tour < TOURS.length - 1 ? TOURS[tour + 1].name : null;
    $("gd-next").textContent = step < list.length - 1 ? "次へ →" : next ? "「" + next + "」へ →" : "最初に戻る";
    $("gd-open").href = list[sceneOf(step)].url.replace(/\?guide$/, "");
    Array.prototype.forEach.call($("gd-steps").children, function (li, i) {
      li.classList.toggle("on", i === step);
      li.classList.toggle("done", i < step);
    });
    layout();          // 説明の長さで、枠に使える高さが変わる
    place();
  }

  function paintTour() {
    Array.prototype.forEach.call($("gd-tabs").children, function (b, i) { b.setAttribute("aria-selected", String(i === tour)); });
    $("gd-steps").innerHTML = "";
    steps().forEach(function (s, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = s.t;
      b.addEventListener("click", function () { toStage(); go(i); });
      li.appendChild(b);
      $("gd-steps").appendChild(li);
    });
  }

  function openTour(i) {
    if (busy) return;
    tour = i;
    step = -1;
    scene = -1;
    try { history.replaceState(null, "", "#" + TOURS[i].id); } catch (e) { /* 表示には影響しない */ }
    paintTour();
    go(0, true);
  }

  TOURS.forEach(function (t, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.textContent = t.name;
    b.addEventListener("click", function () { openTour(i); });
    $("gd-tabs").appendChild(b);
  });

  $("gd-prev").addEventListener("click", function () { toStage(); go(step - 1); });
  $("gd-next").addEventListener("click", function () {
    toStage();
    if (step < steps().length - 1) go(step + 1);
    else openTour(tour < TOURS.length - 1 ? tour + 1 : 0);
  });
  document.addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); $("gd-next").click(); }
    if (e.key === "ArrowLeft" && step > 0) { e.preventDefault(); go(step - 1); }
  });
  window.addEventListener("resize", function () {
    if (layout() && step >= 0 && !busy) go(step, true);   // PC とスマホの表示が切り替わったら、開き直す
    else queuePlace();
  });

  function fromHash() {
    var start = 0;
    TOURS.forEach(function (t, i) { if (location.hash === "#" + t.id) start = i; });
    return start;
  }
  window.addEventListener("hashchange", function () { if (fromHash() !== tour) openTour(fromHash()); });

  layout();
  openTour(fromHash());
})();
