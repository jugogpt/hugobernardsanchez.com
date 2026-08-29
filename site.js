(function () {
  var body = document.body;
  if (!body) return;

  var SWIPE_MS = 220;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COUNTER_HIT = "https://abacus.jasoncameron.dev/hit/hugobsanchez.com/home";
  var COUNTER_GET = "https://abacus.jasoncameron.dev/get/hugobsanchez.com/home";
  var POLL_MS = 12000;

  function revealPage() {
    body.classList.remove("page-exit", "swipe-out", "swipe-reveal");
    body.classList.add("swipe-cover");

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        body.classList.add("page-ready", "swipe-reveal");
        window.setTimeout(function () {
          body.classList.remove("swipe-cover", "swipe-reveal");
        }, SWIPE_MS);
      });
    });
  }

  if (reduced) {
    body.classList.add("page-ready");
  } else {
    revealPage();
  }

  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      body.classList.remove("page-exit", "swipe-out");
      if (reduced) {
        body.classList.add("page-ready");
      } else {
        revealPage();
      }
    }
  });

  function isModifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
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
    if (!sameOrigin || newTab || reduced) return;

    event.preventDefault();
    body.classList.remove("page-ready", "swipe-cover", "swipe-reveal");
    body.classList.add("page-exit", "swipe-out");
    window.setTimeout(function () {
      window.location.href = url.href;
    }, SWIPE_MS);
  });

  function formatCount(n) {
    return Number(n).toLocaleString("en-US");
  }

  function setViews(n) {
    var el = document.getElementById("views-count");
    if (!el || n == null || isNaN(n)) return;
    el.textContent = formatCount(n);
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("counter failed");
      return res.json();
    });
  }

  function refreshViews(increment) {
    var url = increment ? COUNTER_HIT : COUNTER_GET;
    return fetchJson(url)
      .then(function (data) {
        if (data && typeof data.value === "number") {
          setViews(data.value);
        }
      })
      .catch(function () {
        /* keep current display */
      });
  }

  if (document.getElementById("views-count")) {
    refreshViews(true);
    window.setInterval(function () {
      refreshViews(false);
    }, POLL_MS);
  }
})();
