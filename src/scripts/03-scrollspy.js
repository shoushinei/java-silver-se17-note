/* スクロール位置に追従して、目次の現在地に .on を付ける。
   スマホでは目次が畳まれていて見えないので、上部バーにも章と節を出す。 */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
  var secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });

  var now = document.getElementById("mnav-now");
  var nowCh = now && now.querySelector(".ch");
  var nowSe = now && now.querySelector(".se");
  var shown = -1;

  function paintNow(a, i) {
    if (!nowCh || i === shown) return;
    shown = i;
    var group = a.closest ? a.closest(".toc-ch") : null;
    var head = group ? group.querySelector(".toc-h") : null;
    // 「第3章　演算子と制御構造」→「第3章」
    nowCh.textContent = head ? head.textContent.split("　")[0] : "INDEX";
    var tn = a.querySelector(".tn");
    nowSe.textContent = tn
      ? tn.textContent + " " + a.textContent.slice(tn.textContent.length)
      : a.textContent;
  }

  function spy() {
    // スマホで目次ドロワーを開いている間は本文を position:fixed で固定しており、
    // window.scrollY が 0 になる。その値で計算すると現在地が先頭に戻ってしまう。
    if (document.body.classList.contains("mnav-open")) return;
    var best = 0, y = window.scrollY + 120;
    secs.forEach(function (s, i) { if (s && s.offsetTop <= y) best = i; });
    links.forEach(function (a, i) { a.classList.toggle("on", i === best); });
    paintNow(links[best], best);
  }

  var tick = false;
  window.addEventListener("scroll", function () {
    if (!tick) { tick = true; requestAnimationFrame(function () { spy(); tick = false; }); }
  }, { passive: true });
  spy();
})();
