(function () {
  "use strict";

  var data = window.__BRAND__ || {};
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fineHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };

  function safe(fn, name) {
    try { fn(); } catch (e) { if (window.console) console.warn("[" + name + "] failed:", e); }
  }

  /* ---------------------------------------------------------------
     Urgency countdown — 24h, persisted per-visitor in localStorage.
     Does NOT reset on refresh; only starts a new 24h window once the
     previous one has actually expired.
     --------------------------------------------------------------- */
  function initUrgencyCountdown() {
    var wrap = $("#urgencyTimer");
    if (!wrap) return;
    var hEl = wrap.querySelector("[data-h]");
    var mEl = wrap.querySelector("[data-m]");
    var sEl = wrap.querySelector("[data-s]");
    var STORAGE_KEY = "granads_deadline";
    var DURATION_MS = 24 * 60 * 60 * 1000;
    var deadline = null;

    try {
      var stored = window.localStorage ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        var parsed = parseInt(stored, 10);
        if (parsed && parsed > Date.now()) deadline = parsed;
      }
      if (!deadline) {
        deadline = Date.now() + DURATION_MS;
        if (window.localStorage) localStorage.setItem(STORAGE_KEY, String(deadline));
      }
    } catch (err) {
      // localStorage unavailable (private mode, etc.) — fall back to a
      // session-only countdown so the bar still works.
      deadline = Date.now() + DURATION_MS;
    }

    function pad(n) { return String(n).padStart(2, "0"); }

    function tick() {
      var remaining = deadline - Date.now();
      if (remaining <= 0) {
        // cycle renews — start a fresh 24h window
        deadline = Date.now() + DURATION_MS;
        try { if (window.localStorage) localStorage.setItem(STORAGE_KEY, String(deadline)); } catch (err) {}
        remaining = DURATION_MS;
      }
      var totalSec = Math.floor(remaining / 1000);
      var h = Math.floor(totalSec / 3600);
      var m = Math.floor((totalSec % 3600) / 60);
      var s = totalSec % 60;
      if (hEl) hEl.textContent = pad(h);
      if (mEl) mEl.textContent = pad(m);
      if (sEl) sEl.textContent = pad(s);
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------------
     Nav: solidify on scroll
     --------------------------------------------------------------- */
  function initNav() {
    var nav = $("#siteNav");
    if (!nav) return;
    function onScroll() {
      if (window.scrollY > 24) nav.classList.add("is-scrolled");
      else nav.classList.remove("is-scrolled");
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------------------------------------------------------------
     Reveal on scroll (IntersectionObserver, threshold low + safety net)
     --------------------------------------------------------------- */
  function initReveals() {
    var targets = $$(".reveal");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -40px 0px" });

    targets.forEach(function (el) { io.observe(el); });

    // 6s safety net — reveal anything still hidden (stale JS / edge cases)
    setTimeout(function () {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
    }, 6000);
  }

  /* ---------------------------------------------------------------
     Pipeline steps — staggered reveal inside hero card
     --------------------------------------------------------------- */
  function initPipelineFlow() {
    var steps = $$("#pipelineFlow [data-step]");
    if (!steps.length) return;
    steps.forEach(function (el, i) {
      setTimeout(function () { el.classList.add("is-in"); }, 220 + i * 160);
    });
  }

  /* ---------------------------------------------------------------
     Count-up numbers
     --------------------------------------------------------------- */
  function initCountUp() {
    var els = $$("[data-count-to]");
    if (!els.length) return;

    function run(el) {
      if (el.dataset.counted) return;
      el.dataset.counted = "1";
      var target = parseInt(el.getAttribute("data-count-to"), 10) || 0;
      var duration = reduced ? 0 : 1400;
      if (duration === 0) { el.textContent = target.toLocaleString("es-ES"); return; }
      var start = null;
      function step(ts) {
        if (!start) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target).toLocaleString("es-ES");
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target.toLocaleString("es-ES");
      }
      requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) { els.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
    // 6s safety net — run any counters that never crossed the threshold
    setTimeout(function () { els.forEach(run); }, 6000);
  }

  /* ---------------------------------------------------------------
     FAQ accordion
     --------------------------------------------------------------- */
  function initFaq() {
    var items = $$(".faq-item");
    if (!items.length) return;
    items.forEach(function (item) {
      var q = item.querySelector(".faq-q");
      var a = item.querySelector(".faq-a");
      if (!q || !a || q.dataset.bound) return;
      q.dataset.bound = "1";
      q.addEventListener("click", function () {
        var isOpen = item.classList.contains("is-open");
        items.forEach(function (other) {
          other.classList.remove("is-open");
          var otherQ = other.querySelector(".faq-q");
          var otherA = other.querySelector(".faq-a");
          if (otherQ) otherQ.setAttribute("aria-expanded", "false");
          if (otherA) otherA.style.maxHeight = "";
        });
        if (!isOpen) {
          item.classList.add("is-open");
          q.setAttribute("aria-expanded", "true");
          a.style.maxHeight = a.scrollHeight + "px";
        }
      });
    });
  }

  /* ---------------------------------------------------------------
     Tilt on the hero pipeline card (fine pointers only)
     --------------------------------------------------------------- */
  function initTilt() {
    if (!fineHover) return;
    var cards = $$("[data-tilt]");
    cards.forEach(function (card) {
      if (card.dataset.tiltBound) return;
      card.dataset.tiltBound = "1";
      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = "perspective(900px) rotateY(" + (x * 5) + "deg) rotateX(" + (y * -5) + "deg)";
      });
      card.addEventListener("mouseout", function (e) {
        if (card.contains(e.relatedTarget)) return;
        card.style.transform = "";
      });
    });
  }

  /* ---------------------------------------------------------------
     Custom cursor — hidden until first mousemove
     --------------------------------------------------------------- */
  function initCursor() {
    if (!fineHover) return;
    var dot = $(".cursor-dot");
    var ring = $(".cursor-ring");
    if (!dot || !ring) return;
    var firstMove = false;
    var rx = 0, ry = 0, mx = 0, my = 0;

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate3d(" + (mx - 3) + "px," + (my - 3) + "px,0)";
      if (!firstMove) {
        firstMove = true;
        rx = mx; ry = my;
        ring.style.transform = "translate3d(" + (rx - 17) + "px," + (ry - 17) + "px,0)";
        dot.classList.add("is-ready");
        ring.classList.add("is-ready");
      }
    });

    function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = "translate3d(" + (rx - 17) + "px," + (ry - 17) + "px,0)";
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------
     Magnetic CTA buttons
     --------------------------------------------------------------- */
  function initMagnetic() {
    if (!fineHover) return;
    $$(".btn-primary").forEach(function (btn) {
      if (btn.dataset.magBound) return;
      btn.dataset.magBound = "1";
      btn.addEventListener("mousemove", function (e) {
        var rect = btn.getBoundingClientRect();
        var x = (e.clientX - rect.left - rect.width / 2) * 0.25;
        var y = (e.clientY - rect.top - rect.height / 2) * 0.25;
        btn.style.transform = "translate(" + x + "px," + y + "px)";
      });
      btn.addEventListener("mouseout", function (e) {
        if (btn.contains(e.relatedTarget)) return;
        btn.style.transform = "";
      });
    });
  }

  /* ---------------------------------------------------------------
     Smooth anchor scroll (native, offset by nav height)
     --------------------------------------------------------------- */
  function initAnchorScroll() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      var navH = 84 + 46; // nav + urgency bar
      var top = el.getBoundingClientRect().top + window.scrollY - navH + 1;
      window.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" });
    });
  }

  /* ---------------------------------------------------------------
     Application form -> builds a WhatsApp deep link with the answers
     --------------------------------------------------------------- */
  function initApplyForm() {
    var form = $("#applyForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      var fd = new FormData(form);
      var lines = [
        "Hola, quiero aplicar al Pipeline Sprint:",
        "Nombre: " + (fd.get("nombre") || ""),
        "WhatsApp: " + (fd.get("whatsapp") || ""),
        "Empresa: " + (fd.get("empresa") || "-"),
        "País/ciudad: " + (fd.get("ciudad") || "-"),
        "Qué vende: " + (fd.get("vende") || ""),
        "Ticket promedio: " + (fd.get("ticket") || ""),
        "¿Ya vendió esta oferta?: " + (fd.get("vendido") || ""),
        "Inversión mensual en publicidad: " + (fd.get("inversion") || ""),
        "Canal de venta: " + (fd.get("canal") || ""),
        "Tiempo de respuesta a prospectos: " + (fd.get("respuesta") || "-"),
        "¿Tiene testimonios?: " + (fd.get("testimonios") || ""),
        "Sprint preferido: " + (fd.get("sprint") || "")
      ];
      var text = encodeURIComponent(lines.join("\n"));
      var phone = (data.whatsapp || "").replace(/\D/g, "");
      var url = "https://wa.me/" + phone + "?text=" + text;

      // Best-effort: also try to store the lead locally so nothing is lost
      // if the redirect is interrupted (see note to the team about a real backend).
      try {
        if (window.localStorage) {
          var leads = JSON.parse(localStorage.getItem("granads_leads") || "[]");
          leads.push({ at: new Date().toISOString(), data: Object.fromEntries(fd.entries()) });
          localStorage.setItem("granads_leads", JSON.stringify(leads));
        }
      } catch (err) {}

      window.open(url, "_blank", "noopener");
      window.location.href = "gracias.html";
    });
  }

  /* ---------------------------------------------------------------
     Footer year
     --------------------------------------------------------------- */
  function initFooterYear() {
    var el = $("#footYear");
    if (el) el.textContent = data.year || new Date().getFullYear();
  }

  /* ---------------------------------------------------------------
     Boot
     --------------------------------------------------------------- */
  function boot() {
    safe(initUrgencyCountdown, "initUrgencyCountdown");
    safe(initNav, "initNav");
    safe(initReveals, "initReveals");
    safe(initPipelineFlow, "initPipelineFlow");
    safe(initCountUp, "initCountUp");
    safe(initFaq, "initFaq");
    safe(initTilt, "initTilt");
    safe(initCursor, "initCursor");
    safe(initMagnetic, "initMagnetic");
    safe(initAnchorScroll, "initAnchorScroll");
    safe(initApplyForm, "initApplyForm");
    safe(initFooterYear, "initFooterYear");
    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
