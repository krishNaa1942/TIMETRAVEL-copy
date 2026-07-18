/* =======================================================
 * Time Travel - Navbar - Mobile toggle, scroll handler, preloader, init orchestration
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
// NAVBAR – mobile toggle + smooth scroll active state
// ═══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // Run heavy UI initializers in small chunks to avoid long main-thread blocks.
  const runWhenIdle = (fn) => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(
        () => {
          try {
            fn();
          } catch (err) {
            console.error("Deferred init failed:", err);
          }
        },
        { timeout: 1200 },
      );
    } else {
      setTimeout(() => {
        try {
          fn();
        } catch (err) {
          console.error("Deferred init failed:", err);
        }
      }, 0);
    }
  };

  const runInitQueue = (tasks, chunkSize = 2) => {
    let idx = 0;
    const next = () => {
      const slice = tasks.slice(idx, idx + chunkSize);
      slice.forEach((task) => runWhenIdle(task));
      idx += chunkSize;
      if (idx < tasks.length) setTimeout(next, 32);
    };
    next();
  };

  // ── Page Preloader ──────────────────────────────────────
  const preloader = document.getElementById("preloader");
  if (preloader) {
    window.addEventListener("load", () => {
      setTimeout(() => {
        preloader.classList.add("hidden");
        preloader.addEventListener("transitionend", () => preloader.remove());
      }, 600);
    });
    // Fallback: remove after 4s even if load hasn't fired
    setTimeout(() => {
      if (preloader && !preloader.classList.contains("hidden")) {
        preloader.classList.add("hidden");
      }
    }, 4000);
  }

  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  const navbar = document.getElementById("mainNav");

  const closeMobileMenu = () => {
    if (links) links.classList.remove("open");
    if (toggle) {
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
    document.body.classList.remove("nav-menu-open");
  };

  // ── Animated Hamburger Toggle ───────────────────────────
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const willOpen = links && !links.classList.contains("open");
      links.classList.toggle("open", willOpen);
      toggle.classList.toggle("open", willOpen);
      toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      document.body.classList.toggle("nav-menu-open", willOpen);
    });
  }

  // ESC closes mobile menu quickly
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && links && links.classList.contains("open")) {
      closeMobileMenu();
    }
  });

  // Close mobile menu on link click
  document.querySelectorAll(".nav-links a").forEach((a) => {
    a.addEventListener("click", () => {
      closeMobileMenu();
    });
  });

  // Close mobile menu when clicking outside
  document.addEventListener("click", (e) => {
    if (
      links &&
      links.classList.contains("open") &&
      !navbar.contains(e.target)
    ) {
      closeMobileMenu();
    }
  });

  // ── Auth button delegation (removed inline onclick) ──
  const navLoginBtn = document.getElementById("navLoginBtn");
  const navLogoutBtn = document.getElementById("navLogoutBtn");
  const navMobileLoginBtn = document.getElementById("navMobileLoginBtn");
  if (navLoginBtn)
    navLoginBtn.addEventListener("click", () => {
      if (typeof openAuthModal === "function") openAuthModal("login");
    });
  if (navLogoutBtn)
    navLogoutBtn.addEventListener("click", () => {
      if (typeof handleLogout === "function") handleLogout();
    });
  if (navMobileLoginBtn)
    navMobileLoginBtn.addEventListener("click", () => {
      if (typeof openAuthModal === "function") openAuthModal("login");
    });

  // ── Scroll: active link, shrink, auto‑hide, progress bar, breadcrumb ──
  const sections = document.querySelectorAll("section[id]");
  const navHashLinks = document.querySelectorAll(
    ".nav-links a[href^='#'], .nav-mega-menu a[href^='#']",
  );
  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const progressBar = document.getElementById("navProgressBar");
  const breadcrumb = document.getElementById("navBreadcrumb");
  const breadcrumbText = document.getElementById("navBreadcrumbText");
  const sectionNames = {
    hero: "Home",
    features: "Highlights",
    howItWorks: "How It Works",
    destinations: "Destinations",
    chatbot: "AI Chat",
    compare: "Compare",
    itinerary: "Itinerary",
    budget: "Packages",
    safety: "Safety",
    weather: "Weather",
    maps: "Maps",
    places: "Experiences",
    news: "Blog",
    booking: "Packages",
    currency: "Currency",
    language: "Phrases",
    expenses: "Expenses",
    packingChecklist: "Packing",
    tripDashboard: "Trip Dashboard",
    journal: "Journal",
    wishlist: "Wishlist",
    history: "Trip History",
  };
  let lastScrollY = 0;
  let scrollTicking = false;
  let navHidden = false;

  function onScroll() {
    const y = window.scrollY;

    // Active nav link + breadcrumb (single pass over sections)
    let current = "";
    for (let i = 0; i < sections.length; i += 1) {
      const sec = sections[i];
      if (y >= sec.offsetTop - 120) current = sec.id;
    }
    for (let i = 0; i < navHashLinks.length; i += 1) {
      const a = navHashLinks[i];
      a.classList.toggle("active", a.getAttribute("href") === "#" + current);
    }

    // Breadcrumb (merged — no separate scroll listener)
    if (breadcrumb && breadcrumbText) {
      if (y < 300) {
        breadcrumb.classList.remove("visible");
      } else {
        breadcrumb.classList.add("visible");
        breadcrumbText.textContent = sectionNames[current] || current || "Home";
      }
    }

    // Navbar shrink responds early so the compression feels connected to scroll.
    if (navbar) navbar.classList.toggle("scrolled", y > 72);

    // Auto-hide on scroll down, show on scroll up
    // Disabled when mobile menu is open
    const mobileMenuOpen = links && links.classList.contains("open");
    if (navbar && y > 220 && !mobileMenuOpen && window.innerWidth > 1024) {
      const delta = y - lastScrollY;
      if (delta > 12 && !navHidden) {
        navbar.classList.add("nav-hidden");
        navHidden = true;
      } else if (delta < -10 && navHidden) {
        navbar.classList.remove("nav-hidden");
        navHidden = false;
      }
    } else if (navbar && navHidden) {
      navbar.classList.remove("nav-hidden");
      navHidden = false;
    }
    lastScrollY = y;

    // Scroll-to-top visibility
    if (scrollTopBtn) scrollTopBtn.classList.toggle("visible", y > 500);

    // Page progress bar
    if (progressBar) {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? (y / docH) * 100 : 0;
      progressBar.style.width = pct + "%";
    }

    scrollTicking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!scrollTicking) {
        requestAnimationFrame(onScroll);
        scrollTicking = true;
      }
    },
    { passive: true },
  );

  // Sync navbar state immediately on load/refresh to avoid first-scroll snapping.
  requestAnimationFrame(onScroll);

  // Scroll-to-top click
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Keep critical nav UX immediate.
  initNavSearch();
  initUserAvatar();

  // Defer non-critical feature initializers to reduce long tasks during startup.
  runInitQueue([
    () => typeof initDarkModeToggle === "function" && initDarkModeToggle(),
    () => typeof initTooltips === "function" && initTooltips(),
    () => typeof initButtonRipple === "function" && initButtonRipple(),
    () => typeof initStatCounters === "function" && initStatCounters(),
    () => typeof initRevealOnScroll === "function" && initRevealOnScroll(),
    () => typeof initCursorGlow === "function" && initCursorGlow(),
    () => typeof initStaggerReveal === "function" && initStaggerReveal(),
    () => typeof initTiltCards === "function" && initTiltCards(),
    () => typeof initMagneticButtons === "function" && initMagneticButtons(),
    () => typeof initSplitReveal === "function" && initSplitReveal(),
    () => typeof initHeroSlideshow === "function" && initHeroSlideshow(),
    () => typeof initHeroSearch === "function" && initHeroSearch(),
    () => typeof initHeroProofCountUp === "function" && initHeroProofCountUp(),
    () => typeof initHeroExploreBtn === "function" && initHeroExploreBtn(),
    () => typeof initHowItWorks === "function" && initHowItWorks(),
    () => typeof initBookingSection === "function" && initBookingSection(),
    () =>
      typeof initCurrencyConverter === "function" && initCurrencyConverter(),
    () => typeof initLanguageSection === "function" && initLanguageSection(),
    () => typeof initExpenseTracker === "function" && initExpenseTracker(),
    () => typeof initPackingChecklist === "function" && initPackingChecklist(),
    () => typeof initJournal === "function" && initJournal(),
  ]);
});
