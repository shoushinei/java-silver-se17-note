/* ノート全文の絞り込み検索。

   1. 各 section の textContent を一度だけ取り出してキャッシュし、
   2. 語を含む節だけ目次に残して件数バッジを出し、
   3. 本文の該当文字列を <mark class="hit"> で囲む。

   論点インデックス（06-topic-index.js）からも呼ぶので、
   apply / jump / cache を NoteApp.search として公開する。 */
NoteApp.search = (function () {
  var main = document.querySelector("main");
  if (!main) return null;

  var idxSec = document.getElementById("idx");
  var secs = Array.prototype.slice.call(main.querySelectorAll("section[id]"))
    .filter(function (s) { return s.id !== "idx"; });
  var cache = secs.map(function (s) {
    return { el: s, id: s.id, txt: s.textContent.toLowerCase() };
  });

  var linkOf = {};
  Array.prototype.slice.call(document.querySelectorAll(".toc a")).forEach(function (a) {
    linkOf[a.getAttribute("href").slice(1)] = a;
  });
  var heads = Array.prototype.slice.call(document.querySelectorAll(".toc-h"));

  var input = document.getElementById("q");
  var clr = document.getElementById("qx");
  var hits = document.getElementById("qhits");

  function count(t, q) {
    var n = 0, i = 0;
    while ((i = t.indexOf(q, i)) >= 0) { n++; i += q.length; }
    return n;
  }

  function unmark() {
    Array.prototype.slice.call(main.querySelectorAll("mark.hit")).forEach(function (m) {
      var p = m.parentNode;
      if (!p) return;
      p.replaceChild(document.createTextNode(m.textContent), m);
      p.normalize();
    });
  }

  function markAll(q) {
    var walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var v = n.nodeValue;
        if (!v || !v.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "MARK") return NodeFilter.FILTER_REJECT;
        if (idxSec && idxSec.contains(n)) return NodeFilter.FILTER_REJECT;
        return v.toLowerCase().indexOf(q) >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    if (nodes.length > 1200) nodes = nodes.slice(0, 1200); // 1文字検索でも固まらないように
    nodes.forEach(function (node) {
      var s = node.nodeValue, low = s.toLowerCase();
      var frag = document.createDocumentFragment(), last = 0, i;
      while ((i = low.indexOf(q, last)) >= 0) {
        if (i > last) frag.appendChild(document.createTextNode(s.slice(last, i)));
        var m = document.createElement("mark");
        m.className = "hit";
        m.textContent = s.slice(i, i + q.length);
        frag.appendChild(m);
        last = i + q.length;
      }
      if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
    });
  }

  function apply(raw) {
    var q = (raw || "").trim().toLowerCase();
    unmark();
    if (!q) {
      cache.forEach(function (c) {
        var a = linkOf[c.id];
        if (!a) return;
        a.classList.remove("qhide");
        var b = a.querySelector(".cnt");
        if (b) b.remove();
      });
      heads.forEach(function (h) { h.classList.remove("qhide"); });
      hits.style.display = "none";
      clr.style.display = "none";
      return;
    }
    clr.style.display = "block";
    var nsec = 0, nhit = 0;
    cache.forEach(function (c) {
      var n = count(c.txt, q);
      var a = linkOf[c.id];
      if (!a) return;
      var b = a.querySelector(".cnt");
      if (n > 0) {
        nsec++;
        nhit += n;
        a.classList.remove("qhide");
        if (!b) { b = document.createElement("span"); b.className = "cnt"; a.appendChild(b); }
        b.textContent = n;
      } else {
        a.classList.add("qhide");
        if (b) b.remove();
      }
    });
    heads.forEach(function (h) {
      var el = h.nextElementSibling, any = false;
      while (el && !el.classList.contains("toc-h")) {
        if (el.tagName === "A" && !el.classList.contains("qhide")) { any = true; break; }
        el = el.nextElementSibling;
      }
      h.classList.toggle("qhide", !any);
    });
    hits.style.display = "block";
    hits.textContent = nsec === 0 ? "該当なし" : nsec + " 節 / " + nhit + " 箇所";
    markAll(q);
  }

  function jump() {
    var m = main.querySelector("mark.hit");
    if (m) m.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  var t;
  input.addEventListener("input", function () {
    clearTimeout(t);
    t = setTimeout(function () { apply(input.value); }, 160);
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); apply(input.value); jump(); }
    if (e.key === "Escape") { input.value = ""; apply(""); input.blur(); }
  });
  clr.addEventListener("click", function () { input.value = ""; apply(""); input.focus(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    if (e.key === "Escape" && input.value) { input.value = ""; apply(""); }
  });

  return { apply: apply, jump: jump, count: count, cache: cache, input: input };
})();
