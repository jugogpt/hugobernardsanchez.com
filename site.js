(function () {
  var body = document.body;
  if (!body) return;

  var SWIPE_MS = 220;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COUNTER_HIT = "https://abacus.jasoncameron.dev/hit/hugobsanchez.com/home";
  var COUNTER_GET = "https://abacus.jasoncameron.dev/get/hugobsanchez.com/home";
  var POLL_MS = 12000;
  var currentViews = null;

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

  function ensureDigitSlot(container, index, isSep) {
    var slots = container.children;
    var slot = slots[index];
    if (!slot || slot.classList.contains("is-sep") !== isSep) {
      slot = document.createElement("span");
      slot.className = isSep ? "digit-slot is-sep" : "digit-slot";
      if (isSep) {
        slot.innerHTML = '<span class="digit-sep">,</span>';
      } else {
        var reel = document.createElement("span");
        reel.className = "digit-reel";
        for (var d = 0; d <= 9; d++) {
          var span = document.createElement("span");
          span.textContent = String(d);
          reel.appendChild(span);
        }
        slot.appendChild(reel);
      }
      if (slots[index]) {
        container.replaceChild(slot, slots[index]);
      } else {
        container.appendChild(slot);
      }
    }
    return slot;
  }

  function setDigit(slot, digit, animate, fromDigit) {
    var reel = slot.querySelector(".digit-reel");
    if (!reel) return;
    var end = -digit * 1.15;
    if (!animate || reduced) {
      reel.style.transition = "none";
      reel.style.transform = "translateY(" + end + "em)";
      void reel.offsetHeight;
      reel.style.transition = "";
      return;
    }

    var startDigit = typeof fromDigit === "number" ? fromDigit : 0;
    reel.style.transition = "none";
    reel.style.transform = "translateY(" + -startDigit * 1.15 + "em)";
    void reel.offsetHeight;
    reel.style.transition = "";
    requestAnimationFrame(function () {
      reel.style.transform = "translateY(" + end + "em)";
    });
  }

  function renderViews(n, animate, fromN) {
    var el = document.getElementById("views-count");
    if (!el || n == null || isNaN(n)) return;

    var text = formatCount(n);
    var fromText = fromN != null && !isNaN(fromN) ? formatCount(fromN) : "";
    el.setAttribute("aria-label", text + " views");

    while (el.children.length > text.length) {
      el.removeChild(el.lastChild);
    }

    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === ",") {
        ensureDigitSlot(el, i, true);
      } else {
        var slot = ensureDigitSlot(el, i, false);
        var fromCh = fromText.length === text.length ? fromText.charAt(i) : "0";
        var fromDigit = fromCh >= "0" && fromCh <= "9" ? parseInt(fromCh, 10) : 0;
        setDigit(slot, parseInt(ch, 10), animate, fromDigit);
      }
    }
  }

  function setViews(n) {
    var STORAGE_KEY = "hugobsanchez-views";
    var prev = currentViews;

    if (prev === null) {
      try {
        var stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored != null) prev = parseInt(stored, 10);
      } catch (err) {}
      if (prev === null || isNaN(prev)) {
        prev = Math.max(0, n - 1);
      }

      currentViews = prev;
      renderViews(prev, false);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          currentViews = n;
          renderViews(n, true, prev);
          try {
            sessionStorage.setItem(STORAGE_KEY, String(n));
          } catch (err2) {}
        });
      });
      return;
    }

    if (n === currentViews) return;
    var old = currentViews;
    currentViews = n;
    renderViews(n, true, old);
    try {
      sessionStorage.setItem(STORAGE_KEY, String(n));
    } catch (err3) {}
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

  // Silent private visit log — never blocks UI.
  function logVisit() {
    var payload = JSON.stringify({
      path: location.pathname + location.search,
      referrer: document.referrer || "",
      language: navigator.language || "",
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/visit",
          new Blob([payload], { type: "application/json" })
        );
        return;
      }
    } catch (err) {}
    try {
      fetch("/api/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        cache: "no-store",
      }).catch(function () {});
    } catch (err2) {}
  }

  setTimeout(logVisit, 0);
})();
