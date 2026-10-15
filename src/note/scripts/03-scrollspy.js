/* スクロール位置に追従して、目次の現在地に .on を付ける。
   小さい論点（2-3-4 など）は、読んでいる節のぶんだけ目次に開く（.toc-pts.open）。
   スマホでは目次が畳まれていて見えないので、上部バーにも章と論点を出す。
   最後に読んだ論点はこのブラウザに保存し、トップページの「続きから」に出す。 */
(function () {
  var nav = document.getElementById("toc-nav");
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  var LAST = "java-silver-note:last";
  // 使い方のページ（../guide/）の中で見本として開いたときは、続きの位置を書き換えない
  var guide = /[?&]guide\b/.test(location.search);

  var now = document.getElementById("mnav-now");
  var nowCh = now && now.querySelector(".ch");
  var nowSe = now && now.querySelector(".se");
  var shown = -1, openPts = null, saveT = null;

  function secLinkOf(a) {         // 論点のリンクなら、その節のリンク
    var box = a.parentNode;
    return box && box.classList.contains("toc-pts") ? box.previousElementSibling : a;
  }
  function labelOf(a) {
    var tn = a.querySelector(".tn");
    return { no: tn ? tn.textContent : "", label: tn ? a.textContent.slice(tn.textContent.length) : a.textContent };
  }

  function paint(a, i) {
    if (i === shown) return;
    shown = i;
    links.forEach(function (x) { x.classList.remove("on", "cur"); });
    a.classList.add("on");
    var sec = secLinkOf(a);
    if (sec !== a) sec.classList.add("cur");
    var pts = sec.nextElementSibling;
    pts = pts && pts.classList.contains("toc-pts") ? pts : null;
    if (openPts !== pts) {
      if (openPts) openPts.classList.remove("open");
      if (pts) pts.classList.add("open");
      openPts = pts;
    }
    // PC のサイドバーは高さに限りがあるので、現在地が見えなくなったら目次だけを動かす
    if (nav && !nav.classList.contains("open") && nav.scrollHeight > nav.clientHeight) {
      var top = a.offsetTop, h = nav.clientHeight;
      if (top < nav.scrollTop + 40 || top > nav.scrollTop + h - 60) nav.scrollTop = Math.max(0, top - h / 3);
    }
    if (nowCh) {
      var group = a.closest ? a.closest(".toc-ch") : null;
      var head = group ? group.querySelector(".toc-h") : null;
      // 「第3章　演算子と制御構造」→「第3章」
      nowCh.textContent = head ? head.textContent.split("　")[0] : "索引";
      var l = labelOf(a);
      nowSe.textContent = (l.no && l.no !== "◎" ? l.no + " " : "") + l.label;
    }
    if (!guide && a.getAttribute("href") !== "#idx") {
      clearTimeout(saveT);
      saveT = setTimeout(function () {
        var l = labelOf(a);
        try { localStorage.setItem(LAST, JSON.stringify({ id: a.getAttribute("href").slice(1), no: l.no, label: l.label, at: Date.now() })); } catch (e) { /* 保存できなくても読むのには困らない */ }
      }, 1500);
    }
  }

  function spy() {
    var y = 120, best = -1;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (t && t.getBoundingClientRect().top <= y) best = i;
    }
    if (best < 0) { // まだ先頭の見出しの上にいる
      links.forEach(function (x) { x.classList.remove("on", "cur"); });
      if (openPts) { openPts.classList.remove("open"); openPts = null; }
      shown = -1;
      if (nowCh) { nowCh.textContent = ""; nowSe.textContent = "目次"; }
      return;
    }
    paint(links[best], best);
  }

  var tick = false;
  window.addEventListener("scroll", function () {
    if (!tick) { tick = true; requestAnimationFrame(function () { spy(); tick = false; }); }
  }, { passive: true });
  window.addEventListener("resize", spy);
  spy();
  NoteApp.spy = spy;
})();
