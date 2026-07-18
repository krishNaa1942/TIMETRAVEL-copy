/* =======================================================
 * Time Travel – Dynamic UI Module
 * Scroll-reveal animations, animated counters, staggered
 * entrance effects — makes the app feel alive
 * ======================================================= */

(function () {
  "use strict";

  // ── Scroll-reveal IntersectionObserver ──
  const REVEAL_OPTS = {
    threshold: 0.12,
    rootMargin: "0px 0px -60px 0px",
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        revealObserver.unobserve(entry.target); // only animate once
      }
    });
  }, REVEAL_OPTS);

  // Expose globally for router to use on lazy-loaded content
  window._ttRevealObserver = revealObserver;

  // ── Auto-apply reveal-on-scroll to key elements ──
  function applyRevealClasses(root) {
    if (!root) root = document;

    // Section headers & titles
    root
      .querySelectorAll(
        "section > .section-title, section > .section-subtitle, " +
          ".section-header, .tool-section-title",
      )
      .forEach((el) => {
        if (!el.classList.contains("reveal-on-scroll")) {
          el.classList.add("reveal-on-scroll");
        }
      });

    // Feature cards, tool cards, testimonial cards
    root
      .querySelectorAll(
        ".feature-card, .tool-card, .testimonial-card, " +
          ".hiw-step, .booking-card, .news-card",
      )
      .forEach((el) => {
        if (!el.classList.contains("reveal-on-scroll")) {
          el.classList.add("reveal-on-scroll", "reveal-scale");
        }
      });

    // Major sections — base reveal
    root.querySelectorAll("section[id]").forEach((sec) => {
      // Don't add to the hero — it's already visible on load
      if (sec.id === "hero") return;
      // Only add to sections that don't already have the class
      if (!sec.classList.contains("reveal-on-scroll")) {
        sec.classList.add("reveal-on-scroll");
      }
    });

    // Stagger parent containers
    root
      .querySelectorAll(
        ".features-grid, .hiw-steps, .testimonials-track, " +
          ".booking-grid, .news-grid",
      )
      .forEach((grid) => {
        if (!grid.classList.contains("reveal-stagger")) {
          grid.classList.add("reveal-stagger");
        }
      });
  }

  // ── Observe all reveal elements ──
  function observeAll(root) {
    if (!root) root = document;
    // Avoid forcing layout for every element during startup.
    // Let IntersectionObserver decide visibility instead of sync rect checks.
    root.querySelectorAll(".reveal-on-scroll").forEach((el) => {
      revealObserver.observe(el);
    });
  }

  // ── Animated counter ──
  function animateCounter(el) {
    const target = parseInt(el.dataset.countTarget, 10);
    if (isNaN(target)) return;
    const duration = parseInt(el.dataset.countDuration, 10) || 2000;
    const suffix = el.dataset.countSuffix || "";
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = Math.round(eased * target);
      el.textContent = current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  // ── Counter observer ──
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 },
  );

  function observeCounters(root) {
    if (!root) root = document;
    root.querySelectorAll(".count-up[data-count-target]").forEach((el) => {
      el.textContent = "0";
      counterObserver.observe(el);
    });
  }

  // ── Initialize ──
  function init() {
    applyRevealClasses();
    observeAll();
    observeCounters();

    // Re-apply when lazy-loaded content arrives
    window.addEventListener("routecontentloaded", (e) => {
      const container = e.detail.container;
      applyRevealClasses(container);
      observeAll(container);
      observeCounters(container);
    });

    // Also apply when route changes (for already-loaded content)
    window.addEventListener("routechange", (e) => {
      const route = e.detail.route;
      const page = document.querySelector(`.route-page[data-route="${route}"]`);
      if (page) {
        // Re-observe any un-revealed elements
        page
          .querySelectorAll(".reveal-on-scroll:not(.revealed)")
          .forEach((el) => revealObserver.observe(el));
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
