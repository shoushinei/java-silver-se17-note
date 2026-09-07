/* スマホ用の目次ドロワー。

   PC のサイドバーと同じ <nav class="toc"> を、左から出すパネルとして使い回す。
   目次リンクを複製すると検索側の href → リンクの対応が壊れるため、DOM は 1 つのまま
   CSS で見た目だけを切り替えている（20-mobile.css）。

   章は既定で畳んでおき、開いたときに現在の章だけ開く。全 75 項目を一度に並べると
   ドロワーが縦に長くなりすぎて、結局スワイプで探す羽目になるため。 */
(function () {
  var nav = document.getElementById("toc-nav");
  var bar = document.getElementById("mnav-bar");
  if (!nav || !bar) return;

  var scrim = document.getElementById("mnav-scrim");
  var openBtn = document.getElementById("mnav-open");
  var closeBtn = document.getElementById("mnav-close");
  var nowBtn = document.getElementById("mnav-now");
  var topBtn = document.getElementById("mnav-top");
  var input = document.getElementById("q");
  var groups = Array.prototype.slice.call(nav.querySelectorAll(".toc-ch"));
  var mq = window.matchMedia("(max-width: 860px)");
  var lastFocus = null;
  var savedY = 0;

  /* 背後の本文を固定する。body を position:fixed にすると読んでいた位置を失うので、
     いったん top に退避しておき、閉じるときに同じ位置へ戻す。 */
  function lockBody() {
    savedY = window.scrollY;
    document.body.style.top = -savedY + "px";
    document.body.classList.add("mnav-open");
  }

  function unlockBody() {
    document.body.classList.remove("mnav-open");
    document.body.style.top = "";
    // html{scroll-behavior:smooth} が効くと戻る途中が見えてしまうので、ここだけ切る
    var root = document.documentElement;
    var keep = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, savedY);
    root.style.scrollBehavior = keep;
  }

  /* ---- 開閉 ---- */

  function isOpen() { return nav.classList.contains("open"); }

  function openNav() {
    if (isOpen()) return;
    lastFocus = document.activeElement;
    scrim.hidden = false;
    // hidden を外した直後は transition が走らないので、1 フレーム待ってから効かせる
    requestAnimationFrame(function () { scrim.classList.add("open"); });
    nav.classList.add("open");
    lockBody();
    openBtn.setAttribute("aria-expanded", "true");
    nav.removeAttribute("aria-hidden");
    revealActive();
    // クラスを付けた直後はまだ visibility:hidden のままで focus が乗らないので、
    // 1 フレーム待ってから当てる
    requestAnimationFrame(function () { closeBtn.focus(); });
  }

  function closeNav() {
    if (!isOpen()) return;
    nav.classList.remove("open");
    scrim.classList.remove("open");
    unlockBody();
    openBtn.setAttribute("aria-expanded", "false");
    if (mq.matches) nav.setAttribute("aria-hidden", "true");
    var done = function () { scrim.hidden = true; };
    setTimeout(done, 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  /* 現在読んでいる節が入っている章を開いて、その位置まで目次をスクロールする */
  function revealActive() {
    var on = nav.querySelector("a.on");
    if (!on) return;
    var group = on.closest(".toc-ch");
    if (group) setOpen(group, true);
    if (on.scrollIntoView) on.scrollIntoView({ block: "center" });
  }

  /* ---- 章の折り畳み ---- */

  function setOpen(group, open) {
    group.classList.toggle("open", open);
    var head = group.querySelector(".toc-h");
    if (head) head.setAttribute("aria-expanded", String(open));
  }

  groups.forEach(function (group) {
    var head = group.querySelector(".toc-h");
    if (!head) return;
    function toggle() {
      if (!mq.matches) return;              // PC では常に全表示なので何もしない
      setOpen(group, !group.classList.contains("open"));
    }
    head.addEventListener("click", toggle);
    head.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });

  /* 検索中は畳んだ章の中のヒットも見えなければ意味がないので、全章を開く */
  NoteApp.onSearch = function (q) {
    nav.classList.toggle("searching", !!q);
  };

  /* ---- 画面幅に応じた属性の付け外し ---- */

  function syncMode() {
    var mobile = mq.matches;
    groups.forEach(function (group) {
      var head = group.querySelector(".toc-h");
      if (!head) return;
      if (mobile) {
        head.setAttribute("role", "button");
        head.setAttribute("tabindex", "0");
        head.setAttribute("aria-expanded", String(group.classList.contains("open")));
      } else {
        // PC では見出しはただの見出しに戻す
        head.removeAttribute("role");
        head.removeAttribute("tabindex");
        head.removeAttribute("aria-expanded");
      }
    });
    if (mobile) {
      if (!isOpen()) nav.setAttribute("aria-hidden", "true");
    } else {
      nav.removeAttribute("aria-hidden");
      closeNav();
    }
  }

  /* ---- 配線 ---- */

  openBtn.addEventListener("click", openNav);
  nowBtn.addEventListener("click", openNav);
  closeBtn.addEventListener("click", closeNav);
  scrim.addEventListener("click", closeNav);

  topBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // 目次から飛んだらドロワーは用済み
  nav.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("a")) closeNav();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen() && !input.value) closeNav();
  });

  // ドロワーの外にフォーカスが逃げないようにする
  nav.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !isOpen()) return;
    var f = nav.querySelectorAll("a, button, input");
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  if (mq.addEventListener) mq.addEventListener("change", syncMode);
  else if (mq.addListener) mq.addListener(syncMode);
  syncMode();
})();
