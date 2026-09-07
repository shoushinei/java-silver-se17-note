/* コードブロックの簡易シンタックスハイライト。
   pre code の textContent を読み、キーワード／文字列／行コメント／数値だけを
   span で包む。外部ライブラリを持ち込まないための最小実装。*/
(function () {
  var KW = "abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|var|record|sealed|permits|yield|true|false|null";
  var RE = new RegExp("(\\/\\/[^\\n]*)|(\"(?:[^\"\\\\]|\\\\.)*\")|\\b(" + KW + ")\\b|\\b(\\d+)\\b","g");
  function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  document.querySelectorAll("pre code").forEach(function(el){
    var src = el.textContent, out = "", last = 0, m;
    RE.lastIndex = 0;
    while((m = RE.exec(src)) !== null){
      out += esc(src.slice(last, m.index));
      if(m[1]) out += '<span class="c">' + esc(m[1]) + '</span>';
      else if(m[2]) out += '<span class="s">' + esc(m[2]) + '</span>';
      else if(m[3]) out += '<span class="k">' + esc(m[3]) + '</span>';
      else out += '<span class="n">' + esc(m[4]) + '</span>';
      last = m.index + m[0].length;
    }
    out += esc(src.slice(last));
    el.innerHTML = out;
  });
})();
