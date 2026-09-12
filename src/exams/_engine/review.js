/* 振り返りページ（review.html）の小さな補助。
   JavaScript が無くても全問・正解・解説が読めるように、ここで行うのは
   章での絞り込みと「正解と解説を隠す」切り替えだけ。 */
(function () {
  var tools = document.getElementById("rv-tools");
  var qs = Array.prototype.slice.call(document.querySelectorAll("#qlist .q"));
  var links = Array.prototype.slice.call(document.querySelectorAll(".rv-index a"));

  tools.addEventListener("click", function (e) {
    var b = e.target.closest("[data-chf]");
    if (!b) return;
    var ch = b.dataset.chf;
    Array.prototype.forEach.call(tools.querySelectorAll("[data-chf]"), function (x) {
      x.setAttribute("aria-pressed", String(x === b));
    });
    qs.forEach(function (q) { q.hidden = ch !== "all" && q.dataset.ch !== ch; });
    links.forEach(function (a) { a.hidden = ch !== "all" && a.dataset.ch !== ch; });
  });

  // 自分で考えてから答えを見たいとき用。問題ごとに「答えを見る」で開ける
  var hide = document.getElementById("hide-toggle");
  hide.addEventListener("click", function () {
    var on = hide.getAttribute("aria-pressed") !== "true";
    hide.setAttribute("aria-pressed", String(on));
    hide.textContent = on ? "正解と解説を表示する" : "正解と解説を隠す";
    document.body.classList.toggle("hide-answers", on);
    qs.forEach(function (q) { q.classList.remove("revealed"); });
  });
  document.getElementById("qlist").addEventListener("click", function (e) {
    var b = e.target.closest(".reveal");
    if (!b) return;
    b.closest(".q").classList.add("revealed");
  });
})();
