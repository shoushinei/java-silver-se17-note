/* .mk（マーカー線）を、画面に入った瞬間に引く演出。
   IntersectionObserver 非対応環境では最初から引いた状態にする。*/
(function () {
  var marks = document.querySelectorAll(".mk");
  if("IntersectionObserver" in window){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("lit"); io.unobserve(e.target); } });
    },{rootMargin:"0px 0px -12% 0px"});
    marks.forEach(function(m){ io.observe(m); });
  } else { marks.forEach(function(m){ m.classList.add("lit"); }); }
})();
