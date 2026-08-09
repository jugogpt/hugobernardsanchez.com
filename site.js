(function () {
  var body = document.body;
  if (!body) return;

  requestAnimationFrame(function () {
    body.classList.add("page-ready");
  });

  function isModifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
  }

  function flashBackground() {
    body.classList.remove("click-fade");
    void body.offsetWidth;
    body.classList.add("click-fade");
    window.setTimeout(function () {
      body.classList.remove("click-fade");
    }, 420);
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a");
    if (!link || !link.href || link.getAttribute("href") === "#") return;
    if (isModifiedClick(event)) return;

    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (err) {
      return;
    }

    var sameOrigin = url.origin === window.location.origin;
    var newTab = link.target === "_blank";
    flashBackground();

    if (!sameOrigin || newTab) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    event.preventDefault();
    body.classList.add("page-exit");
    window.setTimeout(function () {
      window.location.href = url.href;
    }, 180);
  });
})();
