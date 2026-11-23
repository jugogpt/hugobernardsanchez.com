(function () {
  var body = document.body;
  if (!body) return;

  var SWIPE_MS = 220;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COUNTER_HIT = "https://abacus.jasoncameron.dev/hit/hugobsanchez.com/home";
  // /info is more reliable than /get (which has been returning intermittent 500s)
  var COUNTER_GET = "https://abacus.jasoncameron.dev/info/hugobsanchez.com/home";
  var POLL_MS = 12000;
  var FETCH_MS = 8000;
  var STORAGE_KEY = "hugobsanchez-views";
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

  function readStoredViews() {
    try {
      var stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored != null) {
        var parsed = parseInt(stored, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch (err) {}
    return null;
  }

  function setViews(n) {
    n = Number(n);
    if (isNaN(n)) return;
    var prev = currentViews;

    if (prev === null) {
      var stored = readStoredViews();
      if (stored !== null) prev = stored;
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
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer =
      ctrl &&
      window.setTimeout(function () {
        ctrl.abort();
      }, FETCH_MS);

    return fetch(url, {
      cache: "no-store",
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("counter failed");
        return res.json();
      })
      .finally(function () {
        if (timer) window.clearTimeout(timer);
      });
  }

  function parseCounterValue(data) {
    if (!data) return null;
    var v = data.value;
    if (typeof v === "number" && !isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      var n = Number(v);
      if (!isNaN(n)) return n;
    }
    return null;
  }

  function refreshViews(increment) {
    var url = increment ? COUNTER_HIT : COUNTER_GET;
    return fetchJson(url)
      .then(function (data) {
        var value = parseCounterValue(data);
        if (value != null) setViews(value);
      })
      .catch(function () {
        // Abacus /get has been flaky; try /hit only on first paint fallback already done via cache
        if (increment) {
          return fetchJson("https://abacus.jasoncameron.dev/get/hugobsanchez.com/home")
            .then(function (data) {
              var value = parseCounterValue(data);
              if (value != null) setViews(value);
            })
            .catch(function () {});
        }
      });
  }

  if (document.getElementById("views-count")) {
    var cached = readStoredViews();
    if (cached !== null) {
      currentViews = cached;
      renderViews(cached, false);
    }
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
