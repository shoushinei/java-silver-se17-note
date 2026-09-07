/* 章末「直前チェック」の開閉と進捗バー。チェック状態はブラウザに保存する。

   保存先は localStorage。元のノートは Artifact ランタイム専用の
   window.storage しか見ていなかったため、GitHub Pages や file:// で開くと
   進捗が一切保存されなかった。localStorage を第一の保存先にし、
   window.storage は使える環境でのみ併用する。 */
(function () {
  var PREFIX = "java-silver-note:";

  function readLocal(key) {
    try {
      return window.localStorage.getItem(PREFIX + key);
    } catch (e) {
      return null; // プライベートウィンドウなど、参照自体が例外になる環境がある
    }
  }

  function writeLocal(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, value);
    } catch (e) {
      /* 保存できなくても閲覧は続けられるので握りつぶす */
    }
  }

  (NoteApp.chapters || []).forEach(function (pre) {
    var list = document.getElementById(pre + "-cklist");
    if (!list) return;

    var items = Array.prototype.slice.call(list.querySelectorAll("li"));
    var fill = document.getElementById(pre + "-barfill");
    var lab = document.getElementById(pre + "-barlab");
    var btn = document.getElementById(pre + "-ckreset");
    var state = items.map(function () { return false; });

    function paint() {
      items.forEach(function (li, i) { li.classList.toggle("done", state[i]); });
      var n = state.filter(Boolean).length;
      if (fill) fill.style.width = (n / state.length * 100) + "%";
      if (lab) lab.textContent = n + " / " + state.length;
    }

    function save() {
      var json = JSON.stringify(state);
      writeLocal(pre, json);
      try {
        if (window.storage && window.storage.set) window.storage.set(PREFIX + pre, json);
      } catch (e) { /* ランタイム側の保存は任意 */ }
    }

    function adopt(json) {
      if (!json) return false;
      try {
        var v = JSON.parse(json);
        if (Array.isArray(v) && v.length === state.length) {
          state = v;
          paint();
          return true;
        }
      } catch (e) { /* 壊れた値は無視して初期状態のまま */ }
      return false;
    }

    function load() {
      if (adopt(readLocal(pre))) return;
      try {
        if (window.storage && window.storage.get) {
          window.storage.get(PREFIX + pre).then(function (r) {
            if (r && r.value) adopt(r.value);
          }).catch(function () {});
        }
      } catch (e) { /* 同上 */ }
    }

    items.forEach(function (li, i) {
      li.setAttribute("role", "button");
      li.setAttribute("tabindex", "0");
      li.setAttribute("aria-pressed", "false");
      function toggle() {
        state[i] = !state[i];
        li.setAttribute("aria-pressed", String(state[i]));
        paint();
        save();
      }
      li.addEventListener("click", toggle);
      li.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });
    });

    if (btn) btn.addEventListener("click", function () {
      state = state.map(function () { return false; });
      items.forEach(function (li) { li.setAttribute("aria-pressed", "false"); });
      paint();
      save();
    });

    paint();
    load();
  });
})();
