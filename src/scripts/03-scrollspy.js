/* スクロール位置に追従して、目次の現在地に .on を付ける。*/
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
  var secs = links.map(function(a){ return document.querySelector(a.getAttribute("href")); });
  function spy(){
    var best = 0, y = window.scrollY + 120;
    secs.forEach(function(s,i){ if(s && s.offsetTop <= y) best = i; });
    links.forEach(function(a,i){ a.classList.toggle("on", i === best); });
  }
  var tick = false;
  window.addEventListener("scroll", function(){
    if(!tick){ tick = true; requestAnimationFrame(function(){ spy(); tick = false; }); }
  }, {passive:true});
  spy();
})();
