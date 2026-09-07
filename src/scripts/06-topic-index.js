/* 論点インデックス。語ごとにノート全体の出現回数を数えてチップを並べ、
   クリックで検索を実行する。語の一覧は src/data/topic-index.json 側にあり、
   ビルド時に NoteApp.topicIndex として差し込まれる。 */
(function () {
  var search = NoteApp.search;
  var body = document.getElementById("idxbody");
  if (!search || !body) return;

  (NoteApp.topicIndex || []).forEach(function (g) {
    var terms = g.terms.map(function (w) {
      var n = 0;
      search.cache.forEach(function (c) { n += search.count(c.txt, w.toLowerCase()); });
      return [w, n];
    }).filter(function (p) { return p[1] > 0; }); // 本文に無い語は出さない
    if (!terms.length) return;

    var h = document.createElement("div");
    h.className = "idx-h";
    h.textContent = g.group;
    body.appendChild(h);

    var wrap = document.createElement("div");
    terms.forEach(function (p) {
      var c = document.createElement("span");
      c.className = "chip";
      c.setAttribute("role", "button");
      c.setAttribute("tabindex", "0");
      c.textContent = p[0];
      var b = document.createElement("b");
      b.textContent = p[1];
      c.appendChild(b);
      function run() {
        search.input.value = p[0];
        search.apply(p[0]);
        search.jump();
      }
      c.addEventListener("click", run);
      c.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(); }
      });
      wrap.appendChild(c);
    });
    body.appendChild(wrap);
  });
})();
