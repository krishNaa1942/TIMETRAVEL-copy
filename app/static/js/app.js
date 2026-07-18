/**
 * ═══════════════════════════════════════════════════════════
 * Time Travel – Frontend JavaScript
 * Handles all API interactions and dynamic UI rendering
 * ═══════════════════════════════════════════════════════════
 */

const API_BASE = window.location.origin;

// ── Helper: read CSRF token from <meta> tag ───────────────
function getCSRFToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute("content") : "";
}

// ── Helper: escape HTML to prevent XSS ────────────────────
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}
// Alias for legacy call sites (news section uses capital H)
const escapeHTML = escapeHtml;

// ── Helper: download PDF from API ─────────────────────────
async function downloadPDF(endpoint, payload, fallbackName) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "PDF export failed.", "error");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackName || "export.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("PDF downloaded!", "success");
  } catch (e) {
    showToast("Network error – could not download PDF.", "error");
  }
}

// ── Helper: toast notifications ────────────────────────────
const TOAST_ICONS = {
  error: "fas fa-exclamation-circle",
  warning: "fas fa-exclamation-triangle",
  success: "fas fa-check-circle",
  info: "fas fa-info-circle",
};

function showToast(message, type = "error", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.warn("Toast:", message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="toast-icon ${TOAST_ICONS[type] || TOAST_ICONS.info}"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  toast
    .querySelector(".toast-close")
    .addEventListener("click", () => removeToast(toast));
  container.appendChild(toast);

  const timer = setTimeout(() => removeToast(toast), duration);
  toast._timer = timer;
}

function removeToast(toast) {
  if (toast._removed) return;
  toast._removed = true;
  clearTimeout(toast._timer);
  toast.classList.add("toast-removing");
  toast.addEventListener("transitionend", () => toast.remove());
}

// ── Helper: show / hide loader ────────────────────────────
function showLoader() {
  document.getElementById("loader").style.display = "flex";
}
function hideLoader() {
  document.getElementById("loader").style.display = "none";
}

// ── Auto-clear validation highlight on user input ─────────
document.addEventListener("input", (e) => {
  if (e.target.classList.contains("input-invalid")) {
    e.target.classList.remove("input-invalid");
  }
});
document.addEventListener("change", (e) => {
  if (e.target.classList.contains("input-invalid")) {
    e.target.classList.remove("input-invalid");
  }
});

// ── Helper: format currency ───────────────────────────────
function formatINR(amount) {
  return (
    "₹" + Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })
  );
}

// ═══════════════════════════════════════════════════════════
// NAVBAR – mobile toggle + smooth scroll active state
// ═══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
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

  // ── Animated Hamburger Toggle ───────────────────────────
  if (toggle) {
    toggle.addEventListener("click", () => {
      links.classList.toggle("open");
      toggle.classList.toggle("open");
    });
  }

  // Close mobile menu on link click
  document.querySelectorAll(".nav-links a").forEach((a) => {
    a.addEventListener("click", () => {
      links.classList.remove("open");
      if (toggle) toggle.classList.remove("open");
    });
  });

  // Close mobile menu when clicking outside
  document.addEventListener("click", (e) => {
    if (
      links &&
      links.classList.contains("open") &&
      !navbar.contains(e.target)
    ) {
      links.classList.remove("open");
      if (toggle) toggle.classList.remove("open");
    }
  });

  // ── Auth button delegation (removed inline onclick) ──
  const navLoginBtn = document.getElementById("navLoginBtn");
  const navSignupBtn = document.getElementById("navSignupBtn");
  const navLogoutBtn = document.getElementById("navLogoutBtn");
  if (navLoginBtn)
    navLoginBtn.addEventListener("click", () => {
      if (typeof openAuthModal === "function") openAuthModal("login");
    });
  if (navSignupBtn)
    navSignupBtn.addEventListener("click", () => {
      if (typeof openAuthModal === "function") openAuthModal("register");
    });
  if (navLogoutBtn)
    navLogoutBtn.addEventListener("click", () => {
      if (typeof handleLogout === "function") handleLogout();
    });

  // ── Mobile utility buttons (search + theme inside nav panel) ──
  const mobileSearchBtn = document.getElementById("navMobileSearchBtn");
  const mobileThemeBtn = document.getElementById("navMobileThemeBtn");
  const mobileThemeIcon = document.getElementById("mobileThemeIcon");

  if (mobileSearchBtn) {
    mobileSearchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (links) links.classList.remove("open");
      if (toggle) toggle.classList.remove("open");
      const overlay = document.getElementById("navSearchOverlay");
      if (overlay) {
        overlay.classList.add("open");
        const inp = document.getElementById("navSearchInput");
        if (inp) setTimeout(() => inp.focus(), 120);
      }
    });
  }

  if (mobileThemeBtn && mobileThemeIcon) {
    const isSavedLight = localStorage.getItem("tt-theme") === "light";
    if (isSavedLight) {
      mobileThemeIcon.classList.remove("fa-moon");
      mobileThemeIcon.classList.add("fa-sun");
    }
    mobileThemeBtn.addEventListener("click", () => {
      const mainToggle = document.getElementById("themeToggle");
      if (mainToggle) mainToggle.click();
      const isLight = document.body.classList.contains("light-mode");
      mobileThemeIcon.classList.toggle("fa-moon", !isLight);
      mobileThemeIcon.classList.toggle("fa-sun", isLight);
    });
  }

  // ── Platform-aware keyboard hint ──
  const kbdHint = document.getElementById("navKbdHint");
  if (kbdHint) {
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
    kbdHint.textContent = isMac ? "⌘K" : "Ctrl+K";
  }

  // ── Scroll: active link, shrink, auto‑hide, progress bar, breadcrumb ──
  const sections = document.querySelectorAll("section[id]");
  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const progressBar = document.getElementById("navProgressBar");
  const breadcrumb = document.getElementById("navBreadcrumb");
  const breadcrumbText = document.getElementById("navBreadcrumbText");
  const sectionNames = {
    hero: "Home",
    features: "Features",
    howItWorks: "How It Works",
    destinations: "Destinations",
    chatbot: "AI Chat",
    compare: "Compare",
    itinerary: "Itinerary",
    budget: "Budget",
    safety: "Safety",
    weather: "Weather",
    maps: "Maps",
    places: "Places",
    news: "News",
    booking: "Booking",
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

    // Active nav link + breadcrumb — only track sections within active route-page
    let current = "";
    const activePage = document.querySelector(".route-page--active");
    const visibleSections = activePage
      ? activePage.querySelectorAll("section[id]")
      : sections;
    visibleSections.forEach((sec) => {
      if (y >= sec.offsetTop - 120) current = sec.id;
    });

    // Only update nav active state on home route (router handles it for other routes)
    if (!window.appRouter || window.appRouter.getCurrentRoute() === "home") {
      document
        .querySelectorAll(
          ".nav-links a[href^='#'], .nav-mega-menu a[href^='#']",
        )
        .forEach((a) => {
          a.classList.toggle(
            "active",
            a.getAttribute("href") === "#" + current,
          );
        });
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

    // Navbar shrink
    if (navbar) navbar.classList.toggle("scrolled", y > 80);

    // Auto-hide on scroll down, show on scroll up
    // Disabled when mobile menu is open
    const mobileMenuOpen = links && links.classList.contains("open");
    if (navbar && y > 200 && !mobileMenuOpen) {
      const delta = y - lastScrollY;
      if (delta > 8 && !navHidden) {
        navbar.classList.add("nav-hidden");
        navHidden = true;
      } else if (delta < -5 && navHidden) {
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

  // Scroll-to-top click
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ── Nav Quick Search ────────────────────────────────────
  initNavSearch();

  // ── User Avatar Initial ─────────────────────────────────
  initUserAvatar();

  // ── Animated Stat Counters ──────────────────────────────
  initStatCounters();

  // ── Scroll-Reveal Sections ──────────────────────────────
  initRevealOnScroll();

  // ── Dark Mode Toggle ────────────────────────────────────
  initDarkModeToggle();

  // ── Button Ripple Effect ────────────────────────────────
  initButtonRipple();

  // ── Tooltip System ──────────────────────────────────────
  initTooltips();

  // ── NEW: Advanced Homepage Interactions ─────────────────
  initCursorGlow();
  initStaggerReveal();
  initTiltCards();
  initMagneticButtons();
  initTestimonialsCarousel();
  initSplitReveal();

  // ── Hero Slideshow + Search ─────────────────────────────
  initHeroSlideshow();
  initHeroSearch();

  // ── How It Works – interactive steps ────────────────────
  initHowItWorks();

  // ── NEW: Wanderlog-competitive features ─────────────────
  initBookingSection();
  initCurrencyConverter();
  initLanguageSection();
  initExpenseTracker();
  initPackingChecklist();
  initJournal();
});

// ═══════════════════════════════════════════════════════════
// HOW IT WORKS – Interactive step cards with navigation
// ═══════════════════════════════════════════════════════════
function initHowItWorks() {
  const section = document.getElementById("howItWorks");
  const timeline = document.getElementById("hiwTimeline");
  const connectorFill = document.getElementById("hiwConnectorFill");
  const getStartedBtn = document.getElementById("hiwGetStarted");
  if (!section || !timeline) return;

  const steps = timeline.querySelectorAll(".hiw-step");
  const stepCTAs = timeline.querySelectorAll(".hiw-step-cta");
  let activeStep = -1;

  // ── Connector fill animation on scroll ──
  function updateConnector() {
    if (!connectorFill) return;
    const rect = section.getBoundingClientRect();
    const sectionH = rect.height;
    const viewH = window.innerHeight;
    // Progress: 0 when section top enters viewport, 1 when section bottom exits
    const progress = Math.min(
      1,
      Math.max(0, (viewH - rect.top) / (sectionH + viewH * 0.3)),
    );
    connectorFill.style.width = progress * 100 + "%";
  }

  // ── Active step highlight based on scroll ──
  function updateActiveStep() {
    const rect = section.getBoundingClientRect();
    const viewH = window.innerHeight;
    if (rect.top > viewH || rect.bottom < 0) return;

    // Calculate which step should be active based on section scroll progress
    const progress = Math.min(
      1,
      Math.max(0, (viewH - rect.top) / (rect.height + viewH * 0.2)),
    );
    const newActive = Math.min(
      steps.length - 1,
      Math.floor(progress * steps.length * 1.2),
    );

    if (newActive !== activeStep) {
      steps.forEach((s) => s.classList.remove("hiw-active"));
      if (newActive >= 0 && newActive < steps.length) {
        steps[newActive].classList.add("hiw-active");
      }
      activeStep = newActive;
    }
  }

  // Scroll listener (throttled with rAF)
  let hiwTicking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!hiwTicking) {
        requestAnimationFrame(() => {
          updateConnector();
          updateActiveStep();
          hiwTicking = false;
        });
        hiwTicking = true;
      }
    },
    { passive: true },
  );

  // ── Step CTA click → navigate to target section ──
  stepCTAs.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = btn.dataset.hiwTarget;
      if (target) {
        if (target === "destinations" && typeof openSmartHub === "function") {
          openSmartHub();
        } else {
          scrollToSection(target);
        }
      }
    });
  });

  // ── Clickable step cards → navigate to target ──
  steps.forEach((step) => {
    step.addEventListener("click", (e) => {
      // Don't navigate if they clicked the CTA button (it handles itself)
      if (e.target.closest(".hiw-step-cta")) return;
      const target = step.dataset.target;
      if (target) {
        if (target === "destinations" && typeof openSmartHub === "function") {
          openSmartHub();
        } else {
          scrollToSection(target);
        }
      }
    });
  });

  // ── "Start Exploring Now" CTA ──
  if (getStartedBtn) {
    getStartedBtn.addEventListener("click", () => {
      if (typeof openSmartHub === "function") {
        openSmartHub();
      } else {
        scrollToSection("destinations");
      }
    });
  }

  // Initial state
  updateConnector();
}

// ═══════════════════════════════════════════════════════════
// HERO PARTICLES – floating dots & connecting lines
// ═══════════════════════════════════════════════════════════
function initHeroParticles() {
  const canvas = document.getElementById("heroParticles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, particles;
  const PARTICLE_COUNT = 80;
  const CONNECT_DIST = 130;
  const MOUSE_RADIUS = 180;
  const mouse = { x: -9999, y: -9999 };
  const COLORS = [
    [20, 184, 166], // teal
    [245, 158, 11], // amber
    [139, 92, 246], // purple
    [6, 182, 212], // cyan
  ];

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const col = COLORS[Math.floor(Math.random() * COLORS.length)];
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2 + 1,
        o: Math.random() * 0.5 + 0.2,
        col: col,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    // Lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT_DIST) {
          const alpha = 0.12 * (1 - dist / CONNECT_DIST);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${particles[i].col.join(",")},${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    // Dots
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.col.join(",")},${p.o})`;
      ctx.fill();
    });
  }

  function update() {
    particles.forEach((p) => {
      // Mouse repulsion
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS && dist > 0) {
        const force = ((MOUSE_RADIUS - dist) / MOUSE_RADIUS) * 0.8;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
      // Dampen velocity
      p.vx *= 0.98;
      p.vy *= 0.98;
      // Clamp speed
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 2.5) {
        p.vx = (p.vx / speed) * 2.5;
        p.vy = (p.vy / speed) * 2.5;
      }
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
    });
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener("mouseleave", () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  resize();
  createParticles();
  loop();
  window.addEventListener("resize", () => {
    resize();
    createParticles();
  });
}

// ═══════════════════════════════════════════════════════════
// TYPEWRITER – hero subtitle text effect
// ═══════════════════════════════════════════════════════════
function initTypewriter() {
  const el = document.getElementById("heroSubtitle");
  if (!el) return;
  const phrases = [
    "AI-powered trip planning for budget-friendly family adventures across India",
    "Compare destinations, get safety scores & AI-generated itineraries",
    "Powered by Google Gemini, TomTom Maps & real-time weather data",
  ];
  let phraseIdx = 0,
    charIdx = 0,
    deleting = false;
  const TYPE_SPEED = 45,
    DELETE_SPEED = 25,
    PAUSE = 2200;

  function tick() {
    const current = phrases[phraseIdx];
    if (!deleting) {
      el.textContent = current.slice(0, charIdx + 1);
      charIdx++;
      if (charIdx === current.length) {
        setTimeout(() => {
          deleting = true;
          tick();
        }, PAUSE);
        return;
      }
      setTimeout(tick, TYPE_SPEED);
    } else {
      el.textContent = current.slice(0, charIdx - 1);
      charIdx--;
      if (charIdx === 0) {
        deleting = false;
        phraseIdx = (phraseIdx + 1) % phrases.length;
        setTimeout(tick, 400);
        return;
      }
      setTimeout(tick, DELETE_SPEED);
    }
  }
  setTimeout(tick, 800);
}

// ═══════════════════════════════════════════════════════════
// ANIMATED STAT COUNTERS – count up when visible
// ═══════════════════════════════════════════════════════════
function initStatCounters() {
  const nums = document.querySelectorAll(
    ".stat-num[data-count], .hero-stat-num[data-count]",
  );
  if (!nums.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 },
  );

  nums.forEach((n) => observer.observe(n));
}

function animateCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || "";
  const duration = 1800;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    // Ease-out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const val = Math.round(ease * target);
    el.textContent = val + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ═══════════════════════════════════════════════════════════
// SCROLL-REVEAL – fade-in sections on scroll
// ═══════════════════════════════════════════════════════════
function initRevealOnScroll() {
  const reveals = document.querySelectorAll("[data-reveal]");
  if (!reveals.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  reveals.forEach((el) => observer.observe(el));
}

// ═══════════════════════════════════════════════════════════
// NAV – Command Palette, Mega Dropdown, Notifications,
//        User Dropdown, Indicator, Breadcrumb
// ═══════════════════════════════════════════════════════════

/* ── Command Palette (Quick Search) ── */
function initCommandPalette() {
  const overlay = document.getElementById("navSearchOverlay");
  const input = document.getElementById("navSearchInput");
  const resultsList = document.getElementById("navSearchResults");
  const triggerBtn = document.getElementById("navSearchBtn");
  if (!overlay) return;

  // Build section list from ALL nav links (including mega-menu)
  const navItems = [];
  document
    .querySelectorAll("#navLinks a[href^='#'], .nav-mega-menu a[href^='#']")
    .forEach((a) => {
      const href = a.getAttribute("href");
      const icon = a.querySelector("i");
      const iconClass = icon ? icon.className : "fas fa-link";
      const labelEl =
        a.querySelector(".nav-mega-label") || a.querySelector("span") || a;
      const label = labelEl.textContent.trim();
      if (label && href && !navItems.some((i) => i.href === href)) {
        navItems.push({ href, label, iconClass });
      }
    });

  let highlighted = -1;

  function renderResults(filter) {
    const q = (filter || "").toLowerCase();
    const matches = q
      ? navItems.filter((i) => i.label.toLowerCase().includes(q))
      : navItems;
    if (!matches.length) {
      resultsList.innerHTML =
        '<li class="nav-search-empty">No sections found</li>';
      highlighted = -1;
      return;
    }
    resultsList.innerHTML = matches
      .map(
        (item, idx) =>
          `<li><a href="${item.href}" data-idx="${idx}"><i class="${item.iconClass}"></i>${item.label}</a></li>`,
      )
      .join("");
    highlighted = -1;
  }

  function highlightItem(idx) {
    const items = resultsList.querySelectorAll("a");
    items.forEach((a) => a.classList.remove("highlighted"));
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add("highlighted");
      items[idx].scrollIntoView({ block: "nearest" });
    }
    highlighted = idx;
  }

  function openSearch() {
    overlay.classList.add("open");
    renderResults("");
    setTimeout(() => input.focus(), 80);
  }

  function closeSearch() {
    overlay.classList.remove("open");
    input.value = "";
    highlighted = -1;
  }

  if (triggerBtn) {
    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openSearch();
    });
  }

  input.addEventListener("input", () => renderResults(input.value));

  input.addEventListener("keydown", (e) => {
    const items = resultsList.querySelectorAll("a");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightItem(Math.min(highlighted + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightItem(Math.max(highlighted - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && items[highlighted]) {
        items[highlighted].click();
      }
    } else if (e.key === "Escape") {
      closeSearch();
    }
  });

  resultsList.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) closeSearch();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSearch();
  });

  // Global ⌘K / Ctrl+K
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      overlay.classList.contains("open") ? closeSearch() : openSearch();
    }
    if (e.key === "Escape" && overlay.classList.contains("open")) {
      closeSearch();
    }
  });
}

/* ── Mega Dropdown with keyboard navigation ── */
function initMegaDropdown() {
  const dropdown = document.querySelector(".nav-dropdown");
  const dropdownTrigger = document.querySelector(".nav-dropdown-trigger");
  if (!dropdown || !dropdownTrigger) return;

  function openDropdown() {
    dropdown.classList.add("open");
    dropdownTrigger.setAttribute("aria-expanded", "true");
  }
  function closeDropdown() {
    dropdown.classList.remove("open");
    dropdownTrigger.setAttribute("aria-expanded", "false");
  }

  dropdownTrigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.contains("open") ? closeDropdown() : openDropdown();
  });

  // Keyboard navigation inside mega-menu
  dropdownTrigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openDropdown();
      // Focus first item
      const firstItem = dropdown.querySelector(".nav-mega-item");
      if (firstItem) setTimeout(() => firstItem.focus(), 60);
    }
  });

  dropdown.addEventListener("keydown", (e) => {
    const items = [...dropdown.querySelectorAll(".nav-mega-item")];
    const idx = items.indexOf(document.activeElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = idx < items.length - 1 ? idx + 1 : 0;
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = idx > 0 ? idx - 1 : items.length - 1;
      items[prev]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      closeDropdown();
      dropdownTrigger.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  });

  dropdown.querySelectorAll(".nav-mega-menu a").forEach((a) => {
    a.addEventListener("click", () => {
      closeDropdown();
      const links = document.getElementById("navLinks");
      const toggle = document.getElementById("navToggle");
      if (links) links.classList.remove("open");
      if (toggle) toggle.classList.remove("open");
    });
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) closeDropdown();
  });
}

/* ── Notification Panel with dynamic updates ── */
function initNotifications() {
  const bell = document.getElementById("navBell");
  const notifPanel = document.getElementById("navNotifPanel");
  const bellDot = document.getElementById("navBellDot");
  const notifClear = document.getElementById("navNotifClear");
  const notifDismissAll = document.getElementById("navNotifDismissAll");
  if (!bell || !notifPanel) return;

  function openPanel() {
    notifPanel.classList.add("open");
    bell.setAttribute("aria-expanded", "true");
    if (bellDot) bellDot.style.display = "none";
  }
  function closePanel() {
    notifPanel.classList.remove("open");
    bell.setAttribute("aria-expanded", "false");
  }

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    notifPanel.classList.contains("open") ? closePanel() : openPanel();
  });

  // Keyboard support
  bell.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      bell.click();
    } else if (e.key === "Escape") {
      closePanel();
    }
  });

  notifPanel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePanel();
      bell.focus();
    }
  });

  document.addEventListener("click", (e) => {
    if (
      !notifPanel.contains(e.target) &&
      e.target !== bell &&
      !bell.contains(e.target)
    ) {
      closePanel();
    }
  });

  function clearNotifications() {
    const list = document.getElementById("navNotifList");
    if (list) {
      list.innerHTML =
        '<li class="nav-notif-item nav-notif-empty"><div class="nav-notif-body" style="text-align:center;width:100%;padding:20px 0;"><span class="nav-notif-text" style="opacity:0.3">No new notifications</span></div></li>';
    }
    if (bellDot) bellDot.style.display = "none";
  }

  if (notifClear) notifClear.addEventListener("click", clearNotifications);
  if (notifDismissAll)
    notifDismissAll.addEventListener("click", () => {
      clearNotifications();
      closePanel();
    });

  // ── Dynamic notification API ──
  window.addNavNotification = function (text, icon, type) {
    const list = document.getElementById("navNotifList");
    if (!list) return;
    // Remove empty state
    const empty = list.querySelector(".nav-notif-empty");
    if (empty) empty.remove();
    // Build item
    const li = document.createElement("li");
    li.className = "nav-notif-item unread nav-notif-animate-in";
    li.innerHTML = `
      <div class="nav-notif-icon"><i class="fas fa-${icon || "info-circle"}"></i></div>
      <div class="nav-notif-body">
        <span class="nav-notif-text">${text}</span>
        <span class="nav-notif-time">Just now</span>
      </div>`;
    list.prepend(li);
    // Show bell dot
    if (bellDot) bellDot.style.display = "";
    // Animate in
    requestAnimationFrame(() => li.classList.remove("nav-notif-animate-in"));
  };
}

/* ── User Profile Dropdown with keyboard nav ── */
function initUserDropdown() {
  const userTrigger = document.getElementById("navUserTrigger");
  const userDropdown = document.getElementById("navUserDropdown");
  if (!userTrigger || !userDropdown) return;

  function openDropdown() {
    userDropdown.classList.add("open");
    userTrigger.setAttribute("aria-expanded", "true");
  }
  function closeDropdown() {
    userDropdown.classList.remove("open");
    userTrigger.setAttribute("aria-expanded", "false");
  }

  userTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdown.classList.contains("open") ? closeDropdown() : openDropdown();
  });

  // Keyboard navigation
  userTrigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openDropdown();
      const firstLink = userDropdown.querySelector(".nav-user-links a");
      if (firstLink) setTimeout(() => firstLink.focus(), 60);
    }
  });

  userDropdown.addEventListener("keydown", (e) => {
    const items = [
      ...userDropdown.querySelectorAll(".nav-user-links a, .nav-logout-btn"),
    ];
    const idx = items.indexOf(document.activeElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = idx < items.length - 1 ? idx + 1 : 0;
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = idx > 0 ? idx - 1 : items.length - 1;
      items[prev]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      closeDropdown();
      userTrigger.focus();
    }
  });

  document.addEventListener("click", (e) => {
    if (
      !userDropdown.contains(e.target) &&
      e.target !== userTrigger &&
      !userTrigger.contains(e.target)
    ) {
      closeDropdown();
    }
  });

  userDropdown.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => closeDropdown());
  });
}

/* ── Nav Search orchestrator (calls separate init functions) ── */
function initNavSearch() {
  initCommandPalette();
  initMegaDropdown();
  initNotifications();
  initUserDropdown();
  initNavIndicator();
  // Breadcrumb now handled inside onScroll() — no separate listener needed
}

// Sliding indicator that moves between nav links
function initNavIndicator() {
  const indicator = document.getElementById("navIndicator");
  const navLinks = document.querySelector(".nav-links");
  if (!indicator || !navLinks) return;

  function moveIndicator(el) {
    if (!el || window.innerWidth <= 640) {
      indicator.classList.remove("visible");
      return;
    }
    const navRect = navLinks.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    indicator.style.left = elRect.left - navRect.left + "px";
    indicator.style.width = elRect.width + "px";
    indicator.classList.add("visible");
  }

  function updateIndicator() {
    const active = navLinks.querySelector("a.active[data-nav-link]");
    moveIndicator(active);
  }

  // Watch for active class changes
  const observer = new MutationObserver(updateIndicator);
  navLinks.querySelectorAll("a[data-nav-link]").forEach((a) => {
    observer.observe(a, { attributes: true, attributeFilter: ["class"] });
  });

  // Hover: temporarily move indicator
  navLinks.querySelectorAll("[data-nav-link]").forEach((el) => {
    el.addEventListener("mouseenter", () => moveIndicator(el));
    el.addEventListener("mouseleave", updateIndicator);
  });

  setTimeout(updateIndicator, 200);
  window.addEventListener("resize", updateIndicator);
}

// ═══════════════════════════════════════════════════════════
// USER AVATAR – show first letter of name
// ═══════════════════════════════════════════════════════════
function initUserAvatar() {
  // Will be called after login sets userName text
  const observer = new MutationObserver(() => {
    const nameEl = document.getElementById("userName");
    const avatarEl = document.getElementById("userAvatar");
    if (nameEl && avatarEl) {
      const name = nameEl.textContent.trim();
      if (name) {
        avatarEl.textContent = name.charAt(0).toUpperCase();
      }
    }
  });
  const nameEl = document.getElementById("userName");
  if (nameEl)
    observer.observe(nameEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
}

// ═══════════════════════════════════════════════════════════
// DARK MODE TOGGLE
// ═══════════════════════════════════════════════════════════
function initDarkModeToggle() {
  const btn = document.getElementById("themeToggle");
  const icon = document.getElementById("themeIcon");
  if (!btn) return;

  // Restore saved preference
  const saved = localStorage.getItem("tt-theme");
  if (saved === "light") {
    document.body.classList.add("light-mode");
    if (icon) {
      icon.classList.remove("fa-moon");
      icon.classList.add("fa-sun");
    }
  }

  btn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    localStorage.setItem("tt-theme", isLight ? "light" : "dark");
    if (icon) {
      icon.classList.toggle("fa-moon", !isLight);
      icon.classList.toggle("fa-sun", isLight);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// BUTTON RIPPLE EFFECT
// ═══════════════════════════════════════════════════════════
function initButtonRipple() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn) return;

    // Remove old ripples
    btn.querySelectorAll(".ripple").forEach((r) => r.remove());

    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = e.clientX - rect.left - size / 2 + "px";
    ripple.style.top = e.clientY - rect.top - size / 2 + "px";
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });
}

// ═══════════════════════════════════════════════════════════
// TOOLTIP SYSTEM – for [data-tooltip] elements
// ═══════════════════════════════════════════════════════════
function initTooltips() {
  const tooltip = document.getElementById("globalTooltip");
  if (!tooltip) return;

  let currentTarget = null;

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tooltip]");
    if (!el || el === currentTarget) return;
    currentTarget = el;

    tooltip.textContent = el.getAttribute("data-tooltip");
    tooltip.classList.add("visible");

    const rect = el.getBoundingClientRect();
    tooltip.style.left =
      rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + "px";
    tooltip.style.top = rect.bottom + 8 + "px";
  });

  document.addEventListener("mouseout", (e) => {
    const el = e.target.closest("[data-tooltip]");
    if (el === currentTarget) {
      currentTarget = null;
      tooltip.classList.remove("visible");
    }
  });
}

// ═══════════════════════════════════════════════════════════
// CHATBOT — Premium AI Assistant (Gemini AI + Classic ML auto-fallback)
// ═══════════════════════════════════════════════════════════
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
let sessionId = null;
let chatMode = "ai"; // auto-detected; "ai" or "classic"
let chatMsgCount = 0;
let chatSending = false; // send-lock to prevent spam
let chatDestContext = null; // current destination context for AI

// ── Destination context management ──
function setChatContext(destinationName) {
  chatDestContext = destinationName || null;
  const badge = document.getElementById("chatContextBadge");
  const label = document.getElementById("chatContextLabel");
  if (badge && label) {
    if (chatDestContext) {
      label.textContent = chatDestContext;
      badge.style.display = "inline-flex";
    } else {
      badge.style.display = "none";
    }
  }
}

// Wire up context clear button
const chatContextClearBtn = document.getElementById("chatContextClear");
if (chatContextClearBtn) {
  chatContextClearBtn.addEventListener("click", () => {
    setChatContext(null);
    showToast("Destination context cleared", "info");
  });
}

// ── Update message counter in header ──
function updateChatMsgCounter() {
  const counter = document.getElementById("chatMsgCounter");
  if (counter) {
    // Only count user messages
    const userMsgs = chatMessages
      ? chatMessages.querySelectorAll(".user-message").length
      : 0;
    counter.textContent = `${userMsgs} msg${userMsgs !== 1 ? "s" : ""}`;
  }
}

// ── Render welcome message on load ──
function renderChatWelcome() {
  if (!chatMessages) return;
  chatMessages.innerHTML = `
    <div class="message bot-message chat-welcome-msg">
      <div class="message-avatar"><i class="fas fa-robot"></i></div>
      <div class="message-content">
        <div class="md-body">
          <p>Hello! I'm your <strong>AI Travel Assistant</strong> 🌍</p>
          <p>Powered by Google Gemini, I can help you with:</p>
          <div class="chat-feature-pills">
            <span class="chat-feat"><i class="fas fa-route"></i> Trip planning</span>
            <span class="chat-feat"><i class="fas fa-wallet"></i> Budget estimates</span>
            <span class="chat-feat"><i class="fas fa-shield-alt"></i> Safety info</span>
            <span class="chat-feat"><i class="fas fa-cloud-sun"></i> Weather tips</span>
            <span class="chat-feat"><i class="fas fa-suitcase"></i> Packing lists</span>
            <span class="chat-feat"><i class="fas fa-utensils"></i> Food & culture</span>
          </div>
          <p style="margin-top:10px;font-size:0.78rem;color:rgba(255,255,255,0.4);">
            <i class="fas fa-lightbulb" style="color:#fbbf24;margin-right:4px;"></i>
            Try the quick prompts below, or ask anything about Indian travel!
          </p>
        </div>
        <span class="model-badge ai-badge"><i class="fas fa-brain"></i> Gemini AI</span>
        <span class="msg-time">${formatMsgTime()}</span>
      </div>
    </div>
  `;
}
renderChatWelcome();

// ── Time formatting ──
function formatMsgTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Markdown rendering ──
(function initMarked() {
  if (typeof marked !== "undefined") {
    marked.setOptions({ gfm: true, breaks: true });
  }
})();

function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    const raw = marked.parse(text);
    return typeof DOMPurify !== "undefined" ? DOMPurify.sanitize(raw) : raw;
  }
  return text.replace(/</g, "&lt;").replace(/\n/g, "<br>");
}

// ── Detect destination names in AI response for action buttons ──
function detectDestinationActions(text) {
  if (typeof DEST_META === "undefined") return [];
  const found = [];
  const names = Object.keys(DEST_META);
  for (const name of names) {
    if (text.toLowerCase().includes(name.toLowerCase()) && found.length < 4) {
      found.push(name);
    }
  }
  return found;
}

// ── Append message ──
function appendMessage(role, text, intent, confidence, mode, model) {
  const msg = document.createElement("div");
  msg.className = `message ${role}-message`;

  const avatar =
    role === "bot"
      ? '<div class="message-avatar"><i class="fas fa-robot"></i></div>'
      : '<div class="message-avatar"><i class="fas fa-user"></i></div>';

  let badge = "";
  if (role === "bot") {
    if (mode === "ai" || (model && model.includes("gemini"))) {
      badge =
        '<span class="model-badge ai-badge"><i class="fas fa-brain"></i> Gemini AI</span>';
    } else if (mode === "classic" && intent && intent !== "fallback") {
      badge = `<span class="model-badge classic-badge"><i class="fas fa-cog"></i> ${intent} · ${Math.round(confidence * 100)}%</span>`;
    }
  }

  const isAI = mode === "ai" || (model && model.includes("gemini"));
  const formatted = isAI ? renderMarkdown(text) : text.replace(/\n/g, "<br>");
  const body = isAI
    ? `<div class="md-body">${formatted}</div>`
    : `<p>${formatted}</p>`;
  const time = `<span class="msg-time">${formatMsgTime()}</span>`;

  // Copy button for bot messages — targets .md-body or p for clean copy
  const copyBtn =
    role === "bot"
      ? `<button class="msg-copy-btn" title="Copy" data-action="copy-msg"><i class="far fa-copy"></i></button>`
      : "";

  // Detect destination action buttons for bot AI responses
  let actionRow = "";
  if (role === "bot" && isAI) {
    const dests = detectDestinationActions(text);
    if (dests.length > 0) {
      const btns = dests
        .map(
          (d) =>
            `<button class="chat-inline-action" data-action="open-smart-hub-dest" data-dest="${d}"><i class="fas fa-compass"></i> Explore ${d}</button>`,
        )
        .join("");
      actionRow = `<div class="chat-action-row">${btns}</div>`;
    }
  }

  msg.innerHTML = `
    ${avatar}
    <div class="message-content">
      ${body}
      ${actionRow}
      <div class="msg-meta">${badge}${time}${copyBtn}</div>
    </div>
  `;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatMsgCount++;

  // Hide quick actions after first user message
  if (role === "user") {
    const qa = document.getElementById("chatQuickActions");
    if (qa) qa.classList.add("hidden");
  }

  updateChatMsgCounter();

  // Persist to sessionStorage
  saveChatHistory();
}

// ── Copy message text — only the actual content, not badges/time ──
function copyMsgText(btn) {
  const content = btn.closest(".message-content");
  // Target only the markdown body or paragraph, not meta
  const bodyEl = content
    ? content.querySelector(".md-body") || content.querySelector("p")
    : null;
  const text = bodyEl ? bodyEl.innerText : content ? content.innerText : "";
  navigator.clipboard.writeText(text.trim()).then(() => {
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
      btn.innerHTML = '<i class="far fa-copy"></i>';
    }, 1500);
  });
}

// ── Send lock (disable/enable input during send) ──
function setChatSending(sending) {
  chatSending = sending;
  if (chatInput) chatInput.disabled = sending;
  if (chatSend) {
    chatSend.disabled = sending;
    chatSend.classList.toggle("sending", sending);
  }
}

// ── Send message ──
async function sendChat() {
  if (chatSending) return; // prevent duplicate sends
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  chatInput.value = "";
  autoResizeInput();
  updateCharCount();

  setChatSending(true);

  // Show typing indicator
  const typing = document.createElement("div");
  typing.className = "message bot-message typing-message";
  typing.innerHTML = `
    <div class="message-avatar"><i class="fas fa-robot"></i></div>
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <span class="typing-label">Thinking…</span>
    </div>
  `;
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const body = { message: text, mode: chatMode };
    if (sessionId) body.session_id = sessionId;
    if (chatDestContext) body.destination = chatDestContext;

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify(body),
    });
    typing.remove();

    if (res.ok) {
      const data = await res.json();
      sessionId = data.session_id;
      appendMessage(
        "bot",
        data.reply,
        data.intent,
        data.confidence,
        data.mode,
        data.model,
      );
    } else if (res.status === 429) {
      // Rate limit — show specific feedback
      const warning = document.createElement("div");
      warning.className = "chat-rate-warning";
      warning.innerHTML =
        '<i class="fas fa-clock"></i> Rate limit reached — please wait a moment before sending another message.';
      chatMessages.appendChild(warning);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      setTimeout(() => warning.remove(), 8000);
    } else {
      const data = await res.json().catch(() => ({}));
      appendMessage(
        "bot",
        data.error || "Something went wrong. Please try again.",
        null,
        null,
        "classic",
      );
    }
  } catch (err) {
    typing.remove();
    appendMessage(
      "bot",
      "Network error — please check your connection and try again.",
      null,
      null,
      "classic",
    );
  } finally {
    setChatSending(false);
    if (chatInput) chatInput.focus();
  }
}

// ── Chat history persistence (sessionStorage) ──
function saveChatHistory() {
  if (!chatMessages) return;
  try {
    const msgs = [];
    chatMessages.querySelectorAll(".message").forEach((m) => {
      if (m.classList.contains("typing-message")) return;
      if (m.classList.contains("chat-welcome-msg")) return;
      const role = m.classList.contains("user-message") ? "user" : "bot";
      const bodyEl =
        m.querySelector(".md-body") || m.querySelector("p") || null;
      const text = bodyEl ? bodyEl.innerHTML : "";
      const badge = m.querySelector(".model-badge");
      const isAI = badge ? badge.classList.contains("ai-badge") : false;
      const timeEl = m.querySelector(".msg-time");
      const time = timeEl ? timeEl.textContent : "";
      msgs.push({ role, html: text, isAI, time });
    });
    const data = {
      msgs,
      sessionId,
      chatMode,
      chatDestContext,
      ts: Date.now(),
    };
    sessionStorage.setItem("tt_chat_history", JSON.stringify(data));
  } catch (e) {
    /* storage full — silently ignore */
  }
}

function restoreChatHistory() {
  try {
    const raw = sessionStorage.getItem("tt_chat_history");
    if (!raw) return false;
    const data = JSON.parse(raw);
    // Only restore if less than 30 min old
    if (Date.now() - data.ts > 30 * 60 * 1000) {
      sessionStorage.removeItem("tt_chat_history");
      return false;
    }
    if (!data.msgs || data.msgs.length === 0) return false;

    sessionId = data.sessionId || null;
    if (data.chatDestContext) setChatContext(data.chatDestContext);

    // Clear welcome and restore messages
    chatMessages.innerHTML = "";
    renderChatWelcome();

    data.msgs.forEach((m) => {
      const msg = document.createElement("div");
      msg.className = `message ${m.role}-message`;
      const avatarIcon = m.role === "bot" ? "fa-robot" : "fa-user";
      const avatarClass = m.role === "bot" ? "" : "";
      let badge = "";
      if (m.role === "bot" && m.isAI) {
        badge =
          '<span class="model-badge ai-badge"><i class="fas fa-brain"></i> Gemini AI</span>';
      }
      const copyBtn =
        m.role === "bot"
          ? `<button class="msg-copy-btn" title="Copy" data-action="copy-msg"><i class="far fa-copy"></i></button>`
          : "";

      msg.innerHTML = `
        <div class="message-avatar"><i class="fas ${avatarIcon}"></i></div>
        <div class="message-content">
          ${m.isAI ? `<div class="md-body">${m.html}</div>` : `<p>${m.html}</p>`}
          <div class="msg-meta">${badge}<span class="msg-time">${m.time}</span>${copyBtn}</div>
        </div>
      `;
      msg.style.animation = "none"; // no animation on restore
      chatMessages.appendChild(msg);
      chatMsgCount++;
    });

    // Hide quick actions if we have restored messages
    const qa = document.getElementById("chatQuickActions");
    if (qa && data.msgs.length > 0) qa.classList.add("hidden");

    chatMessages.scrollTop = chatMessages.scrollHeight;
    updateChatMsgCounter();
    return true;
  } catch (e) {
    return false;
  }
}

// Try to restore on load — if no history, welcome is already rendered
restoreChatHistory();

// ── Input handling: auto-resize textarea + char count ──
function autoResizeInput() {
  if (!chatInput) return;
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
}

function updateCharCount() {
  const counter = document.getElementById("chatCharCount");
  if (counter && chatInput) {
    const len = chatInput.value.length;
    counter.textContent = `${len} / 500`;
    counter.classList.toggle("near-limit", len > 400);
  }
}

if (chatInput) {
  chatInput.addEventListener("input", () => {
    autoResizeInput();
    updateCharCount();
  });
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
}
if (chatSend) chatSend.addEventListener("click", sendChat);

// ── Quick action chips ──
document.querySelectorAll(".chat-quick-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chatSending) return;
    chatInput.value = chip.dataset.msg;
    autoResizeInput();
    sendChat();
  });
});

// ── Clear chat ──
const chatClearBtn = document.getElementById("chatClearBtn");
if (chatClearBtn) {
  chatClearBtn.addEventListener("click", () => {
    sessionId = null;
    chatMsgCount = 0;
    chatDestContext = null;
    setChatContext(null);
    renderChatWelcome();
    const qa = document.getElementById("chatQuickActions");
    if (qa) qa.classList.remove("hidden");
    sessionStorage.removeItem("tt_chat_history");
    updateChatMsgCounter();
    showToast("Chat cleared", "info");
  });
}

// ── Export chat (clean — skips welcome, excludes metadata) ──
const chatExportBtn = document.getElementById("chatExportBtn");
if (chatExportBtn) {
  chatExportBtn.addEventListener("click", () => {
    const msgs = chatMessages.querySelectorAll(
      ".message:not(.chat-welcome-msg):not(.typing-message)",
    );
    if (msgs.length === 0) {
      showToast("Nothing to export yet", "warning");
      return;
    }
    let txt = "=== Time Travel AI — Chat Export ===\n";
    txt += `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
    if (chatDestContext) txt += `Context: ${chatDestContext}\n`;
    txt += "\n";
    msgs.forEach((m) => {
      const role = m.classList.contains("user-message") ? "You" : "AI";
      const bodyEl =
        m.querySelector(".md-body") || m.querySelector("p") || null;
      const content = bodyEl ? bodyEl.innerText : "";
      const time = m.querySelector(".msg-time")?.textContent || "";
      txt += `[${role}] (${time}) ${content.trim()}\n\n`;
    });
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `travel-chat-${Date.now()}.txt`;
    a.click();
    showToast("Chat exported!", "success");
  });
}

// ── Scroll-to-bottom button ──
const chatScrollBtn = document.getElementById("chatScrollBottomBtn");
if (chatMessages && chatScrollBtn) {
  chatMessages.addEventListener("scroll", () => {
    const gap =
      chatMessages.scrollHeight -
      chatMessages.scrollTop -
      chatMessages.clientHeight;
    chatScrollBtn.style.display = gap > 150 ? "flex" : "none";
  });
  chatScrollBtn.addEventListener("click", () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// ── Check AI availability (with retry) ──
async function checkChatStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/chat/status`);
    const data = await res.json();
    const dot = document.getElementById("chatStatusDot");
    const statusLabel = document.getElementById("chatHeaderStatus");
    if (data.engines && data.engines.ai && data.engines.ai.available) {
      chatMode = "ai";
      if (dot) dot.classList.add("online");
      if (statusLabel) statusLabel.textContent = "Gemini AI · Online";
    } else {
      chatMode = "classic";
      if (dot) dot.classList.add("offline");
      if (statusLabel) statusLabel.textContent = "Classic ML · Fallback";
    }
  } catch {
    chatMode = "classic";
    const dot = document.getElementById("chatStatusDot");
    const statusLabel = document.getElementById("chatHeaderStatus");
    if (dot) dot.classList.add("offline");
    if (statusLabel) statusLabel.textContent = "Offline — retrying…";
    // Retry after 10s
    setTimeout(checkChatStatus, 10000);
  }
}

// ═══════════════════════════════════════════════════════════
// DESTINATION COMPARISON — PREMIUM
// ═══════════════════════════════════════════════════════════
(function initCompare() {
  const cmpDest1 = document.getElementById("cmpDest1");
  const cmpDest2 = document.getElementById("cmpDest2");
  const cmpMeta1 = document.getElementById("cmpMeta1");
  const cmpMeta2 = document.getElementById("cmpMeta2");
  const cmpPickCard1 = document.getElementById("cmpPickCard1");
  const cmpPickCard2 = document.getElementById("cmpPickCard2");
  const cmpResult = document.getElementById("cmpResult");

  // ── Destination preview meta on select ──
  function renderPickMeta(val, metaEl, cardEl) {
    const key = val.toLowerCase().replace(/[\s-]+/g, "_");
    const m = typeof DEST_META !== "undefined" && DEST_META[key];
    if (m) {
      metaEl.innerHTML = `<span class="cmp-meta-region"><i class="fas fa-map-pin"></i> ${m.region}</span>
        <span class="cmp-meta-season"><i class="fas fa-sun"></i> ${m.season}</span>
        <span class="cmp-meta-hl"><i class="fas fa-star"></i> ${m.highlight}</span>`;
      cardEl.classList.add("selected");
    } else {
      metaEl.innerHTML = "";
      cardEl.classList.remove("selected");
    }
  }
  cmpDest1.addEventListener("change", () =>
    renderPickMeta(cmpDest1.value, cmpMeta1, cmpPickCard1),
  );
  cmpDest2.addEventListener("change", () =>
    renderPickMeta(cmpDest2.value, cmpMeta2, cmpPickCard2),
  );

  // ── Popular matchup chips ──
  document.querySelectorAll(".cmp-popular-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const d1 = chip.dataset.d1;
      const d2 = chip.dataset.d2;
      if (cmpDest1) {
        cmpDest1.value = d1;
        renderPickMeta(d1, cmpMeta1, cmpPickCard1);
      }
      if (cmpDest2) {
        cmpDest2.value = d2;
        renderPickMeta(d2, cmpMeta2, cmpPickCard2);
      }
      document
        .querySelectorAll(".cmp-popular-chip")
        .forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });

  // ── Compare submit ──
  document.getElementById("cmpSubmit").addEventListener("click", async () => {
    const d1 = cmpDest1.value;
    const d2 = cmpDest2.value;
    const days = parseInt(document.getElementById("cmpDays").value) || 5;
    const family = parseInt(document.getElementById("cmpFamily").value) || 4;
    const cls = document.getElementById("cmpClass").value;

    if (!d1 || !d2)
      return showToast("Please select both destinations.", "warning");
    if (d1 === d2)
      return showToast("Choose two different destinations.", "warning");

    showLoader();
    try {
      const url = `${API_BASE}/api/compare?dest1=${encodeURIComponent(d1)}&dest2=${encodeURIComponent(d2)}&days=${days}&family=${family}&class=${cls}`;
      const res = await fetch(url);
      const data = await res.json();
      hideLoader();
      if (!res.ok) {
        showToast(data.error || "Comparison failed.", "error");
        cmpResult.innerHTML = "";
        return;
      }
      cmpResult.innerHTML = renderComparison(data);
      cmpResult._exportData = data;

      // Animate score bars
      setTimeout(() => {
        cmpResult.querySelectorAll(".cmp-score-fill").forEach((bar) => {
          bar.style.width = bar.dataset.w;
        });
      }, 100);

      // PDF export
      const exportBtn = document.getElementById("exportCmpPdf");
      if (exportBtn) {
        exportBtn.addEventListener("click", () => {
          const ed = cmpResult._exportData;
          if (!ed) return showToast("No comparison data to export.", "warning");
          downloadPDF(
            "/api/export/comparison",
            ed,
            `${ed.dest1?.destination || "A"}_vs_${ed.dest2?.destination || "B"}_Comparison.pdf`,
          );
        });
      }

      // Share button
      const shareBtn = document.getElementById("cmpShareBtn");
      if (shareBtn) {
        shareBtn.addEventListener("click", () => {
          const text = `Compare: ${d1} vs ${d2} (${days} days, ${family} people, ${cls}) on Time Travel!`;
          if (navigator.share) {
            navigator.share({
              title: "Time Travel Comparison",
              text,
              url: window.location.href,
            });
          } else {
            navigator.clipboard
              .writeText(text)
              .then(() => showToast("Comparison link copied!", "success"));
          }
        });
      }

      cmpResult.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast(`${d1} vs ${d2} — comparison ready!`, "success");
    } catch (err) {
      hideLoader();
      showToast("Network error – is the server running?", "error");
    }
  });
})();

// ── Compare renderer ──────────────────────────────────────
function renderComparison(data) {
  const p1 = data.dest1;
  const p2 = data.dest2;
  const params = data.params;

  function destKey(name) {
    return name.toLowerCase().replace(/[\s-]+/g, "_");
  }
  function getMeta(name) {
    return (typeof DEST_META !== "undefined" && DEST_META[destKey(name)]) || {};
  }

  function scoreColor(val) {
    if (val >= 7) return "#10b981";
    if (val >= 5) return "#f59e0b";
    return "#ef4444";
  }

  function scoreLabel(val) {
    if (val >= 8) return "Excellent";
    if (val >= 6) return "Good";
    if (val >= 4) return "Fair";
    return "Poor";
  }

  // ── Verdict logic ──
  const b1 = p1.budget.total,
    b2 = p2.budget.total;
  const s1 = p1.safety.overall_score,
    s2 = p2.safety.overall_score;
  let budgetWinner =
    b1 < b2 ? p1.destination : b2 < b1 ? p2.destination : "Tie";
  let safetyWinner =
    s1 > s2 ? p1.destination : s2 > s1 ? p2.destination : "Tie";
  const savings = Math.abs(b1 - b2);
  const safetyDiff = Math.abs(s1 - s2).toFixed(1);

  // Overall verdict
  let overallScore1 = 0,
    overallScore2 = 0;
  if (b1 <= b2) overallScore1++;
  else overallScore2++;
  if (s1 >= s2) overallScore1++;
  else overallScore2++;
  if (p1.weather && p2.weather) {
    if (p1.weather.humidity <= p2.weather.humidity) overallScore1++;
    else overallScore2++;
  }
  let overallWinner =
    overallScore1 > overallScore2
      ? p1.destination
      : overallScore2 > overallScore1
        ? p2.destination
        : "Tie";

  function verdictBanner() {
    if (overallWinner === "Tie") {
      return `<div class="cmp-verdict tie"><i class="fas fa-handshake"></i>
        <div class="cmp-verdict-text"><strong>It's a Tie!</strong><span>Both destinations are evenly matched</span></div></div>`;
    }
    const loser =
      overallWinner === p1.destination ? p2.destination : p1.destination;
    return `<div class="cmp-verdict">
      <div class="cmp-verdict-trophy"><i class="fas fa-trophy"></i></div>
      <div class="cmp-verdict-text"><strong>${overallWinner}</strong> <span>edges out ${loser} overall</span></div>
      <div class="cmp-verdict-pills">
        ${budgetWinner !== "Tie" ? `<span class="cmp-vpill budget"><i class="fas fa-wallet"></i> ${budgetWinner} saves ${formatINR(savings)}</span>` : ""}
        ${safetyWinner !== "Tie" ? `<span class="cmp-vpill safety"><i class="fas fa-shield-alt"></i> ${safetyWinner} +${safetyDiff} safer</span>` : ""}
      </div>
    </div>`;
  }

  // ── Quick Stats Row ──
  function quickStats() {
    const items = [
      {
        icon: "fa-wallet",
        label: "Budget Gap",
        value: savings > 0 ? formatINR(savings) : "Even",
        sub: savings > 0 ? `${budgetWinner} is cheaper` : "",
      },
      {
        icon: "fa-shield-alt",
        label: "Safety Gap",
        value: safetyDiff > 0 ? `${safetyDiff} pts` : "Even",
        sub: safetyDiff > 0 ? `${safetyWinner} is safer` : "",
      },
    ];
    if (p1.weather && p2.weather) {
      const tDiff = Math.abs(
        p1.weather.temperature_c - p2.weather.temperature_c,
      ).toFixed(1);
      const warmer =
        p1.weather.temperature_c >= p2.weather.temperature_c
          ? p1.destination
          : p2.destination;
      items.push({
        icon: "fa-thermometer-half",
        label: "Temp Diff",
        value: `${tDiff}°C`,
        sub: `${warmer} is warmer`,
      });
    }
    return `<div class="cmp-quick-stats">${items
      .map(
        (i) => `
      <div class="cmp-qs-item">
        <div class="cmp-qs-icon"><i class="fas ${i.icon}"></i></div>
        <div class="cmp-qs-label">${i.label}</div>
        <div class="cmp-qs-value">${i.value}</div>
        ${i.sub ? `<div class="cmp-qs-sub">${i.sub}</div>` : ""}
      </div>`,
      )
      .join("")}</div>`;
  }

  // ── Budget section (side-by-side) ──
  function budgetSection() {
    const cats = [
      "accommodation",
      "food",
      "transport",
      "activities",
      "miscellaneous",
    ];
    const icons = {
      accommodation: "fa-bed",
      food: "fa-utensils",
      transport: "fa-bus",
      activities: "fa-hiking",
      miscellaneous: "fa-ellipsis-h",
    };
    const maxTotal = Math.max(b1, b2);

    function budgetRows(p, other) {
      return cats
        .map((key) => {
          const val = p.budget[key];
          const otherVal = other.budget[key];
          const isLower = val < otherVal;
          return `<div class="cmp-brow">
          <span class="cmp-brow-icon"><i class="fas ${icons[key]}"></i></span>
          <span class="cmp-brow-label">${key.charAt(0).toUpperCase() + key.slice(1)}</span>
          <span class="cmp-brow-val ${isLower ? "cheaper" : ""}">${formatINR(val)} ${isLower ? '<i class="fas fa-arrow-down cmp-win-arrow"></i>' : ""}</span>
        </div>`;
        })
        .join("");
    }

    const pct1 = ((b1 / maxTotal) * 100).toFixed(0);
    const pct2 = ((b2 / maxTotal) * 100).toFixed(0);

    return `<div class="cmp-section-block">
      <div class="cmp-section-title"><i class="fas fa-wallet"></i> Budget Breakdown <span class="cmp-stag">${params.num_days} days · ${params.family_size} people · ${params.travel_class}</span></div>
      <div class="cmp-dual-col">
        <div class="cmp-col">
          <div class="cmp-col-head">${p1.destination}</div>
          ${budgetRows(p1, p2)}
          <div class="cmp-btotal">
            <span class="cmp-btotal-bar"><span class="cmp-btotal-fill ${b1 <= b2 ? "winner" : ""}" style="width:${pct1}%"></span></span>
            <span class="cmp-btotal-val ${b1 <= b2 ? "winner" : ""}">${formatINR(b1)}</span>
          </div>
        </div>
        <div class="cmp-col">
          <div class="cmp-col-head">${p2.destination}</div>
          ${budgetRows(p2, p1)}
          <div class="cmp-btotal">
            <span class="cmp-btotal-bar"><span class="cmp-btotal-fill ${b2 <= b1 ? "winner" : ""}" style="width:${pct2}%"></span></span>
            <span class="cmp-btotal-val ${b2 <= b1 ? "winner" : ""}">${formatINR(b2)}</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Safety section (side-by-side) ──
  function safetySection() {
    const cats = [
      { key: "crime_score", label: "Crime Safety", icon: "fa-gavel" },
      { key: "health_score", label: "Health", icon: "fa-heartbeat" },
      { key: "infrastructure_score", label: "Infrastructure", icon: "fa-road" },
      {
        key: "tourist_friendliness",
        label: "Tourist Friendly",
        icon: "fa-smile",
      },
    ];

    function safetyCol(p) {
      const s = p.safety;
      return `<div class="cmp-col">
        <div class="cmp-col-head">${p.destination} <span class="cmp-overall-badge" style="background:${scoreColor(s.overall_score)}">${s.overall_score}/10 · ${scoreLabel(s.overall_score)}</span></div>
        ${cats
          .map((c) => {
            const val = s[c.key];
            return `<div class="cmp-safety-row">
            <div class="cmp-sr-top"><span class="cmp-sr-icon"><i class="fas ${c.icon}"></i></span><span class="cmp-sr-label">${c.label}</span><span class="cmp-sr-num" style="color:${scoreColor(val)}">${val}/10</span></div>
            <div class="cmp-score-track"><div class="cmp-score-fill" data-w="${val * 10}%" style="width:0%;background:${scoreColor(val)}"></div></div>
          </div>`;
          })
          .join("")}
        <div class="cmp-advisory"><i class="fas fa-info-circle"></i> ${s.advisory}</div>
      </div>`;
    }

    return `<div class="cmp-section-block">
      <div class="cmp-section-title"><i class="fas fa-shield-alt"></i> Safety Analysis</div>
      <div class="cmp-dual-col">${safetyCol(p1)}${safetyCol(p2)}</div>
    </div>`;
  }

  // ── Weather section ──
  function weatherSection() {
    function weatherCol(p) {
      const w = p.weather;
      if (!w)
        return `<div class="cmp-col"><div class="cmp-col-head">${p.destination}</div><div class="cmp-weather-na"><i class="fas fa-cloud"></i> Weather data unavailable</div></div>`;
      const wIcon = w.description.toLowerCase().includes("rain")
        ? "fa-cloud-showers-heavy"
        : w.description.toLowerCase().includes("cloud")
          ? "fa-cloud"
          : w.description.toLowerCase().includes("clear") ||
              w.description.toLowerCase().includes("sun")
            ? "fa-sun"
            : "fa-cloud-sun";
      return `<div class="cmp-col">
        <div class="cmp-col-head">${p.destination}</div>
        <div class="cmp-weather-card">
          <div class="cmp-wc-icon"><i class="fas ${wIcon}"></i></div>
          <div class="cmp-wc-temp">${w.temperature_c}°C</div>
          <div class="cmp-wc-desc">${w.description}</div>
          <div class="cmp-wc-grid">
            <div class="cmp-wc-stat"><i class="fas fa-thermometer-half"></i><span>Feels like</span><strong>${w.feels_like_c}°C</strong></div>
            <div class="cmp-wc-stat"><i class="fas fa-tint"></i><span>Humidity</span><strong>${w.humidity}%</strong></div>
            <div class="cmp-wc-stat"><i class="fas fa-wind"></i><span>Wind</span><strong>${w.wind_speed_kmh} km/h</strong></div>
          </div>
          ${w.packing_suggestions && w.packing_suggestions.length ? `<div class="cmp-pack"><strong>Pack:</strong> ${w.packing_suggestions.slice(0, 4).join(", ")}</div>` : ""}
        </div>
      </div>`;
    }
    return `<div class="cmp-section-block">
      <div class="cmp-section-title"><i class="fas fa-cloud-sun"></i> Live Weather</div>
      <div class="cmp-dual-col">${weatherCol(p1)}${weatherCol(p2)}</div>
    </div>`;
  }

  // ── Destination info footer ──
  function destInfoFooter() {
    const m1 = getMeta(p1.destination);
    const m2 = getMeta(p2.destination);
    return `<div class="cmp-section-block">
      <div class="cmp-section-title"><i class="fas fa-info-circle"></i> Destination Quick Info</div>
      <div class="cmp-dual-col">
        <div class="cmp-col cmp-info-col">
          <div class="cmp-col-head">${p1.destination}</div>
          <div class="cmp-info-tags">
            ${m1.region ? `<span class="cmp-itag"><i class="fas fa-map-pin"></i> ${m1.region}</span>` : ""}
            ${m1.season ? `<span class="cmp-itag"><i class="fas fa-sun"></i> Best: ${m1.season}</span>` : ""}
            ${m1.highlight ? `<span class="cmp-itag"><i class="fas fa-star"></i> ${m1.highlight}</span>` : ""}
          </div>
        </div>
        <div class="cmp-col cmp-info-col">
          <div class="cmp-col-head">${p2.destination}</div>
          <div class="cmp-info-tags">
            ${m2.region ? `<span class="cmp-itag"><i class="fas fa-map-pin"></i> ${m2.region}</span>` : ""}
            ${m2.season ? `<span class="cmp-itag"><i class="fas fa-sun"></i> Best: ${m2.season}</span>` : ""}
            ${m2.highlight ? `<span class="cmp-itag"><i class="fas fa-star"></i> ${m2.highlight}</span>` : ""}
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Actions bar ──
  function actionsBar() {
    return `<div class="cmp-actions-bar">
      <button class="cmp-action-btn export" id="exportCmpPdf"><i class="fas fa-file-pdf"></i> Export PDF</button>
      <button class="cmp-action-btn share" id="cmpShareBtn"><i class="fas fa-share-alt"></i> Share</button>
    </div>`;
  }

  return `<div class="cmp-results-wrap">
    ${verdictBanner()}
    ${quickStats()}
    ${budgetSection()}
    ${safetySection()}
    ${weatherSection()}
    ${destInfoFooter()}
    ${actionsBar()}
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// BUDGET ESTIMATOR
// ═══════════════════════════════════════════════════════════
document.getElementById("budgetSubmit").addEventListener("click", async () => {
  const dest = document.getElementById("budgetDest").value;
  const days = parseInt(document.getElementById("budgetDays").value);
  const family = parseInt(document.getElementById("budgetFamily").value);
  const cls = document.getElementById("budgetClass").value;

  if (!dest) return showToast("Please select a destination.", "warning");
  if (!days || days < 1)
    return showToast("Please enter valid number of days.", "warning");
  if (!family || family < 1)
    return showToast("Please enter valid family size.", "warning");

  showLoader();
  try {
    const res = await fetch(`${API_BASE}/api/budget/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        destination: dest,
        num_days: days,
        family_size: family,
        travel_class: cls,
      }),
    });
    const data = await res.json();
    hideLoader();

    if (!res.ok) {
      document.getElementById("budgetResult").innerHTML = `
                <div class="result-placeholder"><i class="fas fa-exclamation-triangle"></i><p>${data.error}</p></div>`;
      return;
    }

    const icons = {
      accommodation: "fa-bed",
      food: "fa-utensils",
      transport: "fa-bus",
      activities: "fa-hiking",
      miscellaneous: "fa-ellipsis-h",
    };

    const items = [
      "accommodation",
      "food",
      "transport",
      "activities",
      "miscellaneous",
    ]
      .map(
        (key) => `
                <div class="budget-item">
                    <span class="budget-item-label">
                        <i class="fas ${icons[key]}"></i>
                        ${key.charAt(0).toUpperCase() + key.slice(1)}
                    </span>
                    <span class="budget-item-value">${formatINR(data[key])}</span>
                </div>
            `,
      )
      .join("");

    document.getElementById("budgetResult").innerHTML = `
            <div class="budget-breakdown">
                <div class="budget-header">
                    <h3><i class="fas fa-map-marker-alt" style="color:var(--primary);margin-right:8px;"></i>${data.destination}</h3>
                    <div class="budget-total">${formatINR(data.total)}</div>
                </div>
                <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px;">
                    ${data.num_days} days · ${data.family_size} people · ${data.travel_class} class
                </p>
                <div class="budget-items">${items}</div>
                <button class="btn-export" id="exportBudgetPdf">
                    <i class="fas fa-file-pdf"></i> Export as PDF
                </button>
            </div>
        `;
    // Wire up export button
    document.getElementById("exportBudgetPdf").addEventListener("click", () => {
      downloadPDF("/api/export/budget", data, `${data.destination}_Budget.pdf`);
    });
  } catch (err) {
    hideLoader();
    showToast("Network error – is the server running?", "error");
  }
});

// ═══════════════════════════════════════════════════════════
// SAFETY SCORE
// ═══════════════════════════════════════════════════════════
document.getElementById("safetySubmit").addEventListener("click", async () => {
  const dest = document.getElementById("safetyDest").value;
  if (!dest) return showToast("Please select a destination.", "warning");

  showLoader();
  try {
    const res = await fetch(
      `${API_BASE}/api/safety/${encodeURIComponent(dest)}`,
    );
    const data = await res.json();
    hideLoader();

    if (!res.ok) {
      document.getElementById("safetyResult").innerHTML = `
                <div class="result-placeholder light"><i class="fas fa-exclamation-triangle"></i><p>${data.error}</p></div>`;
      return;
    }

    const scoreClass =
      data.overall_score >= 7
        ? "score-high"
        : data.overall_score >= 4
          ? "score-medium"
          : "score-low";

    function barColor(val) {
      if (val >= 7) return "#10b981";
      if (val >= 4) return "#f59e0b";
      return "#ef4444";
    }

    const bars = [
      { label: "Crime Safety", key: "crime_score" },
      { label: "Health & Medical", key: "health_score" },
      { label: "Infrastructure", key: "infrastructure_score" },
      { label: "Tourist Friendliness", key: "tourist_friendliness" },
    ]
      .map(
        (b) => `
            <div class="safety-bar-item">
                <div class="safety-bar-label">
                    <span>${b.label}</span>
                    <span>${data[b.key]}/10</span>
                </div>
                <div class="safety-bar-track">
                    <div class="safety-bar-fill" style="width:${data[b.key] * 10}%;background:${barColor(data[b.key])};"></div>
                </div>
            </div>
        `,
      )
      .join("");

    document.getElementById("safetyResult").innerHTML = `
            <div class="safety-result">
                <div class="safety-header">
                    <div class="safety-score-circle ${scoreClass}">${data.overall_score}</div>
                    <h3 style="font-size:1.2rem;">${data.destination}</h3>
                </div>
                <div class="safety-advisory">${data.advisory}</div>
                <div class="safety-bars">${bars}</div>
            </div>
        `;
  } catch (err) {
    hideLoader();
    showToast("Network error – is the server running?", "error");
  }
});

// ═══════════════════════════════════════════════════════════
// WEATHER & PACKING
// ═══════════════════════════════════════════════════════════
document.getElementById("weatherSubmit").addEventListener("click", async () => {
  const dest = document.getElementById("weatherDest").value;
  if (!dest) return showToast("Please select a destination.", "warning");

  showLoader();
  try {
    const res = await fetch(
      `${API_BASE}/api/weather/${encodeURIComponent(dest)}`,
    );
    const data = await res.json();
    hideLoader();

    if (!res.ok) {
      document.getElementById("weatherResult").innerHTML = `
                <div class="result-placeholder"><i class="fas fa-exclamation-triangle"></i><p>${data.error}${data.hint ? "<br><small>" + data.hint + "</small>" : ""}</p></div>`;
      return;
    }

    const packingTags = (data.packing_suggestions || [])
      .map((s) => `<span class="packing-tag">${s}</span>`)
      .join("");

    document.getElementById("weatherResult").innerHTML = `
            <div class="weather-result">
                <div class="weather-header">
                    <div class="weather-temp">${Math.round(data.temperature_c)}<sup>°C</sup></div>
                    <div class="weather-meta">
                        <strong>${data.destination}</strong>
                        ${data.description}
                    </div>
                </div>
                <div class="weather-details">
                    <div class="weather-detail">
                        <i class="fas fa-temperature-low"></i>
                        <div class="detail-value">${data.feels_like_c}°C</div>
                        <div class="detail-label">Feels Like</div>
                    </div>
                    <div class="weather-detail">
                        <i class="fas fa-tint"></i>
                        <div class="detail-value">${data.humidity}%</div>
                        <div class="detail-label">Humidity</div>
                    </div>
                    <div class="weather-detail">
                        <i class="fas fa-wind"></i>
                        <div class="detail-value">${data.wind_speed_kmh} km/h</div>
                        <div class="detail-label">Wind Speed</div>
                    </div>
                </div>
                <h4 class="packing-title"><i class="fas fa-suitcase-rolling"></i> Packing Suggestions</h4>
                <div class="packing-list">${packingTags}</div>
            </div>
        `;
  } catch (err) {
    hideLoader();
    showToast("Network error – is the server running?", "error");
  }
});

// ═══════════════════════════════════════════════════════════
// AUTH STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════
let currentUser = null;

function updateAuthUI() {
  const authBtns = document.getElementById("authBtns");
  const userMenu = document.getElementById("userMenu");
  const nameEl = document.getElementById("userName");
  const histNav = document.getElementById("navHistory");
  const histSec = document.getElementById("history");
  const wlNav = document.getElementById("navWishlist");
  const wlSec = document.getElementById("wishlist");
  const journalNav = document.getElementById("navJournal");
  const journalSec = document.getElementById("journal");
  const expensesNav = document.getElementById("navExpenses");
  const expensesSec = document.getElementById("expenses");
  const packingNav = document.getElementById("navPacking");
  const packingSec = document.getElementById("packingChecklist");
  const tripDashNav = document.getElementById("navTripDashboard");
  const tripDashSec = document.getElementById("tripDashboard");

  if (currentUser) {
    authBtns.style.display = "none";
    userMenu.style.display = "flex";
    nameEl.textContent = currentUser.name;
    if (histNav) histNav.style.display = "";
    if (histSec) histSec.style.display = "";
    if (wlNav) wlNav.style.display = "";
    if (wlSec) wlSec.style.display = "";
    if (journalNav) journalNav.style.display = "";
    if (journalSec) journalSec.style.display = "";
    if (expensesNav) expensesNav.style.display = "";
    if (expensesSec) expensesSec.style.display = "";
    if (packingNav) packingNav.style.display = "";
    if (packingSec) packingSec.style.display = "";
    if (tripDashNav) tripDashNav.style.display = "";
    if (tripDashSec) tripDashSec.style.display = "";
    loadTrips();
    loadFavorites();
    loadExpenses();
    loadPackingItems();
    loadJournalNotes();
    if (typeof initTripDashboard === "function") initTripDashboard();
  } else {
    authBtns.style.display = "flex";
    userMenu.style.display = "none";
    nameEl.textContent = "";
    if (histNav) histNav.style.display = "none";
    if (histSec) histSec.style.display = "none";
    if (wlNav) wlNav.style.display = "none";
    if (wlSec) wlSec.style.display = "none";
    if (journalNav) journalNav.style.display = "none";
    if (journalSec) journalSec.style.display = "none";
    if (expensesNav) expensesNav.style.display = "none";
    if (expensesSec) expensesSec.style.display = "none";
    if (packingNav) packingNav.style.display = "none";
    if (packingSec) packingSec.style.display = "none";
    if (tripDashNav) tripDashNav.style.display = "none";
    if (tripDashSec) tripDashSec.style.display = "none";
  }
}

async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (data.authenticated) {
      currentUser = data.user;
    } else {
      currentUser = null;
    }
  } catch {
    currentUser = null;
  }
  updateAuthUI();
}

// ── Auth Modal ────────────────────────────────────────────
function openAuthModal(form) {
  document.getElementById("authModal").style.display = "flex";
  switchAuthForm(form || "login");
  document.getElementById("loginError").style.display = "none";
  document.getElementById("registerError").style.display = "none";
}

function closeAuthModal(event) {
  if (event && event.target !== document.getElementById("authModal")) return;
  document.getElementById("authModal").style.display = "none";
}

function switchAuthForm(form) {
  document.getElementById("loginForm").style.display =
    form === "login" ? "block" : "none";
  document.getElementById("registerForm").style.display =
    form === "register" ? "block" : "none";
  document.getElementById("loginError").style.display = "none";
  document.getElementById("registerError").style.display = "none";
}

// ── Login ─────────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");

  if (!email || !password) {
    errEl.textContent = "Please fill in all fields.";
    errEl.style.display = "block";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (res.ok) {
      currentUser = data.user;
      updateAuthUI();
      closeAuthModal();
      document.getElementById("loginEmail").value = "";
      document.getElementById("loginPassword").value = "";
    } else {
      errEl.textContent = data.error || "Login failed.";
      errEl.style.display = "block";
    }
  } catch {
    errEl.textContent = "Network error – please try again.";
    errEl.style.display = "block";
  }
}

// ── Register ──────────────────────────────────────────────
async function handleRegister() {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const errEl = document.getElementById("registerError");

  if (!name || !email || !password) {
    errEl.textContent = "Please fill in all fields.";
    errEl.style.display = "block";
    return;
  }

  if (password.length < 6) {
    errEl.textContent = "Password must be at least 6 characters.";
    errEl.style.display = "block";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (res.ok) {
      currentUser = data.user;
      updateAuthUI();
      closeAuthModal();
      document.getElementById("regName").value = "";
      document.getElementById("regEmail").value = "";
      document.getElementById("regPassword").value = "";
    } else {
      errEl.textContent = data.error || "Registration failed.";
      errEl.style.display = "block";
    }
  } catch {
    errEl.textContent = "Network error – please try again.";
    errEl.style.display = "block";
  }
}

// ── Logout ────────────────────────────────────────────────
async function handleLogout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
  } catch {
    /* no-op */
  }
  currentUser = null;
  updateAuthUI();
}

// ═══════════════════════════════════════════════════════════
// TRIP HISTORY
// ═══════════════════════════════════════════════════════════
async function loadTrips() {
  if (!currentUser) return;

  const container = document.getElementById("tripsContainer");
  try {
    const res = await fetch(`${API_BASE}/api/trips`, {
      credentials: "same-origin",
    });
    const data = await res.json();

    if (!res.ok || !data.trips || data.trips.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-plane-departure"></i>
                    <p>No trips saved yet. Use the Budget Planner to create one!</p>
                </div>`;
      return;
    }

    container.innerHTML = data.trips
      .map((trip) => {
        const date = new Date(trip.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        return `
                <div class="trip-card" data-trip-id="${trip.id}">
                    <div class="trip-card-header">
                        <h3><i class="fas fa-map-marker-alt"></i> ${trip.destination}</h3>
                        <button class="trip-delete" data-action="delete-trip" data-id="${trip.id}" title="Delete trip">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                    <div class="trip-meta">
                        <span><i class="fas fa-calendar-day"></i> ${trip.num_days} days</span>
                        <span><i class="fas fa-users"></i> ${trip.family_size} people</span>
                        <span><i class="fas fa-tag"></i> ${trip.travel_class || "budget"} class</span>
                    </div>
                    <div class="trip-total">
                        <span class="label">Estimated Total</span>
                        <span class="amount">${formatINR(trip.estimated_budget)}</span>
                    </div>
                    <div class="trip-date">${date}</div>
                </div>
            `;
      })
      .join("");
  } catch {
    container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Could not load trips.</p>
            </div>`;
  }
}

async function deleteTrip(tripId) {
  if (!confirm("Delete this trip?")) return;

  try {
    const res = await fetch(`${API_BASE}/api/trips/${tripId}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });

    if (res.ok) {
      loadTrips();
    } else {
      showToast("Could not delete trip.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

// ═══════════════════════════════════════════════════════════
// FAVORITES / WISHLIST
// ═══════════════════════════════════════════════════════════
let favoritesCache = [];
let activeWlFilter = "all";

async function loadFavorites() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API_BASE}/api/favorites`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    favoritesCache = data.favorites || [];
    renderWishlist();
    refreshGalleryHearts();
  } catch {
    favoritesCache = [];
  }
}

function renderWishlist() {
  const grid = document.getElementById("wishlistGrid");
  if (!grid) return;

  let items = favoritesCache;
  if (activeWlFilter !== "all") {
    items = items.filter((f) => f.item_type === activeWlFilter);
  }

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" id="wishlistEmpty">
        <i class="fas fa-heart"></i>
        <p>${activeWlFilter === "all" ? "No favorites yet. Click the <i class='fas fa-heart'></i> on any destination to bookmark it!" : `No ${activeWlFilter} favorites yet.`}</p>
      </div>`;
    return;
  }

  grid.innerHTML = items
    .map((f) => {
      const date = new Date(f.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const icon =
        f.item_type === "destination" ? "fa-map-marker-alt" : "fa-landmark";
      return `
        <div class="wl-card" data-fav-id="${f.id}" data-fav-name="${f.item_name}" data-fav-type="${f.item_type}">
          <div class="wl-card-header">
            <div>
              <div class="wl-card-name"><i class="fas ${icon}"></i> ${f.item_name}</div>
              ${f.notes ? `<div class="wl-card-notes">${f.notes}</div>` : ""}
            </div>
            <span class="wl-card-type ${f.item_type}">${f.item_type}</span>
          </div>
          <div class="wl-card-date"><i class="fas fa-clock"></i> Added ${date}</div>
          <div class="wl-card-actions">
            ${f.item_type === "destination" ? `<button data-action="scroll-to-budget" data-dest="${f.item_name}"><i class="fas fa-wallet"></i> Budget</button>` : ""}
            ${f.item_type === "destination" ? `<button data-action="scroll-to-safety" data-dest="${f.item_name}"><i class="fas fa-shield-alt"></i> Safety</button>` : ""}
            <button class="wl-remove-btn" data-action="remove-favorite" data-id="${f.id}"><i class="fas fa-trash-alt"></i> Remove</button>
          </div>
        </div>`;
    })
    .join("");
}

async function toggleFavorite(itemName, itemType) {
  if (!currentUser) {
    showToast("Please log in to save favorites.", "warning");
    openAuthModal("login");
    return;
  }
  const existing = favoritesCache.find(
    (f) => f.item_name === itemName && f.item_type === itemType,
  );
  if (existing) {
    await removeFavorite(existing.id);
  } else {
    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify({ item_name: itemName, item_type: itemType }),
      });
      if (res.ok) {
        showToast(`${itemName} added to wishlist!`, "success");
        await loadFavorites();
      } else {
        const data = await res.json();
        showToast(data.error || "Could not add favorite.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  }
}

async function removeFavorite(favId) {
  try {
    const res = await fetch(`${API_BASE}/api/favorites/${favId}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
    if (res.ok) {
      showToast("Removed from wishlist.", "info");
      await loadFavorites();
    } else {
      showToast("Could not remove favorite.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

function isFavorited(name, type) {
  return favoritesCache.some(
    (f) => f.item_name === name && f.item_type === type,
  );
}

function refreshGalleryHearts() {
  document.querySelectorAll(".dest-fav-btn").forEach((btn) => {
    const name = btn.dataset.destName;
    if (isFavorited(name, "destination")) {
      btn.classList.add("active");
      btn.innerHTML = '<i class="fas fa-heart"></i>';
    } else {
      btn.classList.remove("active");
      btn.innerHTML = '<i class="far fa-heart"></i>';
    }
  });
}

// Wire up wishlist filter buttons
document.querySelectorAll(".wl-filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".wl-filter")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeWlFilter = btn.dataset.type;
    renderWishlist();
  });
});

// ═══════════════════════════════════════════════════════════
// AI ITINERARY GENERATOR
// ═══════════════════════════════════════════════════════════
document.getElementById("itinSubmit").addEventListener("click", async () => {
  const dest = document.getElementById("itinDest").value;
  const days = parseInt(document.getElementById("itinDays").value);
  const family = parseInt(document.getElementById("itinFamily").value);
  const cls = document.getElementById("itinClass").value;
  const interests = document.getElementById("itinInterests").value.trim();

  if (!dest) return showToast("Please select a destination.", "warning");
  if (!days || days < 1 || days > 14)
    return showToast("Please enter 1–14 days.", "warning");
  if (!family || family < 1)
    return showToast("Please enter valid family size.", "warning");

  const resultDiv = document.getElementById("itinResult");
  resultDiv.innerHTML = `
    <div class="result-placeholder">
      <i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--primary-light)"></i>
      <p style="margin-top:12px">Generating your personalised itinerary…<br>
      <small style="color:var(--text-muted)">This may take 10–20 seconds</small></p>
    </div>`;

  try {
    const res = await fetch(`${API_BASE}/api/itinerary/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        destination: dest,
        num_days: days,
        family_size: family,
        travel_class: cls,
        interests: interests,
      }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      resultDiv.innerHTML = `
        <div class="result-placeholder">
          <i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i>
          <p>${data.error || "Failed to generate itinerary."}</p>
        </div>`;
      return;
    }

    resultDiv.innerHTML = renderItinerary(data);

    // Wire up accordion toggles
    resultDiv.querySelectorAll(".itin-day-header").forEach((hdr) => {
      hdr.addEventListener("click", () => {
        hdr.closest(".itin-day").classList.toggle("open");
      });
    });

    // Wire up PDF export
    const itinExportBtn = resultDiv.querySelector("#exportItinPdf");
    if (itinExportBtn) {
      itinExportBtn.addEventListener("click", () => {
        downloadPDF(
          "/api/export/itinerary",
          data,
          `${data.destination}_Itinerary.pdf`,
        );
      });
    }

    // Wire up Share Trip button
    const shareBtn = resultDiv.querySelector("#shareItinBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", () => shareItinerary(data));
    }

    // Wire up view toggle (Accordion / Timeline)
    resultDiv.querySelectorAll(".itin-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        resultDiv
          .querySelectorAll(".itin-view-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const view = btn.dataset.view;
        const accordionView = resultDiv.querySelector(".itin-accordion-view");
        const timelineView = resultDiv.querySelector(".itin-timeline-view");
        if (view === "timeline") {
          accordionView.style.display = "none";
          timelineView.style.display = "";
          timelineView.innerHTML = renderTimelineView(data);
        } else {
          accordionView.style.display = "";
          timelineView.style.display = "none";
        }
      });
    });

    // Wire up drag-and-drop for itinerary slots
    initItineraryDragDrop(resultDiv, data);

    showToast(`${days}-day itinerary for ${dest} ready!`, "success");
  } catch (err) {
    resultDiv.innerHTML = `
      <div class="result-placeholder">
        <i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i>
        <p>Network error – is the server running?</p>
      </div>`;
    showToast("Network error – is the server running?", "error");
  }
});

function renderItinerary(data) {
  const SLOT_ICONS = {
    morning: { icon: "fas fa-sun", cls: "morning", label: "Morning" },
    afternoon: {
      icon: "fas fa-cloud-sun",
      cls: "afternoon",
      label: "Afternoon",
    },
    evening: { icon: "fas fa-moon", cls: "evening", label: "Evening" },
  };

  const dayCards = data.itinerary
    .map((day, idx) => {
      const slots = ["morning", "afternoon", "evening"]
        .map((period) => {
          const s = day[period];
          if (!s) return "";
          const meta = SLOT_ICONS[period];
          return `
          <div class="itin-slot" draggable="true" data-day="${idx}" data-period="${period}">
            <div class="itin-slot-icon ${meta.cls}"><i class="${meta.icon}"></i></div>
            <div class="itin-slot-content">
              <div class="itin-slot-label">${meta.label}</div>
              <div class="itin-slot-activity" contenteditable="true" title="Click to edit">${s.activity || ""}</div>
              <div class="itin-slot-desc">${s.description || ""}</div>
              <div class="itin-slot-meta">
                ${s.duration ? `<span><i class="fas fa-clock"></i>${s.duration}</span>` : ""}
                ${s.cost ? `<span><i class="fas fa-rupee-sign"></i>${s.cost}</span>` : ""}
              </div>
            </div>
          </div>`;
        })
        .join("");

      const tip = day.tip
        ? `<div class="itin-tip"><i class="fas fa-lightbulb"></i>${day.tip}</div>`
        : "";

      return `
        <div class="itin-day ${idx === 0 ? "open" : ""}">
          <div class="itin-day-header">
            <div class="itin-day-badge">${day.day || idx + 1}</div>
            <div class="itin-day-title">${day.title || `Day ${idx + 1}`}</div>
            <div class="itin-day-toggle"><i class="fas fa-chevron-down"></i></div>
          </div>
          <div class="itin-day-body">
            <div class="itin-slots">${slots}</div>
            ${tip}
          </div>
        </div>`;
    })
    .join("");

  return `
    <div class="itin-timeline">
      <div style="text-align:center;margin-bottom:8px;">
        <span style="background:var(--primary);color:#fff;padding:6px 16px;border-radius:20px;font-size:0.85rem;font-weight:600">
          <i class="fas fa-route"></i> ${data.num_days}-Day ${data.destination} Itinerary
        </span>
      </div>
      <div class="itin-view-toggle" style="text-align:center;margin-bottom:12px;">
        <button class="btn btn-sm btn-outline itin-view-btn active" data-view="accordion"><i class="fas fa-list"></i> Accordion</button>
        <button class="btn btn-sm btn-outline itin-view-btn" data-view="timeline"><i class="fas fa-stream"></i> Timeline</button>
      </div>
      <div class="itin-accordion-view">${dayCards}</div>
      <div class="itin-timeline-view" style="display:none"></div>
      <div style="text-align:center;margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn-export" id="exportItinPdf">
          <i class="fas fa-file-pdf"></i> Export as PDF
        </button>
        <button class="btn-export" id="shareItinBtn" style="background:var(--primary)">
          <i class="fas fa-share-alt"></i> Share Trip
        </button>
      </div>
      <div id="shareResult" style="display:none;text-align:center;margin-top:10px;"></div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// INTERACTIVE MAP (TomTom)
// ═══════════════════════════════════════════════════════════
let TOMTOM_KEY = ""; // fetched from /api/maps/config at runtime

let ttMap = null;
let mapMarkers = [];
let routeLayer = null;

// Dynamically loaded from /api/maps/destinations
let DEST_COORDS = {};

// Rich metadata for compare module + smart hub (loaded from /api/destinations)
let DEST_META = {};

// ── Fetch destinations from API & populate dropdowns ─────
async function loadDestinations() {
  try {
    // Load coordinates from maps API
    const res = await fetch(`${API_BASE}/api/maps/destinations`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load destinations");

    // Build DEST_COORDS from maps API response
    DEST_COORDS = {};
    data.destinations.forEach((d) => {
      DEST_COORDS[d.id] = { lat: d.lat, lon: d.lon, label: d.label };
    });

    // Load rich metadata from destinations API
    try {
      const metaRes = await fetch(`${API_BASE}/api/destinations`);
      const metaData = await metaRes.json();
      if (metaRes.ok) {
        DEST_META = {};
        (metaData.destinations || []).forEach((d) => {
          DEST_META[d.id] = {
            region: d.region || "",
            season: d.best_season || "",
            highlight: d.highlight || "",
            tagline: d.tagline || "",
          };
        });
      }
    } catch (_) {}

    // Populate map-specific dropdowns (value = lowercase key)
    populateDropdown("mapDest", "Select destination…");
    populateDropdown("routeFrom", "Origin city…");
    populateDropdown("routeTo", "Destination city…");

    // Populate Places Explorer dropdown
    populatePlacesDropdown();

    // Populate ALL data-dest-dropdown selects (value = label, e.g. "Goa")
    populateDestDropdowns();

    // If map is already loaded, add markers
    if (ttMap) addAllDestinationMarkers();
  } catch (err) {
    console.error("Could not load destinations:", err);
  }
}

/** Populate all <select data-dest-dropdown> elements from DEST_COORDS */
function populateDestDropdowns() {
  const selects = document.querySelectorAll("select[data-dest-dropdown]");
  const sorted = Object.values(DEST_COORDS).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  selects.forEach((sel) => {
    // Keep the first <option> (placeholder) and remove the rest
    const placeholder = sel.querySelector("option");
    sel.innerHTML = "";
    if (placeholder) sel.appendChild(placeholder);
    sorted.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.label; // "Goa", "Jaipur", etc.
      opt.textContent = d.label;
      sel.appendChild(opt);
    });
  });
}

/** Get display label for a destination key */
function destLabel(key) {
  return (DEST_COORDS[key] && DEST_COORDS[key].label) || key;
}

function populateDropdown(selectId, placeholder) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  Object.entries(DEST_COORDS)
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .forEach(([key, d]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = d.label;
      sel.appendChild(opt);
    });
}

async function initMap() {
  if (ttMap) return; // already initialized

  const container = document.getElementById("tomtomMap");
  if (!container) return;

  // Fetch TomTom key from backend if not yet loaded
  if (!TOMTOM_KEY) {
    try {
      const cfgRes = await fetch(`${API_BASE}/api/maps/config`);
      const cfgData = await cfgRes.json();
      if (!cfgData.available) {
        container.innerHTML =
          '<p style="text-align:center;padding:40px;color:#888;">Map service unavailable.</p>';
        return;
      }
      TOMTOM_KEY = cfgData.key;
    } catch (e) {
      console.error("Could not fetch map config:", e);
      return;
    }
  }

  // Ensure the container has dimensions before map init
  container.style.width = "100%";
  container.style.height = "500px";

  ttMap = tt.map({
    key: TOMTOM_KEY,
    container: "tomtomMap",
    center: [78.9629, 22.5937], // Center of India [lon, lat]
    zoom: 4.5,
  });

  // Add controls after map loads
  ttMap.addControl(new tt.NavigationControl());
  ttMap.addControl(new tt.FullScreenControl());

  // Force resize once tiles load (fixes blank map issue)
  ttMap.on("load", () => {
    ttMap.resize();
    // Add destination markers after map is fully ready
    if (Object.keys(DEST_COORDS).length > 0) {
      addAllDestinationMarkers();
    }
  });
}

function addAllDestinationMarkers() {
  Object.entries(DEST_COORDS).forEach(([key, d]) => {
    const el = document.createElement("div");
    el.className = "custom-marker";
    el.innerHTML = '<i class="fas fa-map-pin" style="font-size:14px;"></i>';
    el.title = d.label;

    const popup = new tt.Popup({ offset: 20 }).setHTML(
      `<div style="padding:6px 10px;font-family:Poppins,sans-serif;">
                <strong style="font-size:0.9rem;">${d.label}</strong><br>
                <span style="font-size:0.75rem;color:#666;">
                    ${d.lat.toFixed(4)}°N, ${d.lon.toFixed(4)}°E
                </span>
            </div>`,
    );

    const marker = new tt.Marker({ element: el })
      .setLngLat([d.lon, d.lat])
      .setPopup(popup)
      .addTo(ttMap);

    mapMarkers.push(marker);
  });
}

function clearPOIMarkers() {
  // Keep destination markers (first 15), remove POI markers
  const destCount = Object.keys(DEST_COORDS).length;
  while (mapMarkers.length > destCount) {
    mapMarkers.pop().remove();
  }
}

function clearRoute() {
  if (routeLayer && ttMap.getLayer("route")) {
    ttMap.removeLayer("route");
    ttMap.removeSource("route");
    routeLayer = null;
  }
  document.getElementById("routeInfo").style.display = "none";
}

// ── Explore Nearby POIs ──────────────────────────────────
document.getElementById("mapExploreBtn").addEventListener("click", async () => {
  const dest = document.getElementById("mapDest").value;
  const category = document.getElementById("mapCategory").value;

  if (!dest) return showToast("Please select a destination.", "warning");

  const coords = DEST_COORDS[dest];
  if (!coords) return;

  // Fly to destination
  ttMap.flyTo({ center: [coords.lon, coords.lat], zoom: 12, speed: 1.5 });

  showLoader();
  clearPOIMarkers();

  try {
    const res = await fetch(
      `${API_BASE}/api/maps/nearby?dest=${encodeURIComponent(dest)}&category=${encodeURIComponent(category)}&limit=10`,
    );
    const data = await res.json();
    hideLoader();

    if (!res.ok) {
      showToast(data.error || "Failed to fetch nearby places.", "error");
      return;
    }

    const poiContainer = document.getElementById("poiResults");

    if (data.pois.length === 0) {
      poiContainer.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <i class="fas fa-search"></i>
                    <p>No ${category} found near ${coords.label}.</p>
                </div>`;
      poiContainer.style.display = "grid";
      return;
    }

    // Add POI markers to map
    data.pois.forEach((poi, idx) => {
      if (!poi.lat || !poi.lon) return;

      const el = document.createElement("div");
      el.className = "custom-marker poi-marker";
      el.innerHTML = `<span>${idx + 1}</span>`;
      el.title = poi.name;

      const popup = new tt.Popup({ offset: 16 }).setHTML(
        `<div style="padding:6px 10px;font-family:Poppins,sans-serif;max-width:200px;">
                    <strong style="font-size:0.85rem;">${poi.name}</strong><br>
                    <span style="font-size:0.72rem;color:#666;">${poi.category}</span><br>
                    <span style="font-size:0.72rem;color:#888;">${poi.address}</span>
                    ${poi.phone ? `<br><span style="font-size:0.72rem;">📞 ${poi.phone}</span>` : ""}
                </div>`,
      );

      const marker = new tt.Marker({ element: el })
        .setLngLat([poi.lon, poi.lat])
        .setPopup(popup)
        .addTo(ttMap);

      mapMarkers.push(marker);
    });

    // Render POI cards
    poiContainer.innerHTML = data.pois
      .map(
        (poi, idx) => `
            <div class="poi-card">
                <h4><i class="fas fa-map-marker-alt"></i> ${poi.name}</h4>
                <div class="poi-card-meta">
                    <span><i class="fas fa-tag"></i> ${poi.category}</span>
                    <span><i class="fas fa-ruler"></i> ${(poi.distance_m / 1000).toFixed(1)} km</span>
                </div>
                <p>${poi.address}</p>
                ${
                  poi.lat && poi.lon
                    ? `<button class="poi-show-on-map" data-action="fly-to-poi" data-lat="${poi.lat}" data-lon="${poi.lon}">
                        <i class="fas fa-crosshairs"></i> Show on map
                      </button>`
                    : ""
                }
            </div>
        `,
      )
      .join("");
    poiContainer.style.display = "grid";
  } catch (err) {
    hideLoader();
    showToast("Network error – is the server running?", "error");
  }
});

function flyToPOI(lat, lon) {
  if (!ttMap) return;
  ttMap.flyTo({ center: [lon, lat], zoom: 16, speed: 1.2 });
}

// ── Route Planner ────────────────────────────────────────
document.getElementById("mapRouteBtn").addEventListener("click", async () => {
  const from = document.getElementById("routeFrom").value;
  const to = document.getElementById("routeTo").value;
  const mode = document.getElementById("routeMode").value;

  if (!from || !to)
    return showToast("Please select both origin and destination.", "warning");
  if (from === to)
    return showToast("Origin and destination must be different.", "warning");

  clearRoute();
  clearPOIMarkers();
  showLoader();

  try {
    const res = await fetch(
      `${API_BASE}/api/maps/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${mode}`,
    );
    const data = await res.json();
    hideLoader();

    if (!res.ok) {
      showToast(data.error || "Could not calculate route.", "error");
      return;
    }

    // Display route info
    document.getElementById("routeDistance").textContent =
      `${data.distance_km} km`;
    document.getElementById("routeDuration").textContent = formatDuration(
      data.duration_min,
    );
    document.getElementById("routeTraffic").textContent =
      data.traffic_delay_min > 0
        ? `+${data.traffic_delay_min} min delay`
        : "No delays";
    document.getElementById("routeInfo").style.display = "flex";

    // Draw route on map
    if (data.geometry && data.geometry.length > 0) {
      const geojson = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: data.geometry.map((p) => [p[1], p[0]]), // [lon, lat]
        },
      };

      ttMap.addSource("route", { type: "geojson", data: geojson });
      ttMap.addLayer({
        id: "route",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#14b8a6",
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });
      routeLayer = true;

      // Fit map to route bounds
      const bounds = new tt.LngLatBounds();
      data.geometry.forEach((p) => bounds.extend([p[1], p[0]]));
      ttMap.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }
  } catch (err) {
    hideLoader();
    showToast("Network error – is the server running?", "error");
  }
});

function formatDuration(minutes) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Initialize map when section scrolls into view ────────
let mapInitialized = false;
const mapObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !mapInitialized) {
        mapInitialized = true;
        // Small delay to ensure container is laid out
        setTimeout(() => initMap(), 100);
        mapObserver.disconnect();
      }
    });
  },
  { threshold: 0.05 },
);

const mapSection = document.getElementById("maps");
if (mapSection) mapObserver.observe(mapSection);

// ── Sync map destination dropdown with Explore click ─────
document.getElementById("mapDest").addEventListener("change", function () {
  const dest = this.value;
  if (dest && DEST_COORDS[dest] && ttMap) {
    clearRoute();
    clearPOIMarkers();
    document.getElementById("poiResults").style.display = "none";
    const c = DEST_COORDS[dest];
    ttMap.flyTo({ center: [c.lon, c.lat], zoom: 10, speed: 1.5 });
  }
});

// ── Check auth on page load ──────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  checkAuth();
  await loadDestinations();
  checkChatStatus(); // Check if Gemini AI is available
  loadDestinationGallery(); // Load Unsplash destination images — after DEST_COORDS ready
});

// ═══════════════════════════════════════════════════════════
// UNSPLASH DESTINATION GALLERY
// ═══════════════════════════════════════════════════════════

/** Cached gallery image data */
let galleryImages = {};

/** Show premium skeleton placeholders while gallery loads */
function showGallerySkeletons() {
  const gallery = document.getElementById("destGallery");
  if (!gallery) return;
  const colors = [
    "#0ea5e9",
    "#8b5cf6",
    "#f59e0b",
    "#ec4899",
    "#10b981",
    "#6366f1",
    "#14b8a6",
    "#f97316",
  ];
  const skeletons = Array.from({ length: 8 })
    .map(
      (_, i) => `
    <div class="dest-card-skeleton" style="animation-delay:${i * 0.1}s">
      <div class="skel-img" style="background-color:${colors[i % colors.length]}15"></div>
      <div class="skel-overlay">
        <div class="skel-tags">
          <div class="skel-tag"></div>
          <div class="skel-tag short"></div>
        </div>
        <div class="skel-line title"></div>
        <div class="skel-line subtitle"></div>
        <div class="skel-actions">
          <div class="skel-btn"></div>
          <div class="skel-btn"></div>
          <div class="skel-btn"></div>
        </div>
      </div>
    </div>
  `,
    )
    .join("");
  gallery.innerHTML = skeletons;
}

/** Fetch one image per destination from /api/images/destinations */
async function loadDestinationGallery() {
  const gallery = document.getElementById("destGallery");
  if (!gallery) return;

  showGallerySkeletons();

  try {
    const resp = await fetch(`${API_BASE}/api/images/destinations`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    galleryImages = data.images || {};

    if (!Object.keys(galleryImages).length) {
      gallery.innerHTML =
        '<p class="gallery-loading"><i class="fas fa-image"></i> No images available at the moment.</p>';
      return;
    }

    renderGallery(galleryImages);
  } catch (err) {
    console.error("Gallery load error:", err);
    gallery.innerHTML =
      '<p class="gallery-loading"><i class="fas fa-exclamation-circle"></i> Could not load destination images.</p>';
  }
}

/** Render gallery cards from image data — progressive blur-up loading */
function renderGallery(images) {
  const gallery = document.getElementById("destGallery");

  gallery.innerHTML = Object.entries(images)
    .map(([key, img], idx) => {
      const name = destLabel(key);
      const hearted = isFavorited(name, "destination");
      const tags = getDestTags(key);
      const tagStr = tags
        .map(
          (t) =>
            `<span class="dest-tag dest-tag-${t}">${destTagLabel(t)}</span>`,
        )
        .join("");
      const region = getDestRegion(key);
      const bgColor = img.color || "#1e293b";
      const thumbUrl = img.url_thumb || img.url_small;
      const fullUrl = img.url_small;
      return `
    <div class="dest-card" data-dest-key="${key}" data-dest-name="${name.toLowerCase()}" data-dest-tags="${tags.join(",")}" data-dest-region="${region.toLowerCase()}" data-tilt style="animation-delay:${idx * 0.06}s">
      <div class="dest-card-inner" data-action="open-smart-hub-dest" data-dest="${name}">
        <button class="dest-fav-btn ${hearted ? "active" : ""}" data-dest-name="${name}" data-action="toggle-fav" data-name="${name}" data-type="destination" data-stop-propagation title="${hearted ? "Remove from wishlist" : "Add to wishlist"}">
          <i class="${hearted ? "fas" : "far"} fa-heart"></i>
        </button>
        <div class="dest-card-img-wrap" style="background-color:${bgColor}">
          <img
            class="dest-card-img dest-img-blur"
            src="${thumbUrl}"
            data-src="${fullUrl}"
            alt="${img.alt || name}"
            loading="lazy"
            data-progressive-load
          />
          <div class="dest-card-shine"></div>
        </div>
        <div class="dest-card-overlay">
          <div class="dest-card-tags">${tagStr}</div>
          <div class="dest-card-name">${name}</div>
          <div class="dest-card-region"><i class="fas fa-map-marker-alt"></i> ${region}</div>
          <div class="dest-card-quick-stats">
            <span class="dest-quick-stat" title="Best time to visit"><i class="fas fa-calendar-alt"></i> ${getDestSeason(key)}</span>
            <span class="dest-quick-stat" title="Known for"><i class="fas fa-star"></i> ${getDestHighlight(key)}</span>
          </div>
          <div class="dest-live-badges" id="destLive-${key}"></div>
          <div class="dest-card-actions">
            <button class="dest-action-btn dest-action-explore" data-action="open-smart-hub-dest" data-dest="${name}" data-stop-propagation>
              <i class="fas fa-compass"></i> Explore
            </button>
            <button class="dest-action-btn" data-action="plan-trip-dest" data-dest="${name}" data-stop-propagation>
              <i class="fas fa-route"></i> Plan Trip
            </button>
            <button class="dest-action-btn" data-action="scroll-to-weather" data-dest="${name}" data-stop-propagation>
              <i class="fas fa-cloud-sun"></i> Weather
            </button>
            <button class="dest-action-btn" data-action="open-dest-photos" data-key="${key}" data-stop-propagation>
              <i class="fas fa-images"></i> Photos
            </button>
          </div>
        </div>
        <a class="dest-card-credit" href="${img.photographer_url}" target="_blank" rel="noopener" data-stop-propagation>
          📷 ${img.photographer}
        </a>
      </div>
    </div>
  `;
    })
    .join("");

  // Update count
  const countEl = document.getElementById("destCount");
  if (countEl)
    countEl.textContent = `${Object.keys(images).length} destinations`;

  // Init dest controls
  initDestControls();

  // Observe cards for scroll-triggered reveal + lazy live data
  observeDestCards();

  // Lazy-load live weather badges when cards scroll into view
  observeDestLiveData();
}

/** Cache for live data per destination */
const destLiveCache = {};

/** Observe destination cards and fetch live weather/safety data when visible */
function observeDestLiveData() {
  const cards = document.querySelectorAll(".dest-card");
  if (!cards.length || !window.IntersectionObserver) return;
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const key = e.target.dataset.destKey;
          const name = e.target.dataset.destName;
          if (key && name) fetchDestLiveBadges(key, name);
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "200px 0px 200px 0px" },
  );
  cards.forEach((c) => obs.observe(c));
}

/** Fetch live weather + safety for a dest card badge strip */
async function fetchDestLiveBadges(key, name) {
  const el = document.getElementById(`destLive-${key}`);
  if (!el || destLiveCache[key]) return;
  destLiveCache[key] = true;

  // Show shimmer placeholders
  el.innerHTML =
    '<span class="dest-live-badge shimmer" style="width:70px;height:20px"></span><span class="dest-live-badge shimmer" style="width:70px;height:20px"></span>';

  const label = destLabel(key);
  try {
    const [wRes, sRes] = await Promise.allSettled([
      fetch(
        `${API_BASE}/api/weather?destination=${encodeURIComponent(label)}`,
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `${API_BASE}/api/safety?destination=${encodeURIComponent(label)}`,
      ).then((r) => (r.ok ? r.json() : null)),
    ]);
    const w = wRes.status === "fulfilled" ? wRes.value : null;
    const s = sRes.status === "fulfilled" ? sRes.value : null;
    let badges = "";
    if (w && w.temperature_c != null) {
      const icon =
        w.temperature_c > 30
          ? "fa-sun"
          : w.temperature_c > 20
            ? "fa-cloud-sun"
            : w.temperature_c > 10
              ? "fa-cloud"
              : "fa-snowflake";
      badges += `<span class="dest-live-badge dest-live-temp" title="${w.description || "Current weather"}"><i class="fas ${icon}"></i> ${Math.round(w.temperature_c)}°C</span>`;
    }
    if (s && s.overall_score != null) {
      const score = parseFloat(s.overall_score);
      const cls = score >= 7 ? "safe" : score >= 4 ? "moderate" : "caution";
      badges += `<span class="dest-live-badge dest-live-safety dest-safety-${cls}" title="Safety score: ${score}/10"><i class="fas fa-shield-alt"></i> ${score}/10</span>`;
    }
    el.innerHTML = badges || "";
  } catch {
    el.innerHTML = "";
  }
}

/** Progressive blur-up: swap thumb → full-size once thumb loads */
function destProgressiveLoad(img) {
  const fullSrc = img.dataset.src;
  if (!fullSrc || img.src === fullSrc) return;
  const hi = new Image();
  hi.onload = () => {
    img.src = fullSrc;
    img.classList.remove("dest-img-blur");
    img.classList.add("dest-img-loaded");
  };
  hi.src = fullSrc;
}

/** IntersectionObserver for scroll-triggered card reveal */
function observeDestCards() {
  const cards = document.querySelectorAll(".dest-card");
  if (!cards.length || !window.IntersectionObserver) return;
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("dest-card-visible");
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
  );
  cards.forEach((c) => obs.observe(c));
}

/** Open lightbox at a specific gallery card — supports arrow key navigation */
function openGalleryLightbox(destKey) {
  const keys = Object.keys(galleryImages);
  let idx = keys.indexOf(destKey);
  if (idx < 0) idx = 0;
  showDestLightbox(keys, idx);
}

function showDestLightbox(keys, idx) {
  const existing = document.querySelector(".dest-lightbox-overlay");
  if (existing) existing.remove();

  const img = galleryImages[keys[idx]];
  if (!img) return;
  const name = destLabel(keys[idx]);
  const total = keys.length;

  const overlay = document.createElement("div");
  overlay.className = "dest-lightbox-overlay";
  overlay.innerHTML = `
    <button class="dest-lb-close" title="Close (Esc)"><i class="fas fa-times"></i></button>
    <button class="dest-lb-prev ${idx === 0 ? "dest-lb-disabled" : ""}" title="Previous (←)"><i class="fas fa-chevron-left"></i></button>
    <button class="dest-lb-next ${idx === total - 1 ? "dest-lb-disabled" : ""}" title="Next (→)"><i class="fas fa-chevron-right"></i></button>
    <div class="dest-lb-counter">${idx + 1} / ${total}</div>
    <div class="dest-lb-body">
      <img class="dest-lb-img dest-img-blur" src="${img.url_small}" data-full="${img.url_regular}" alt="${img.alt || name}" />
    </div>
    <div class="dest-lb-info">
      <div class="dest-lb-name">${name}</div>
      <div class="dest-lb-meta">
        <span><i class="fas fa-map-marker-alt"></i> ${getDestRegion(keys[idx])}</span>
        <span><i class="fas fa-calendar-alt"></i> ${getDestSeason(keys[idx])}</span>
        <span><i class="fas fa-star"></i> ${getDestHighlight(keys[idx])}</span>
      </div>
      <div class="dest-lb-credit">📷 <a href="${img.photographer_url}" target="_blank" rel="noopener">${img.photographer}</a> on Unsplash</div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("active"));

  // Load full-res
  const lbImg = overlay.querySelector(".dest-lb-img");
  const full = new Image();
  full.onload = () => {
    lbImg.src = img.url_regular;
    lbImg.classList.remove("dest-img-blur");
    lbImg.classList.add("dest-img-loaded");
  };
  full.src = img.url_regular;

  // Navigation
  const goPrev = () => {
    if (idx > 0) showDestLightbox(keys, idx - 1);
  };
  const goNext = () => {
    if (idx < total - 1) showDestLightbox(keys, idx + 1);
  };

  overlay.querySelector(".dest-lb-prev").addEventListener("click", (e) => {
    e.stopPropagation();
    goPrev();
  });
  overlay.querySelector(".dest-lb-next").addEventListener("click", (e) => {
    e.stopPropagation();
    goNext();
  });
  overlay
    .querySelector(".dest-lb-close")
    .addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const onKey = (e) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    } else if (e.key === "ArrowLeft") {
      goPrev();
      document.removeEventListener("keydown", onKey);
    } else if (e.key === "ArrowRight") {
      goNext();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);
}

/** Destination metadata fallback map */
const DEST_META_FALLBACK = {
  goa: {
    tags: ["beach", "nature"],
    region: "West India",
    season: "Oct–Mar",
    highlight: "Beaches & Nightlife",
  },
  jaipur: {
    tags: ["heritage"],
    region: "Rajasthan",
    season: "Nov–Feb",
    highlight: "Pink City & Forts",
  },
  manali: {
    tags: ["mountain", "nature"],
    region: "Himachal",
    season: "Mar–Jun",
    highlight: "Snow & Adventure",
  },
  kerala: {
    tags: ["nature", "beach"],
    region: "South India",
    season: "Sep–Mar",
    highlight: "Backwaters & Spices",
  },
  varanasi: {
    tags: ["spiritual", "heritage"],
    region: "Uttar Pradesh",
    season: "Oct–Mar",
    highlight: "Ghats & Temples",
  },
  shimla: {
    tags: ["mountain"],
    region: "Himachal",
    season: "Mar–Jun",
    highlight: "Colonial Hill Town",
  },
  agra: {
    tags: ["heritage"],
    region: "Uttar Pradesh",
    season: "Oct–Mar",
    highlight: "Taj Mahal",
  },
  darjeeling: {
    tags: ["mountain", "nature"],
    region: "West Bengal",
    season: "Mar–May",
    highlight: "Tea Gardens & Trains",
  },
  udaipur: {
    tags: ["heritage"],
    region: "Rajasthan",
    season: "Sep–Mar",
    highlight: "City of Lakes",
  },
  rishikesh: {
    tags: ["spiritual", "nature"],
    region: "Uttarakhand",
    season: "Sep–Nov",
    highlight: "Yoga & Rafting",
  },
  munnar: {
    tags: ["nature", "mountain"],
    region: "Kerala",
    season: "Sep–Mar",
    highlight: "Tea Hills & Mist",
  },
  ooty: {
    tags: ["mountain", "nature"],
    region: "Tamil Nadu",
    season: "Apr–Jun",
    highlight: "Queen of Hills",
  },
  mysore: {
    tags: ["heritage"],
    region: "Karnataka",
    season: "Oct–Feb",
    highlight: "Palace & Silk",
  },
  andaman: {
    tags: ["beach", "nature"],
    region: "Bay of Bengal",
    season: "Nov–May",
    highlight: "Islands & Diving",
  },
  amritsar: {
    tags: ["spiritual", "heritage"],
    region: "Punjab",
    season: "Oct–Mar",
    highlight: "Golden Temple",
  },
  leh_ladakh: {
    tags: ["mountain", "nature"],
    region: "Ladakh",
    season: "Jun–Sep",
    highlight: "High Passes & Lakes",
  },
  coorg: {
    tags: ["nature"],
    region: "Karnataka",
    season: "Oct–Mar",
    highlight: "Coffee & Forests",
  },
  jaisalmer: {
    tags: ["heritage"],
    region: "Rajasthan",
    season: "Oct–Feb",
    highlight: "Desert & Forts",
  },
  alleppey: {
    tags: ["nature", "beach"],
    region: "Kerala",
    season: "Aug–Mar",
    highlight: "Houseboats",
  },
  pondicherry: {
    tags: ["beach", "heritage"],
    region: "South India",
    season: "Oct–Mar",
    highlight: "French Quarter",
  },
  mumbai: {
    tags: ["heritage", "beach"],
    region: "Maharashtra",
    season: "Nov–Feb",
    highlight: "Gateway & Bollywood",
  },
  delhi: {
    tags: ["heritage", "spiritual"],
    region: "North India",
    season: "Oct–Mar",
    highlight: "Mughal Monuments",
  },
};

function getDestMetaByKey(key) {
  return DEST_META[key] || DEST_META_FALLBACK[key] || {};
}
function getDestTags(key) {
  return getDestMetaByKey(key).tags || ["nature"];
}
function getDestRegion(key) {
  return getDestMetaByKey(key).region || "India";
}
function getDestSeason(key) {
  return getDestMetaByKey(key).season || "Oct–Mar";
}
function getDestHighlight(key) {
  return getDestMetaByKey(key).highlight || "Explore";
}
function destTagLabel(tag) {
  const labels = {
    beach: "Beach",
    mountain: "Mountain",
    heritage: "Heritage",
    spiritual: "Spiritual",
    nature: "Nature",
  };
  return labels[tag] || tag;
}

/** Initialize destination filter/search/sort/view controls */
function initDestControls() {
  // Filter buttons
  document.querySelectorAll(".dest-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".dest-filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterDestinations();
    });
  });

  // Debounced search with Esc to clear
  let destSearchTimer = null;
  const searchInput = document.getElementById("destSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(destSearchTimer);
      destSearchTimer = setTimeout(() => filterDestinations(), 180);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        searchInput.value = "";
        searchInput.blur();
        filterDestinations();
      }
    });
  }

  // Sort
  const sortSel = document.getElementById("destSortSelect");
  if (sortSel) {
    sortSel.addEventListener("change", () => sortDestinations());
  }

  // View toggle
  document.querySelectorAll(".dest-view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".dest-view-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const gallery = document.getElementById("destGallery");
      if (gallery) {
        gallery.classList.remove("dest-view-grid", "dest-view-list");
        gallery.classList.add("dest-view-" + btn.dataset.view);
      }
    });
  });

  // Apply default sort (Trending)
  sortDestinations();
}

function filterDestinations() {
  const activeFilter = document.querySelector(".dest-filter-btn.active");
  const filter = activeFilter ? activeFilter.dataset.filter : "all";
  const searchVal = (document.getElementById("destSearchInput")?.value || "")
    .toLowerCase()
    .trim();
  const cards = document.querySelectorAll(".dest-card");
  let visibleCount = 0;

  cards.forEach((card) => {
    const tags = card.dataset.destTags || "";
    const name = card.dataset.destName || "";
    const region = card.dataset.destRegion || "";
    const matchFilter = filter === "all" || tags.includes(filter);
    const matchSearch =
      !searchVal ||
      name.includes(searchVal) ||
      region.includes(searchVal) ||
      tags.includes(searchVal);
    const show = matchFilter && matchSearch;
    card.style.display = show ? "" : "none";
    if (show) {
      visibleCount++;
      card.style.animation = "none";
      card.offsetHeight;
      card.style.animation = "destCardIn 0.4s ease both";
      card.style.animationDelay = Math.min(visibleCount, 12) * 0.05 + "s";
    }
  });

  const noResults = document.getElementById("destNoResults");
  const noResultsQuery = document.getElementById("destNoResultsQuery");
  const countEl = document.getElementById("destCount");
  if (noResults) noResults.style.display = visibleCount === 0 ? "" : "none";
  if (noResultsQuery && searchVal) noResultsQuery.textContent = searchVal;
  if (countEl)
    countEl.textContent = `${visibleCount} destination${visibleCount !== 1 ? "s" : ""}`;
}

function sortDestinations() {
  const gallery = document.getElementById("destGallery");
  if (!gallery) return;
  const sortVal = document.getElementById("destSortSelect")?.value || "name";
  const cards = Array.from(gallery.querySelectorAll(".dest-card"));

  const popularOrder = [
    "goa",
    "jaipur",
    "manali",
    "kerala",
    "varanasi",
    "delhi",
    "mumbai",
    "shimla",
    "udaipur",
    "rishikesh",
    "agra",
    "darjeeling",
    "leh_ladakh",
    "andaman",
    "munnar",
    "jaisalmer",
    "mysore",
    "ooty",
    "amritsar",
    "coorg",
    "alleppey",
    "pondicherry",
  ];

  cards.sort((a, b) => {
    const aName = a.dataset.destName || "";
    const bName = b.dataset.destName || "";
    const aKey = a.dataset.destKey || "";
    const bKey = b.dataset.destKey || "";
    if (sortVal === "name") return aName.localeCompare(bName);
    if (sortVal === "name-desc") return bName.localeCompare(aName);
    if (sortVal === "popular") {
      const ai = popularOrder.indexOf(aKey);
      const bi = popularOrder.indexOf(bKey);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
    return 0;
  });

  cards.forEach((card, i) => {
    card.style.order = i;
    gallery.appendChild(card);
  });
}

/** Scroll to budget section and preselect destination */
function scrollToBudget(dest) {
  scrollToSection("budget");
  setTimeout(() => {
    const el = document.getElementById("budgetDest");
    if (el) el.value = dest;
  }, 400);
}

/** Scroll to safety section and preselect destination */
function scrollToSafety(dest) {
  scrollToSection("safety");
  setTimeout(() => {
    const el = document.getElementById("safetyDest");
    if (el) el.value = dest;
  }, 400);
}

/** Scroll to weather section and preselect destination */
function scrollToWeather(dest) {
  scrollToSection("weather");
  setTimeout(() => {
    const el = document.getElementById("weatherDest");
    if (el) el.value = dest;
  }, 400);
}

/** Open multiple photos for a destination — premium modal */
async function openDestPhotos(destKey) {
  const overlay = document.createElement("div");
  overlay.className = "dest-photos-overlay";
  const name = destLabel(destKey);
  const tags = getDestTags(destKey);
  const tagHtml = tags
    .map(
      (t) => `<span class="dest-tag dest-tag-${t}">${destTagLabel(t)}</span>`,
    )
    .join("");

  overlay.innerHTML = `
    <div class="dest-photos-modal">
      <div class="dest-photos-header">
        <div class="dest-photos-title-row">
          <h3>${name}</h3>
          <div class="dest-photos-tags">${tagHtml}</div>
        </div>
        <button class="dest-photos-close" data-action="close-dest-photos"><i class="fas fa-times"></i></button>
      </div>
      <div class="dest-photos-grid" id="destPhotosGrid">
        <div class="dest-photos-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading photos…</div>
      </div>
    </div>
  `;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("active"));

  // ESC to close
  const esc = (e) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", esc);
    }
  };
  document.addEventListener("keydown", esc);

  try {
    const resp = await fetch(`${API_BASE}/api/images/destination/${destKey}`);
    const data = await resp.json();
    const photos = data.images || [];
    const grid = overlay.querySelector("#destPhotosGrid");

    if (!photos.length) {
      grid.innerHTML = `<div class="dest-photos-empty"><i class="fas fa-image"></i><p>No photos available yet</p></div>`;
      return;
    }

    grid.innerHTML = photos
      .map(
        (p, i) => `
      <div class="dest-photo-item" style="animation-delay:${i * 0.08}s" data-action="open-lightbox" data-url="${p.url_regular}" data-alt="${(p.alt || "").replace(/"/g, "&quot;")}" data-photographer="${p.photographer}" data-photographer-url="${p.photographer_url}" data-stop-propagation>
        <div class="dest-photo-img-wrap" style="background-color:${p.color || "#1e293b"}">
          <img src="${p.url_thumb || p.url_small}" data-src="${p.url_small}" alt="${p.alt || name}" loading="lazy" class="dest-img-blur" data-progressive-load />
        </div>
        <div class="dest-photo-info">
          <span class="dest-photo-alt">${p.alt || name}</span>
          <a href="${p.photographer_url}" target="_blank" rel="noopener" class="dest-photo-credit" data-stop-propagation>📷 ${p.photographer}</a>
        </div>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    console.error("Photo gallery error:", err);
    const grid = overlay.querySelector("#destPhotosGrid");
    grid.innerHTML = `<div class="dest-photos-empty"><i class="fas fa-exclamation-triangle"></i><p>Failed to load photos</p></div>`;
  }
}

/** Open a single image in a lightbox */
function openLightbox(url, alt, photographer, photographerUrl) {
  const existing = document.querySelector(".img-lightbox");
  if (existing) existing.remove();

  const lb = document.createElement("div");
  lb.className = "img-lightbox";
  lb.innerHTML = `
    <img src="${url}" alt="${alt}" />
    <div class="img-lightbox-info">
      ${alt ? `<p>${alt}</p>` : ""}
      <p>📷 Photo by <a href="${photographerUrl}" target="_blank" rel="noopener">${photographer}</a> on <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a></p>
    </div>
  `;
  lb.addEventListener("click", (e) => {
    if (e.target === lb) lb.remove();
  });
  document.body.appendChild(lb);

  // Close on Escape key
  const closeOnEsc = (e) => {
    if (e.key === "Escape") {
      lb.remove();
      document.removeEventListener("keydown", closeOnEsc);
    }
  };
  document.addEventListener("keydown", closeOnEsc);
}

// ═══════════════════════════════════════════════════════════
// LIVE LOCATION TRACKING & SMART SUGGESTIONS
// ═══════════════════════════════════════════════════════════
let liveLocMarker = null;
let liveLocAccuracy = null; // circle layer
let watchId = null;
let isTracking = false;
let lastSuggestLat = null;
let lastSuggestLon = null;

// ── Start / stop live tracking ───────────────────────────
document.getElementById("liveLocBtn").addEventListener("click", () => {
  if (isTracking) {
    stopTracking();
  } else {
    startTracking();
  }
});

function startTracking() {
  if (!navigator.geolocation) {
    showToast("Geolocation is not supported by your browser.", "warning");
    return;
  }

  const btn = document.getElementById("liveLocBtn");
  const status = document.getElementById("locStatus");
  btn.classList.add("active");
  status.style.display = "flex";
  document.getElementById("locText").textContent = "Locating…";
  isTracking = true;

  // Ensure map is initialized
  if (!ttMap) initMap();

  // High-accuracy watch
  watchId = navigator.geolocation.watchPosition(
    onPositionUpdate,
    onPositionError,
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  );
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  isTracking = false;

  const btn = document.getElementById("liveLocBtn");
  const status = document.getElementById("locStatus");
  btn.classList.remove("active");
  status.style.display = "none";

  // Remove live marker
  if (liveLocMarker) {
    liveLocMarker.remove();
    liveLocMarker = null;
  }

  // Remove accuracy circle
  if (ttMap && ttMap.getLayer("accuracy-circle")) {
    ttMap.removeLayer("accuracy-circle");
    ttMap.removeSource("accuracy-circle");
    liveLocAccuracy = null;
  }

  // Hide suggestions
  document.getElementById("suggestionsPanel").style.display = "none";
  lastSuggestLat = null;
  lastSuggestLon = null;
}

function onPositionUpdate(pos) {
  const { latitude: lat, longitude: lon, accuracy } = pos.coords;

  document.getElementById("locText").textContent =
    `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;

  if (!ttMap) return;

  // Fly to location on first fix
  if (!liveLocMarker) {
    ttMap.flyTo({ center: [lon, lat], zoom: 13, speed: 1.5 });
  }

  // Update / create blue dot marker
  updateLiveMarker(lat, lon);

  // Update accuracy circle
  updateAccuracyCircle(lat, lon, accuracy);

  // Fetch suggestions if moved > 500m from last suggestion point
  if (shouldFetchSuggestions(lat, lon)) {
    fetchSuggestions(lat, lon);
  }
}

function onPositionError(err) {
  console.error("Geolocation error:", err);
  document.getElementById("locText").textContent =
    err.code === 1
      ? "Permission denied"
      : err.code === 2
        ? "Position unavailable"
        : "Timeout – retrying…";
}

// ── Live marker (pulsing blue dot) ───────────────────────
function updateLiveMarker(lat, lon) {
  if (liveLocMarker) {
    liveLocMarker.setLngLat([lon, lat]);
  } else {
    const el = document.createElement("div");
    el.className = "live-marker";
    el.innerHTML =
      '<div class="live-marker-dot"></div><div class="live-marker-pulse"></div>';

    liveLocMarker = new tt.Marker({ element: el })
      .setLngLat([lon, lat])
      .setPopup(
        new tt.Popup({ offset: 20 }).setHTML(
          '<div style="padding:6px 10px;font-family:Poppins,sans-serif;"><strong>You are here</strong></div>',
        ),
      )
      .addTo(ttMap);
  }
}

// ── Accuracy circle ──────────────────────────────────────
function updateAccuracyCircle(lat, lon, accuracyM) {
  // Create a GeoJSON circle approximation
  const points = 64;
  const coords = [];
  const km = (accuracyM || 50) / 1000;

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = km * Math.cos(angle);
    const dy = km * Math.sin(angle);
    coords.push([
      lon + dx / (111.32 * Math.cos(lat * (Math.PI / 180))),
      lat + dy / 110.574,
    ]);
  }
  coords.push(coords[0]); // close the ring

  const geojson = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
  };

  if (ttMap.getSource("accuracy-circle")) {
    ttMap.getSource("accuracy-circle").setData(geojson);
  } else {
    ttMap.addSource("accuracy-circle", { type: "geojson", data: geojson });
    ttMap.addLayer({
      id: "accuracy-circle",
      type: "fill",
      source: "accuracy-circle",
      paint: {
        "fill-color": "#4A90D9",
        "fill-opacity": 0.15,
      },
    });
  }
}

// ── Should we fetch new suggestions? (moved > 500m) ─────
function shouldFetchSuggestions(lat, lon) {
  if (lastSuggestLat === null) return true;
  const dlat = lat - lastSuggestLat;
  const dlon = lon - lastSuggestLon;
  const distKm = Math.sqrt(dlat * dlat + dlon * dlon) * 111;
  return distKm > 0.5; // 500m threshold
}

// ── Fetch smart suggestions from API ─────────────────────
async function fetchSuggestions(lat, lon) {
  lastSuggestLat = lat;
  lastSuggestLon = lon;

  const panel = document.getElementById("suggestionsPanel");
  const content = document.getElementById("suggestionsContent");
  const addrEl = document.getElementById("suggestAddr");

  panel.style.display = "block";
  content.innerHTML =
    '<div class="suggestions-loading"><i class="fas fa-spinner fa-spin"></i> Finding places near you…</div>';

  try {
    const res = await fetch(
      `${API_BASE}/api/maps/suggest?lat=${lat}&lon=${lon}&limit=5`,
    );
    const data = await res.json();

    if (!res.ok) {
      content.innerHTML = `<p class="suggest-error"><i class="fas fa-exclamation-circle"></i> ${data.error}</p>`;
      return;
    }

    // Show address
    if (data.location && data.location.address) {
      addrEl.textContent = data.location.address;
    } else {
      addrEl.textContent = `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
    }

    // Show nearest destination badge
    const badge = document.getElementById("nearestDestBadge");
    if (data.nearest_destination) {
      const nd = data.nearest_destination;
      document.getElementById("nearestDestText").textContent =
        `${nd.label} (${nd.distance_km} km away)`;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }

    // Render suggestion categories
    if (!data.suggestions || data.suggestions.length === 0) {
      content.innerHTML = `
                <div class="suggest-empty">
                    <i class="fas fa-map-signs"></i>
                    <p>No notable places found nearby. Try moving to a different area.</p>
                </div>`;
      return;
    }

    content.innerHTML = data.suggestions
      .map(
        (cat) => `
            <div class="suggest-category">
                <div class="suggest-cat-header">
                    <i class="${cat.icon}"></i>
                    <span>${cat.label}</span>
                    <span class="suggest-cat-count">${cat.count} found</span>
                </div>
                <div class="suggest-cat-pois">
                    ${cat.pois
                      .map(
                        (poi) => `
                        <div class="suggest-poi-card">
                            <div class="suggest-poi-info">
                                <h5>${poi.name}</h5>
                                <p>${poi.address || "No address"}</p>
                                <span class="suggest-poi-dist">
                                    <i class="fas fa-walking"></i>
                                    ${(poi.distance_m / 1000).toFixed(1)} km
                                </span>
                            </div>
                            ${
                              poi.lat && poi.lon
                                ? `
                                <button class="suggest-poi-btn" data-action="fly-to-poi" data-lat="${poi.lat}" data-lon="${poi.lon}" title="Show on map">
                                    <i class="fas fa-location-arrow"></i>
                                </button>
                            `
                                : ""
                            }
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `,
      )
      .join("");

    // Also add suggestion POIs as markers on the map
    clearPOIMarkers();
    let idx = 0;
    data.suggestions.forEach((cat) => {
      cat.pois.forEach((poi) => {
        if (!poi.lat || !poi.lon) return;
        idx++;
        const el = document.createElement("div");
        el.className = "custom-marker poi-marker";
        el.innerHTML = `<span>${idx}</span>`;
        el.title = poi.name;

        const popup = new tt.Popup({ offset: 16 }).setHTML(
          `<div style="padding:6px 10px;font-family:Poppins,sans-serif;max-width:200px;">
                        <strong style="font-size:0.85rem;">${poi.name}</strong><br>
                        <span style="font-size:0.72rem;color:#666;">${poi.category}</span><br>
                        <span style="font-size:0.72rem;color:#888;">${poi.address}</span>
                    </div>`,
        );

        const marker = new tt.Marker({ element: el })
          .setLngLat([poi.lon, poi.lat])
          .setPopup(popup)
          .addTo(ttMap);
        mapMarkers.push(marker);
      });
    });
  } catch (err) {
    console.error("Suggestions fetch error:", err);
    content.innerHTML =
      '<p class="suggest-error"><i class="fas fa-exclamation-circle"></i> Network error – could not fetch suggestions.</p>';
  }
}

// ═══════════════════════════════════════════════════════════
// FOURSQUARE PLACES EXPLORER
// ═══════════════════════════════════════════════════════════

/** Populate the Places destination dropdown once DEST_COORDS is ready */
function populatePlacesDropdown() {
  const sel = document.getElementById("placesDest");
  if (!sel || !Object.keys(DEST_COORDS).length) return;
  sel.innerHTML = '<option value="">Select destination…</option>';
  Object.entries(DEST_COORDS)
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .forEach(([key, d]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = d.label;
      sel.appendChild(opt);
    });
}

/** Price tier to dollar signs */
function priceTierLabel(tier) {
  if (!tier || tier < 1) return "";
  return "$".repeat(tier);
}

/** Rating score badge colour */
function ratingColor(score) {
  if (score >= 8) return "#10b981";
  if (score >= 6) return "#f59e0b";
  if (score >= 4) return "#f97316";
  return "#ef4444";
}

/** Format distance */
function fmtDistance(m) {
  if (m == null) return "";
  return m >= 1000 ? (m / 1000).toFixed(1) + " km" : m + " m";
}

// ── Search places ────────────────────────────────────────
const placesSearchBtn = document.getElementById("placesSearchBtn");
if (placesSearchBtn) {
  placesSearchBtn.addEventListener("click", async () => {
    const dest = document.getElementById("placesDest").value;
    const cat = document.getElementById("placesCat").value;
    const query = document.getElementById("placesQuery").value.trim();
    const grid = document.getElementById("placesResults");

    if (!dest) {
      showToast("Please select a destination first.", "warning");
      return;
    }

    const coords = DEST_COORDS[dest];
    if (!coords) return;

    grid.style.display = "grid";
    grid.innerHTML =
      '<div class="places-loading"><i class="fas fa-spinner fa-spin"></i> Searching places…</div>';

    try {
      let url = `${API_BASE}/api/places/search?lat=${coords.lat}&lon=${coords.lon}&limit=12`;
      if (cat) url += `&category=${encodeURIComponent(cat)}`;
      if (query) url += `&query=${encodeURIComponent(query)}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Search failed");

      if (!data.places || data.places.length === 0) {
        grid.innerHTML = `
          <div class="places-empty">
            <i class="fas fa-map-marked-alt"></i>
            <p>No places found. Try a different category or destination.</p>
          </div>`;
        return;
      }

      renderPlaceCards(data.places, grid);
    } catch (err) {
      console.error("Places search error:", err);
      grid.innerHTML = `
        <div class="places-empty">
          <i class="fas fa-exclamation-triangle"></i>
          <p>${err.message || "Could not search places. Please try again."}</p>
        </div>`;
    }
  });
}

/** Render place cards into grid */
function renderPlaceCards(places, grid) {
  grid.innerHTML = places
    .map(
      (p) => `
    <div class="place-card" data-action="open-place-detail" data-fsq-id="${p.fsq_id}">
      <div class="place-card-header">
        <div class="place-card-name">
          ${p.name}
          ${p.verified ? '<i class="fas fa-check-circle verified-badge" title="Verified"></i>' : ""}
        </div>
        <div class="place-card-cats">${(p.categories || [p.category]).join(" · ")}</div>
        <div class="place-card-stats">
          ${p.rating ? `<span class="place-stat rating"><i class="fas fa-star"></i> <strong style="color:${ratingColor(p.rating)}">${p.rating.toFixed(1)}</strong>/10</span>` : ""}
          ${p.price_tier ? `<span class="place-stat price">${priceTierLabel(p.price_tier)}</span>` : ""}
          ${p.distance_m != null ? `<span class="place-stat distance"><i class="fas fa-route"></i> ${fmtDistance(p.distance_m)}</span>` : ""}
          ${p.is_open !== null && p.is_open !== undefined ? `<span class="place-stat open-status ${p.is_open ? "is-open" : "is-closed"}">${p.is_open ? "Open" : "Closed"}</span>` : ""}
        </div>
      </div>
      <div class="place-card-address">
        <i class="fas fa-map-marker-alt" style="color:var(--primary);margin-right:4px;"></i>
        ${p.address || "Address not available"}${p.locality ? ", " + p.locality : ""}
      </div>
      <div class="place-card-footer">
        <button class="place-card-btn" data-action="open-place-detail" data-fsq-id="${p.fsq_id}" data-stop-propagation>
          <i class="fas fa-info-circle"></i> Details
        </button>
        ${p.website ? `<a class="place-card-btn" href="${p.website}" target="_blank" rel="noopener" data-stop-propagation><i class="fas fa-globe"></i> Website</a>` : ""}
        ${p.phone ? `<a class="place-card-btn" href="tel:${p.phone}" data-stop-propagation><i class="fas fa-phone"></i> Call</a>` : ""}
        ${p.lat && p.lon ? `<button class="place-card-btn" data-action="fly-to-poi" data-lat="${p.lat}" data-lon="${p.lon}" data-stop-propagation><i class="fas fa-location-arrow"></i> Map</button>` : ""}
      </div>
    </div>
  `,
    )
    .join("");
}

// ── Place Detail Modal ───────────────────────────────────
async function openPlaceDetail(fsqId) {
  const overlay = document.getElementById("placeModal");
  const content = document.getElementById("placeModalContent");
  if (!overlay || !content) return;

  overlay.style.display = "flex";
  content.innerHTML =
    '<div class="places-loading"><i class="fas fa-spinner fa-spin"></i> Loading place details…</div>';

  try {
    const res = await fetch(`${API_BASE}/api/places/detail/${fsqId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load details");

    const p = data.place;
    const cats = (p.categories || [p.category]).join(" · ");

    let html = `<div class="place-modal-card">`;

    // Close button
    html += `<button style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted);" data-action="close-place-modal">
      <i class="fas fa-times"></i>
    </button>`;

    // Header
    html += `<div class="place-detail-header">
      <h2>${p.name} ${p.verified ? '<i class="fas fa-check-circle" style="color:var(--primary);font-size:0.9rem;"></i>' : ""}</h2>
      <div class="place-detail-cats">${cats}</div>
    </div>`;

    // Stats row
    html += `<div class="place-detail-stats">`;
    if (p.rating)
      html += `<span class="place-stat rating"><i class="fas fa-star"></i> <strong style="color:${ratingColor(p.rating)}">${p.rating.toFixed(1)}</strong>/10</span>`;
    if (p.price_tier)
      html += `<span class="place-stat price">${priceTierLabel(p.price_tier)}</span>`;
    if (p.popularity != null)
      html += `<span class="place-stat distance"><i class="fas fa-fire"></i> ${(p.popularity * 100).toFixed(0)}% popular</span>`;
    if (p.is_open !== null && p.is_open !== undefined)
      html += `<span class="place-stat open-status ${p.is_open ? "is-open" : "is-closed"}">${p.is_open ? "Open Now" : "Closed"}</span>`;
    html += `</div>`;

    // Description
    if (p.description) {
      html += `<div class="place-detail-section">
        <h3><i class="fas fa-align-left"></i> About</h3>
        <p style="font-size:0.88rem;color:var(--text-dark);line-height:1.6;">${p.description}</p>
      </div>`;
    }

    // Info rows
    html += `<div class="place-detail-section">
      <h3><i class="fas fa-info-circle"></i> Info</h3>`;
    if (p.address)
      html += `<div class="place-info-row"><i class="fas fa-map-marker-alt"></i> ${p.address}${p.locality ? ", " + p.locality : ""}${p.region ? ", " + p.region : ""}</div>`;
    if (p.phone)
      html += `<div class="place-info-row"><i class="fas fa-phone"></i> <a href="tel:${p.phone}">${p.phone}</a></div>`;
    if (p.website)
      html += `<div class="place-info-row"><i class="fas fa-globe"></i> <a href="${p.website}" target="_blank" rel="noopener">${p.website}</a></div>`;
    if (p.hours_display)
      html += `<div class="place-info-row"><i class="fas fa-clock"></i> ${p.hours_display}</div>`;
    if (p.menu_url)
      html += `<div class="place-info-row"><i class="fas fa-utensils"></i> <a href="${p.menu_url}" target="_blank" rel="noopener">View Menu</a></div>`;
    html += `</div>`;

    // Photos
    if (p.photos && p.photos.length) {
      html += `<div class="place-detail-section">
        <h3><i class="fas fa-camera"></i> Photos (${p.total_photos || p.photos.length})</h3>
        <div class="place-photos-grid">
          ${p.photos.map((ph) => `<img src="${ph.url_medium}" alt="Place photo" data-action="open-lightbox" data-url="${ph.url}" data-alt="" data-photographer="" data-photographer-url="" />`).join("")}
        </div>
      </div>`;
    }

    // Tips
    if (p.tips && p.tips.length) {
      html += `<div class="place-detail-section">
        <h3><i class="fas fa-comment-alt"></i> Tips (${p.total_tips || p.tips.length})</h3>
        ${p.tips
          .map(
            (t) => `
          <div class="place-tip">
            <p>${t.text}</p>
            <div class="tip-meta">
              ${t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}
              ${t.agree_count ? ` · 👍 ${t.agree_count}` : ""}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>`;
    }

    // Tastes
    if (p.tastes && p.tastes.length) {
      html += `<div class="place-detail-section">
        <h3><i class="fas fa-utensils"></i> Known for</h3>
        <div class="place-features-list">
          ${p.tastes.map((t) => `<span class="place-feature-tag">${t}</span>`).join("")}
        </div>
      </div>`;
    }

    // Features
    if (p.features && p.features.length) {
      html += `<div class="place-detail-section">
        <h3><i class="fas fa-check-double"></i> Features</h3>
        <div class="place-features-list">
          ${p.features.map((f) => `<span class="place-feature-tag">${f}</span>`).join("")}
        </div>
      </div>`;
    }

    // Map button
    if (p.lat && p.lon) {
      html += `<div style="margin-top:16px;text-align:center;">
        <button class="place-card-btn" data-action="close-and-fly" data-lat="${p.lat}" data-lon="${p.lon}" style="padding:10px 24px;font-size:0.85rem;">
          <i class="fas fa-map-marked-alt"></i> Show on Map
        </button>
      </div>`;
    }

    html += `</div>`;
    content.innerHTML = html;
  } catch (err) {
    console.error("Place detail error:", err);
    content.innerHTML = `
      <div class="place-modal-card" style="text-align:center;padding:48px;">
        <i class="fas fa-exclamation-circle" style="font-size:2rem;color:var(--danger);margin-bottom:12px;"></i>
        <p>${err.message || "Could not load place details."}</p>
        <button class="place-card-btn" data-action="close-place-modal" style="margin-top:16px;">Close</button>
      </div>`;
  }
}

function closePlaceModal() {
  const overlay = document.getElementById("placeModal");
  if (overlay) overlay.style.display = "none";
}

// Close modal on overlay click
const placeModal = document.getElementById("placeModal");
if (placeModal) {
  placeModal.addEventListener("click", (e) => {
    if (e.target === placeModal) closePlaceModal();
  });
}

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePlaceModal();
});

/* ═══════════════════════════════════════════════════════════
   TRAVEL NEWS
   ═══════════════════════════════════════════════════════════ */
(function () {
  const destSel = document.getElementById("newsDest");
  const catSel = document.getElementById("newsCat");
  const searchBtn = document.getElementById("newsSearchBtn");
  const grid = document.getElementById("newsResults");
  if (!destSel || !grid) return;

  let currentTab = "latest";

  /* ── Populate destination dropdown ─── */
  async function loadNewsDests() {
    try {
      const r = await fetch("/api/news/destinations");
      if (!r.ok) return;
      const d = await r.json();
      (d.destinations || []).forEach((name) => {
        const o = document.createElement("option");
        o.value = name;
        o.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        destSel.appendChild(o);
      });
    } catch (_) {}
  }

  /* ── Render article cards ─── */
  function renderCards(articles) {
    grid.style.display = "grid";
    if (!articles || articles.length === 0) {
      grid.innerHTML =
        '<div class="news-empty"><i class="fas fa-newspaper"></i><p>No news articles found. Try a different destination or category.</p></div>';
      return;
    }
    grid.innerHTML = articles
      .map(
        (a) => `
      <article class="news-card">
        ${
          a.image_url
            ? `<img src="${a.image_url}" alt="" class="news-card-img" loading="lazy"
                 data-img-fallback>`
            : '<div class="news-card-img placeholder"><i class="fas fa-newspaper"></i></div>'
        }
        <div class="news-card-body">
          <div class="news-card-meta">
            <span class="news-card-source">${a.source || "Unknown"}</span>
            <span class="news-card-date">${formatNewsDate(a.published_at)}</span>
          </div>
          <h3 class="news-card-title">${escapeHTML(a.title || "Untitled")}</h3>
          <p class="news-card-desc">${escapeHTML(a.description || "")}</p>
          <a href="${a.url}" target="_blank" rel="noopener" class="news-card-link">
            Read More <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      </article>`,
      )
      .join("");
  }

  // escapeHTML — now uses global escapeHtml defined at top of file

  function formatNewsDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function showLoading() {
    grid.style.display = "grid";
    grid.innerHTML =
      '<div class="news-loading"><i class="fas fa-spinner"></i><p>Fetching news...</p></div>';
  }

  /* ── Fetch by tab type ─── */
  async function fetchNews() {
    showLoading();
    const dest = destSel.value;
    const cat = catSel.value;
    let url;
    if (currentTab === "trending") {
      url = "/api/news/trending?limit=9";
    } else if (currentTab === "safety") {
      url = `/api/news/safety?limit=9${dest ? "&destination=" + encodeURIComponent(dest) : ""}`;
    } else {
      url = `/api/news/travel?limit=9${dest ? "&destination=" + encodeURIComponent(dest) : ""}&category=${encodeURIComponent(cat)}`;
    }
    try {
      const r = await fetch(url);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        grid.style.display = "grid";
        grid.innerHTML = `<div class="news-empty"><i class="fas fa-exclamation-triangle"></i><p>${e.error || "Failed to fetch news"}</p></div>`;
        return;
      }
      const data = await r.json();
      renderCards(data.articles || []);
    } catch (err) {
      grid.style.display = "grid";
      grid.innerHTML =
        '<div class="news-empty"><i class="fas fa-exclamation-triangle"></i><p>Network error. Please try again.</p></div>';
    }
  }

  /* ── Tab switching ─── */
  document.querySelectorAll(".news-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".news-tab")
        .forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      currentTab = btn.dataset.tab;
      fetchNews();
    });
  });

  /* ── Search button ─── */
  searchBtn.addEventListener("click", () => {
    currentTab = "latest";
    document
      .querySelectorAll(".news-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelector('.news-tab[data-tab="latest"]')
      .classList.add("active");
    fetchNews();
  });

  /* ── Auto-load on scroll into view ─── */
  let newsLoaded = false;
  const newsSection = document.getElementById("news");
  if (newsSection && "IntersectionObserver" in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !newsLoaded) {
          newsLoaded = true;
          fetchNews();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(newsSection);
  }

  loadNewsDests();
})();

// ═══════════════════════════════════════════════════════════
// CURSOR GLOW – subtle glow follows mouse on desktop
// ═══════════════════════════════════════════════════════════
function initCursorGlow() {
  const glow = document.getElementById("cursorGlow");
  if (!glow || window.innerWidth <= 640) return;

  let mx = 0,
    my = 0,
    cx = 0,
    cy = 0;
  let active = false;

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (!active) {
      active = true;
      glow.classList.add("active");
      rafLoop();
    }
  });

  document.addEventListener("mouseleave", () => {
    active = false;
    glow.classList.remove("active");
  });

  function rafLoop() {
    if (!active) return;
    cx += (mx - cx) * 0.12;
    cy += (my - cy) * 0.12;
    glow.style.left = cx + "px";
    glow.style.top = cy + "px";
    requestAnimationFrame(rafLoop);
  }
}

// ═══════════════════════════════════════════════════════════
// STAGGER REVEAL – cards animate in sequentially
// ═══════════════════════════════════════════════════════════
function initStaggerReveal() {
  const items = document.querySelectorAll("[data-stagger]");
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Find all siblings in the same parent
          const parent = entry.target.parentElement;
          const siblings = parent.querySelectorAll("[data-stagger]");
          siblings.forEach((el, i) => {
            setTimeout(() => {
              el.classList.add("stagger-visible");
            }, i * 120);
          });
          // Unobserve all siblings
          siblings.forEach((el) => observer.unobserve(el));
        }
      });
    },
    { threshold: 0.15 },
  );

  items.forEach((el) => observer.observe(el));
}

// ═══════════════════════════════════════════════════════════
// 3D TILT – cards tilt towards mouse cursor
// ═══════════════════════════════════════════════════════════
function initTiltCards() {
  const cards = document.querySelectorAll("[data-tilt]");
  if (!cards.length || window.innerWidth <= 640) return;

  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

// ═══════════════════════════════════════════════════════════
// MAGNETIC BUTTONS – slight pull towards mouse
// ═══════════════════════════════════════════════════════════
function initMagneticButtons() {
  const btns = document.querySelectorAll(".btn-magnetic");
  if (!btns.length || window.innerWidth <= 640) return;

  btns.forEach((btn) => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      btn.style.transform = `translate(${dx * 0.15}px, ${dy * 0.15}px)`;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "";
    });
  });
}

// ═══════════════════════════════════════════════════════════
// HERO PARALLAX – subtle content shift on mouse move
// ═══════════════════════════════════════════════════════════
function initHeroParallax() {
  const heroContent = document.getElementById("heroContent");
  const hero = document.getElementById("hero");
  if (!heroContent || !hero || window.innerWidth <= 640) return;

  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    heroContent.style.transform = `translate(${x * -6}px, ${y * -4}px)`;
  });
  hero.addEventListener("mouseleave", () => {
    heroContent.style.transform = "";
  });
}

// ═══════════════════════════════════════════════════════════
// HERO SCROLL INDICATOR – click scrolls down, hide on scroll
// ═══════════════════════════════════════════════════════════
function initHeroScrollIndicator() {
  const indicator = document.getElementById("heroScrollIndicator");
  if (!indicator) return;

  indicator.addEventListener("click", () => {
    const features = document.getElementById("features");
    if (features) features.scrollIntoView({ behavior: "smooth" });
  });

  window.addEventListener("scroll", () => {
    if (window.scrollY > 200) {
      indicator.style.opacity = "0";
      indicator.style.pointerEvents = "none";
    } else {
      indicator.style.opacity = "";
      indicator.style.pointerEvents = "";
    }
  });
}

// ═══════════════════════════════════════════════════════════
// HERO SLIDESHOW – crossfade background + place name cycle
// ═══════════════════════════════════════════════════════════
function initHeroSlideshow() {
  const slides = document.querySelectorAll(".hero-bg-slide");
  const dots = document.querySelectorAll(".hero-dot");
  const place = document.getElementById("heroPlace");
  if (!slides.length) return;

  const names = ["Agra", "Kerala", "Jaipur", "Udaipur"];
  let cur = 0;
  let interval;

  function goTo(idx) {
    slides[cur].classList.remove("active");
    dots[cur] && dots[cur].classList.remove("active");
    cur = idx % slides.length;
    slides[cur].classList.add("active");
    dots[cur] && dots[cur].classList.add("active");
    // Animate place name swap
    if (place) {
      place.classList.add("swapping");
      setTimeout(() => {
        place.textContent = names[cur] || "India";
        place.classList.remove("swapping");
      }, 350);
    }
  }

  function next() {
    goTo(cur + 1);
  }

  function startAuto() {
    interval = setInterval(next, 5500);
  }
  function resetAuto() {
    clearInterval(interval);
    startAuto();
  }

  dots.forEach((d, i) =>
    d.addEventListener("click", () => {
      goTo(i);
      resetAuto();
    }),
  );

  // Activate first slide
  slides[0].classList.add("active");
  dots[0] && dots[0].classList.add("active");
  startAuto();

  // Safety: ensure hero content becomes visible after animations
  const heroCenter = document.getElementById("heroContent");
  if (heroCenter) {
    setTimeout(() => heroCenter.classList.add("loaded"), 1200);
  }
}

// ═══════════════════════════════════════════════════════════
// HERO SEARCH – glassmorphism search bar → Smart Hub
// ═══════════════════════════════════════════════════════════
function initHeroSearch() {
  const input = document.getElementById("heroSearchInput");
  const btn = document.getElementById("heroSearchBtn");
  const tags = document.querySelectorAll(".hero-tag");
  if (!input) return;

  function doSearch(query) {
    query = (query || "").trim();
    if (!query) return;
    // Try Smart Hub first
    if (typeof openSmartHub === "function") {
      openSmartHub();
      const hubInput = document.getElementById("smartHubInput");
      if (hubInput) {
        hubInput.value = query;
        hubInput.dispatchEvent(new Event("input"));
      }
      if (typeof smartHubExplore === "function") smartHubExplore(query);
    } else {
      // Fallback: scroll to destination section or chatbot
      const destSection = document.getElementById("destinations");
      if (destSection) destSection.scrollIntoView({ behavior: "smooth" });
    }
  }

  btn && btn.addEventListener("click", () => doSearch(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch(input.value);
    }
  });
  tags.forEach((tag) => {
    tag.addEventListener("click", () => {
      const dest = tag.dataset.dest || tag.textContent.trim();
      input.value = dest;
      doSearch(dest);
    });
  });
}

// ═══════════════════════════════════════════════════════════
// HERO SPLIT TEXT – per-character entrance animation
// ═══════════════════════════════════════════════════════════
function initHeroSplitText() {
  const els = document.querySelectorAll("[data-split-text]");
  if (!els.length) return;

  els.forEach((el) => {
    const text = el.textContent;
    el.innerHTML = "";
    el.setAttribute("aria-label", text);
    const isGradient = el.classList.contains("hero-title-gradient");
    const baseDelay = el.closest("[data-stagger]")
      ? parseFloat(el.closest("[data-stagger]").dataset.stagger) * 0.25 + 0.2
      : 0.5;

    text.split("").forEach((char, i) => {
      const span = document.createElement("span");
      span.className = "split-char";
      span.textContent = char === " " ? "\u00A0" : char;
      span.style.animationDelay = `${baseDelay + i * 0.04}s`;
      if (isGradient) {
        span.style.background = "inherit";
        span.style.webkitBackgroundClip = "text";
        span.style.webkitTextFillColor = "transparent";
        span.style.backgroundClip = "text";
      }
      el.appendChild(span);
    });
  });
}

// ═══════════════════════════════════════════════════════════
// HERO SPOTLIGHT – click opens Smart Hub for that destination
// ═══════════════════════════════════════════════════════════
function initHeroSpotlightClicks() {
  const cards = document.querySelectorAll(".hero-spotlight-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const dest = card.dataset.dest;
      if (!dest) return;
      if (typeof openSmartHub === "function") {
        openSmartHub();
        const hubInput = document.getElementById("smartHubInput");
        if (hubInput) {
          hubInput.value = dest;
          hubInput.dispatchEvent(new Event("input"));
        }
        if (typeof smartHubExplore === "function") smartHubExplore(dest);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
// HERO EXPLORE BTN – opens Smart Hub
// ═══════════════════════════════════════════════════════════
function initHeroExploreBtn() {
  const btn = document.getElementById("heroExploreBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (typeof openSmartHub === "function") {
      openSmartHub();
    } else {
      const dest = document.getElementById("destinations");
      if (dest) dest.scrollIntoView({ behavior: "smooth" });
    }
  });
}

// ═══════════════════════════════════════════════════════════
// TESTIMONIALS CAROUSEL – scroll through testimonial cards
// ═══════════════════════════════════════════════════════════
function initTestimonialsCarousel() {
  const track = document.getElementById("testimonialsTrack");
  if (!track || track.dataset.carouselInit) return;
  track.dataset.carouselInit = "1";

  const prevBtn = document.getElementById("testimPrev");
  const nextBtn = document.getElementById("testimNext");
  const dotsContainer = document.getElementById("testimDots");
  if (!prevBtn || !nextBtn) return;

  const cards = track.querySelectorAll(".testimonial-card");
  if (!cards.length) return;

  let currentIndex = 0;
  let cardsPerView = getCardsPerView();

  function getCardsPerView() {
    if (window.innerWidth <= 640) return 1;
    if (window.innerWidth <= 900) return 2;
    return 3;
  }

  const totalSlides = Math.max(1, cards.length - cardsPerView + 1);

  // Create dots
  function renderDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = "";
    const cnt = Math.max(1, cards.length - getCardsPerView() + 1);
    for (let i = 0; i < cnt; i++) {
      const dot = document.createElement("span");
      dot.className = "dot" + (i === currentIndex ? " active" : "");
      dot.addEventListener("click", () => goTo(i));
      dotsContainer.appendChild(dot);
    }
  }

  function goTo(idx) {
    cardsPerView = getCardsPerView();
    const maxIdx = Math.max(0, cards.length - cardsPerView);
    currentIndex = Math.max(0, Math.min(idx, maxIdx));
    const card = cards[0];
    const gap = 24;
    const cardW = card.offsetWidth + gap;
    track.style.transform = `translateX(-${currentIndex * cardW}px)`;
    renderDots();
  }

  prevBtn.addEventListener("click", () => {
    const maxIdx = Math.max(0, cards.length - getCardsPerView());
    goTo(currentIndex <= 0 ? maxIdx : currentIndex - 1);
  });
  nextBtn.addEventListener("click", () => {
    const maxIdx = Math.max(0, cards.length - getCardsPerView());
    goTo(currentIndex >= maxIdx ? 0 : currentIndex + 1);
  });

  // Auto-play
  let autoplay = setInterval(() => {
    const maxIdx = Math.max(0, cards.length - getCardsPerView());
    goTo(currentIndex >= maxIdx ? 0 : currentIndex + 1);
  }, 5000);

  // Pause on hover
  track.addEventListener("mouseenter", () => clearInterval(autoplay));
  track.addEventListener("mouseleave", () => {
    autoplay = setInterval(() => {
      const maxIdx = Math.max(0, cards.length - getCardsPerView());
      goTo(currentIndex >= maxIdx ? 0 : currentIndex + 1);
    }, 5000);
  });

  window.addEventListener("resize", () => goTo(currentIndex));
  renderDots();
}

// ═══════════════════════════════════════════════════════════
// SPLIT TEXT REVEAL – chars animate in on scroll
// ═══════════════════════════════════════════════════════════
function initSplitReveal() {
  const titles = document.querySelectorAll(".split-reveal");
  if (!titles.length) return;

  titles.forEach((title) => {
    // Build chars (preserve inner HTML icons)
    const text = title.textContent.trim();
    const icon = title.querySelector("i");
    let html = "";
    if (icon) html += icon.outerHTML + " ";
    const chars = text.replace(icon ? icon.textContent : "", "").trim();
    chars.split("").forEach((ch, i) => {
      if (ch === " ") {
        html += " ";
      } else {
        html += `<span class="split-char" style="transition-delay:${i * 0.03}s">${ch}</span>`;
      }
    });
    title.innerHTML = html;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("split-done");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 },
  );

  titles.forEach((t) => observer.observe(t));
}

// ═══════════════════════════════════════════════════════════
// BOOKING LINKS – Quick links to travel booking platforms
// ═══════════════════════════════════════════════════════════
function initBookingSection() {
  const btn = document.getElementById("bookingSearchBtn");
  if (!btn) return;

  // Set default dates (tomorrow + day after)
  const ci = document.getElementById("bookingCheckin");
  const co = document.getElementById("bookingCheckout");
  if (ci && !ci.value) {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 7);
    ci.value = tmrw.toISOString().split("T")[0];
    const dayAfter = new Date(tmrw);
    dayAfter.setDate(dayAfter.getDate() + 3);
    co.value = dayAfter.toISOString().split("T")[0];
  }

  btn.addEventListener("click", async () => {
    const dest = document.getElementById("bookingDest").value;
    if (!dest) return showToast("Please select a destination.", "warning");

    const checkin = ci.value || "";
    const checkout = co.value || "";
    const resultDiv = document.getElementById("bookingResult");

    resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:var(--primary-light)"></i><p>Finding booking links…</p></div>`;

    try {
      const params = new URLSearchParams({
        destination: dest,
        checkin,
        checkout,
      });
      const res = await fetch(`${API_BASE}/api/booking/links?${params}`);
      const data = await res.json();

      if (!res.ok) {
        resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i><p>${data.error || "Failed to load booking links."}</p></div>`;
        return;
      }

      const CATEGORY_ICONS = {
        flights: "fa-plane",
        hotels: "fa-hotel",
        trains: "fa-train",
        buses: "fa-bus",
      };
      const CATEGORY_LABELS = {
        flights: "Flights",
        hotels: "Hotels & Stays",
        trains: "Trains",
        buses: "Buses",
      };

      let html = '<div class="booking-results">';
      for (const [cat, platforms] of Object.entries(data.links)) {
        if (!platforms || platforms.length === 0) continue;
        html += `
          <div class="booking-category">
            <h4 class="booking-cat-title"><i class="fas ${CATEGORY_ICONS[cat] || "fa-link"}"></i> ${CATEGORY_LABELS[cat] || cat}</h4>
            <div class="booking-platform-grid">
              ${platforms
                .map(
                  (p) => `
                <a href="${p.url}" target="_blank" rel="noopener" class="booking-platform-card" style="border-left:4px solid ${p.color || "var(--primary)"}">
                  <div class="booking-platform-icon"><i class="${p.icon || "fas fa-external-link-alt"}"></i></div>
                  <div class="booking-platform-info">
                    <strong>${p.platform}</strong>
                    <small>${p.description || ""}</small>
                  </div>
                  <i class="fas fa-external-link-alt booking-ext-icon"></i>
                </a>
              `,
                )
                .join("")}
            </div>
          </div>`;
      }
      html += "</div>";
      resultDiv.innerHTML = html;
    } catch {
      resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i><p>Network error – is the server running?</p></div>`;
    }
  });
}

// ═══════════════════════════════════════════════════════════
// CURRENCY CONVERTER – Live exchange rates
// ═══════════════════════════════════════════════════════════
function initCurrencyConverter() {
  const amountEl = document.getElementById("currAmount");
  const fromEl = document.getElementById("currFrom");
  const toEl = document.getElementById("currTo");
  const swapBtn = document.getElementById("currSwap");
  const convertedEl = document.getElementById("currConverted");
  const rateInfoEl = document.getElementById("currRateInfo");

  if (!amountEl || !fromEl || !toEl) return;

  async function doConvert() {
    const amount = parseFloat(amountEl.value);
    if (!amount || amount <= 0) {
      convertedEl.textContent = "—";
      rateInfoEl.textContent = "";
      return;
    }

    try {
      const params = new URLSearchParams({
        amount: amount,
        from: fromEl.value,
        to: toEl.value,
      });
      const res = await fetch(`${API_BASE}/api/currency/convert?${params}`);
      const data = await res.json();

      if (!res.ok) {
        convertedEl.textContent = "Error";
        rateInfoEl.textContent = data.error || "Conversion failed";
        return;
      }

      convertedEl.textContent = `${data.symbol}${Number(data.converted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      rateInfoEl.textContent = `1 ${data.from} = ${Number(data.rate).toFixed(4)} ${data.to}${data.source === "fallback" ? " (offline rate)" : ""}`;
    } catch {
      convertedEl.textContent = "—";
      rateInfoEl.textContent = "Network error";
    }
  }

  // Debounce input
  let convertTimer;
  function triggerConvert() {
    clearTimeout(convertTimer);
    convertTimer = setTimeout(doConvert, 400);
  }

  amountEl.addEventListener("input", triggerConvert);
  fromEl.addEventListener("change", doConvert);
  toEl.addEventListener("change", doConvert);

  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const tmp = fromEl.value;
      fromEl.value = toEl.value;
      toEl.value = tmp;
      swapBtn.classList.add("spinning");
      setTimeout(() => swapBtn.classList.remove("spinning"), 300);
      doConvert();
    });
  }

  // Initial conversion
  doConvert();
}

// ═══════════════════════════════════════════════════════════
// LOCAL LANGUAGE HELPER – Phrase book for destinations
// ═══════════════════════════════════════════════════════════
function initLanguageSection() {
  const btn = document.getElementById("langSearchBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const dest = document.getElementById("langDest").value;
    if (!dest) return showToast("Please select a destination.", "warning");

    const resultDiv = document.getElementById("langResult");
    resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:var(--primary-light)"></i><p>Loading phrases…</p></div>`;

    try {
      const res = await fetch(
        `${API_BASE}/api/language/phrases?destination=${encodeURIComponent(dest)}`,
      );
      const data = await res.json();

      if (!res.ok) {
        resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i><p>${data.error || "Failed to load phrases."}</p></div>`;
        return;
      }

      let html = `
        <div class="lang-results">
          <div class="lang-header">
            <span class="lang-badge"><i class="fas fa-language"></i> ${data.language}</span>
            ${data.script ? `<span class="lang-script">${data.script}</span>` : ""}
          </div>
          <div class="lang-phrases-grid">
            ${data.phrases
              .map(
                (p) => `
              <div class="lang-phrase-card">
                <div class="lang-phrase-text">${p.phrase}</div>
                <div class="lang-phrase-trans">${p.transliteration}</div>
                <div class="lang-phrase-meaning">${p.meaning}</div>
                <small class="lang-phrase-usage"><i class="fas fa-info-circle"></i> ${p.usage}</small>
              </div>
            `,
              )
              .join("")}
          </div>`;

      if (data.travel_tips && data.travel_tips.length) {
        html += `
          <div class="lang-tips">
            <h4><i class="fas fa-lightbulb"></i> Travel Tips</h4>
            <ul>${data.travel_tips.map((t) => `<li>${t}</li>`).join("")}</ul>
          </div>`;
      }
      html += "</div>";
      resultDiv.innerHTML = html;
    } catch {
      resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i><p>Network error – is the server running?</p></div>`;
    }
  });
}

// ═══════════════════════════════════════════════════════════
// EXPENSE TRACKER – Log & visualise trip spending
// ═══════════════════════════════════════════════════════════
let expenseCache = [];

function initExpenseTracker() {
  const addBtn = document.getElementById("expAddBtn");
  if (!addBtn) return;

  // Default date to today
  const dateEl = document.getElementById("expDate");
  if (dateEl && !dateEl.value)
    dateEl.value = new Date().toISOString().split("T")[0];

  addBtn.addEventListener("click", async () => {
    const dest = document.getElementById("expDest").value;
    const category = document.getElementById("expCategory").value;
    const description = document.getElementById("expDesc").value.trim();
    const amount = parseFloat(document.getElementById("expAmount").value);
    const date = document.getElementById("expDate").value;

    if (!dest) return showToast("Please select a destination.", "warning");
    if (!description) return showToast("Please add a description.", "warning");
    if (!amount || amount <= 0)
      return showToast("Please enter a valid amount.", "warning");

    try {
      const res = await fetch(`${API_BASE}/api/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          destination: dest,
          category,
          description,
          amount,
          date,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast("Expense added!", "success");
        document.getElementById("expDesc").value = "";
        document.getElementById("expAmount").value = "";
        await loadExpenses();
      } else {
        showToast(data.error || "Failed to add expense.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  });
}

async function loadExpenses() {
  if (!currentUser) return;

  try {
    const [listRes, sumRes] = await Promise.all([
      fetch(`${API_BASE}/api/expenses`, { credentials: "same-origin" }),
      fetch(`${API_BASE}/api/expenses/summary`, { credentials: "same-origin" }),
    ]);
    const listData = await listRes.json();
    const sumData = await sumRes.json();

    expenseCache = listData.expenses || [];
    renderExpenses(expenseCache, sumData);
  } catch {
    expenseCache = [];
  }
}

function renderExpenses(expenses, summary) {
  const totalEl = document.getElementById("expTotal");
  const barsEl = document.getElementById("expCategoryBars");
  const listEl = document.getElementById("expList");

  if (totalEl) totalEl.textContent = formatINR(summary.total || 0);

  // Category breakdown bars
  if (barsEl && summary.by_category) {
    const maxAmt = Math.max(...Object.values(summary.by_category), 1);
    const CAT_COLORS = {
      food: "#f97316",
      transport: "#3b82f6",
      accommodation: "#8b5cf6",
      activity: "#10b981",
      shopping: "#ec4899",
      misc: "#6b7280",
    };
    const CAT_ICONS = {
      food: "🍽️",
      transport: "🚗",
      accommodation: "🏨",
      activity: "🎭",
      shopping: "🛒",
      misc: "📦",
    };
    barsEl.innerHTML = Object.entries(summary.by_category)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([cat, amt]) => `
        <div class="exp-bar-row">
          <span class="exp-bar-label">${CAT_ICONS[cat] || ""} ${cat}</span>
          <div class="exp-bar-track"><div class="exp-bar-fill" style="width:${(amt / maxAmt) * 100}%;background:${CAT_COLORS[cat] || "#6b7280"}"></div></div>
          <span class="exp-bar-amount">${formatINR(amt)}</span>
        </div>
      `,
      )
      .join("");
  }

  // Expense list
  if (listEl) {
    if (expenses.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><p>No expenses logged yet. Add your first expense!</p></div>`;
      return;
    }

    listEl.innerHTML = expenses
      .map((e) => {
        const date = new Date(e.date || e.created_at).toLocaleDateString(
          "en-IN",
          { day: "numeric", month: "short" },
        );
        const CAT_ICONS = {
          food: "🍽️",
          transport: "🚗",
          accommodation: "🏨",
          activity: "🎭",
          shopping: "🛒",
          misc: "📦",
        };
        return `
        <div class="exp-item">
          <div class="exp-item-icon">${CAT_ICONS[e.category] || "📦"}</div>
          <div class="exp-item-info">
            <strong>${e.description}</strong>
            <small>${e.destination} · ${date}</small>
          </div>
          <div class="exp-item-amount">${formatINR(e.amount)}</div>
          <button class="exp-item-del" data-action="delete-expense" data-id="${e.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
        </div>`;
      })
      .join("");
  }
}

async function deleteExpense(id) {
  try {
    const res = await fetch(`${API_BASE}/api/expenses/${id}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
    if (res.ok) {
      showToast("Expense deleted.", "info");
      await loadExpenses();
    } else {
      showToast("Could not delete expense.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

// ═══════════════════════════════════════════════════════════
// SMART PACKING CHECKLIST – Weather-based + custom items
// ═══════════════════════════════════════════════════════════
let packingCache = [];

function initPackingChecklist() {
  const genBtn = document.getElementById("packGenBtn");
  const customBtn = document.getElementById("packCustomBtn");
  if (!genBtn) return;

  genBtn.addEventListener("click", async () => {
    const dest = document.getElementById("packDest").value;
    if (!dest) return showToast("Please select a destination.", "warning");

    genBtn.disabled = true;
    genBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';

    try {
      const res = await fetch(`${API_BASE}/api/packing/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify({ destination: dest }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`Packing list for ${dest} generated!`, "success");
        await loadPackingItems();
      } else {
        showToast(data.error || "Failed to generate packing list.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      genBtn.disabled = false;
      genBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Checklist';
    }
  });

  if (customBtn) {
    customBtn.addEventListener("click", addCustomPackingItem);
    const input = document.getElementById("packCustomInput");
    if (input)
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addCustomPackingItem();
      });
  }
}

async function addCustomPackingItem() {
  const input = document.getElementById("packCustomInput");
  const text = input ? input.value.trim() : "";
  if (!text) return;

  const dest = document.getElementById("packDest").value || "General";

  try {
    const res = await fetch(`${API_BASE}/api/packing/custom`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify({ destination: dest, item_text: text }),
    });
    if (res.ok) {
      input.value = "";
      await loadPackingItems();
    } else {
      const data = await res.json();
      showToast(data.error || "Could not add item.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

async function loadPackingItems() {
  if (!currentUser) return;

  try {
    const res = await fetch(`${API_BASE}/api/packing`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    packingCache = data.items || [];
    renderPackingList(packingCache);
  } catch {
    packingCache = [];
  }
}

function renderPackingList(items) {
  const listEl = document.getElementById("packList");
  const progressWrap = document.getElementById("packProgressWrap");
  const progressFill = document.getElementById("packProgressFill");
  const progressText = document.getElementById("packProgressText");
  const customWrap = document.getElementById("packCustomWrap");

  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = "";
    if (progressWrap) progressWrap.style.display = "none";
    if (customWrap) customWrap.style.display = "none";
    return;
  }

  // Show progress & custom input
  if (progressWrap) progressWrap.style.display = "";
  if (customWrap) customWrap.style.display = "";

  const checked = items.filter((i) => i.is_checked).length;
  const pct = Math.round((checked / items.length) * 100);
  if (progressFill) progressFill.style.width = pct + "%";
  if (progressText)
    progressText.textContent = `${pct}% packed (${checked}/${items.length})`;

  // Group items by destination
  const groups = {};
  items.forEach((i) => {
    const key = i.destination || "General";
    if (!groups[key]) groups[key] = [];
    groups[key].push(i);
  });

  listEl.innerHTML = Object.entries(groups)
    .map(
      ([dest, destItems]) => `
    <div class="pack-group">
      <h4 class="pack-group-title"><i class="fas fa-map-marker-alt"></i> ${dest}</h4>
      ${destItems
        .map(
          (item) => `
        <div class="pack-item ${item.is_checked ? "checked" : ""}">
          <label class="pack-check-label">
            <input type="checkbox" ${item.is_checked ? "checked" : ""} data-action="toggle-packing" data-id="${item.id}" />
            <span class="pack-item-text">${item.item_text}</span>
            ${item.is_custom ? '<span class="pack-custom-badge">custom</span>' : ""}
          </label>
          <button class="pack-del-btn" data-action="delete-packing" data-id="${item.id}" title="Remove"><i class="fas fa-times"></i></button>
        </div>
      `,
        )
        .join("")}
    </div>
  `,
    )
    .join("");
}

async function togglePackingItem(id) {
  try {
    await fetch(`${API_BASE}/api/packing/${id}/toggle`, {
      method: "PUT",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
    // Update local cache without re-fetching
    const item = packingCache.find((i) => i.id === id);
    if (item) item.is_checked = !item.is_checked;
    renderPackingList(packingCache);
  } catch {
    showToast("Could not update item.", "error");
  }
}

async function deletePackingItem(id) {
  try {
    const res = await fetch(`${API_BASE}/api/packing/${id}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
    if (res.ok) {
      packingCache = packingCache.filter((i) => i.id !== id);
      renderPackingList(packingCache);
    }
  } catch {
    showToast("Network error.", "error");
  }
}

// ═══════════════════════════════════════════════════════════
// TRAVEL JOURNAL – Notes & community sharing
// ═══════════════════════════════════════════════════════════
let journalCache = [];
let communityCache = [];
let activeJournalTab = "mine";

function initJournal() {
  const saveBtn = document.getElementById("journalSaveBtn");
  if (!saveBtn) return;

  saveBtn.addEventListener("click", async () => {
    const dest = document.getElementById("journalDest").value;
    const title = document.getElementById("journalTitle").value.trim();
    const content = document.getElementById("journalContent").value.trim();
    const mood = document.getElementById("journalMood").value;
    const rating =
      parseInt(document.getElementById("journalRating").value) || null;
    const isPublic = document.getElementById("journalPublic").checked;

    if (!dest) return showToast("Please select a destination.", "warning");
    if (!title) return showToast("Please add a title.", "warning");
    if (!content) return showToast("Please write something.", "warning");

    try {
      const res = await fetch(`${API_BASE}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          destination: dest,
          title,
          content,
          mood,
          rating,
          is_public: isPublic,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast("Journal entry saved!", "success");
        document.getElementById("journalTitle").value = "";
        document.getElementById("journalContent").value = "";
        document.getElementById("journalMood").value = "";
        document.getElementById("journalRating").value = "";
        document.getElementById("journalPublic").checked = false;
        await loadJournalNotes();
      } else {
        showToast(data.error || "Failed to save note.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  });

  // Tab switching
  document.querySelectorAll(".journal-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".journal-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeJournalTab = tab.dataset.jtab;
      renderJournalList();
    });
  });
}

async function loadJournalNotes() {
  if (!currentUser) return;

  try {
    const [myRes, commRes] = await Promise.all([
      fetch(`${API_BASE}/api/notes`, { credentials: "same-origin" }),
      fetch(`${API_BASE}/api/notes/community`),
    ]);
    const myData = await myRes.json();
    const commData = await commRes.json();
    journalCache = myData.notes || [];
    communityCache = commData.notes || [];
    renderJournalList();
  } catch {
    journalCache = [];
    communityCache = [];
  }
}

function renderJournalList() {
  const listEl = document.getElementById("journalList");
  if (!listEl) return;

  const items = activeJournalTab === "mine" ? journalCache : communityCache;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-book-open"></i>
        <p>${activeJournalTab === "mine" ? "No journal entries yet. Share your travel story!" : "No community notes yet. Be the first to share!"}</p>
      </div>`;
    return;
  }

  const MOOD_EMOJI = {
    excited: "🤩",
    happy: "😊",
    relaxed: "😌",
    amazed: "🤯",
    grateful: "🙏",
    adventurous: "🏔️",
  };

  listEl.innerHTML = items
    .map((n) => {
      const date = new Date(n.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const stars = n.rating ? "⭐".repeat(n.rating) : "";
      const moodText = n.mood ? (MOOD_EMOJI[n.mood] || "") + " " + n.mood : "";
      const isOwn = activeJournalTab === "mine";

      return `
      <div class="journal-entry">
        <div class="journal-entry-header">
          <div>
            <strong class="journal-entry-title">${n.title}</strong>
            <span class="journal-entry-dest"><i class="fas fa-map-marker-alt"></i> ${n.destination}</span>
          </div>
          <div class="journal-entry-meta">
            ${moodText ? `<span class="journal-mood">${moodText}</span>` : ""}
            ${stars ? `<span class="journal-stars">${stars}</span>` : ""}
          </div>
        </div>
        <p class="journal-entry-content">${n.content.length > 200 ? n.content.substring(0, 200) + "…" : n.content}</p>
        <div class="journal-entry-footer">
          <span class="journal-entry-date"><i class="fas fa-clock"></i> ${date}</span>
          ${!isOwn && n.user_name ? `<span class="journal-entry-author"><i class="fas fa-user"></i> ${n.user_name}</span>` : ""}
          ${isOwn ? `<button class="journal-del-btn" data-action="delete-journal" data-id="${n.id}"><i class="fas fa-trash-alt"></i></button>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

async function deleteJournalNote(id) {
  try {
    const res = await fetch(`${API_BASE}/api/notes/${id}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
    if (res.ok) {
      showToast("Note deleted.", "info");
      await loadJournalNotes();
    } else {
      showToast("Could not delete note.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

// ═══════════════════════════════════════════════════════════
// TRIP SHARING – Generate shareable links for itineraries
// ═══════════════════════════════════════════════════════════
async function shareItinerary(data) {
  if (!currentUser) {
    showToast("Please log in to share trips.", "warning");
    openAuthModal("login");
    return;
  }

  const shareResultDiv = document.getElementById("shareResult");
  if (!shareResultDiv) return;

  try {
    const res = await fetch(`${API_BASE}/api/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify({
        title: `${data.num_days}-Day ${data.destination} Trip`,
        itinerary_json: JSON.stringify(data),
        notes: `${data.destination} itinerary for ${data.family_size || 1} people`,
      }),
    });
    const result = await res.json();

    if (res.ok) {
      const shareUrl = `${window.location.origin}/api/share/${result.share_token}`;
      shareResultDiv.style.display = "block";
      shareResultDiv.innerHTML = `
        <div class="share-link-box">
          <i class="fas fa-link"></i>
          <input type="text" value="${shareUrl}" readonly id="shareLinkInput" />
          <button class="btn btn-sm btn-primary" data-action="copy-share-link"><i class="fas fa-copy"></i> Copy</button>
        </div>
        <small style="color:var(--text-muted)">Anyone with this link can view your trip</small>
      `;
      showToast("Share link created!", "success");
    } else {
      showToast(result.error || "Could not create share link.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

function copyShareLink() {
  const input = document.getElementById("shareLinkInput");
  if (!input) return;
  input.select();
  navigator.clipboard
    .writeText(input.value)
    .then(() => {
      showToast("Link copied to clipboard!", "success");
    })
    .catch(() => {
      document.execCommand("copy");
      showToast("Link copied!", "success");
    });
}

// ═══════════════════════════════════════════════════════════
// ITINERARY DRAG-AND-DROP – Reorder activities
// ═══════════════════════════════════════════════════════════
function initItineraryDragDrop(container, data) {
  let dragSrc = null;

  container.querySelectorAll(".itin-slot[draggable]").forEach((slot) => {
    slot.addEventListener("dragstart", (e) => {
      dragSrc = slot;
      slot.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");
    });

    slot.addEventListener("dragend", () => {
      slot.classList.remove("dragging");
      container
        .querySelectorAll(".itin-slot")
        .forEach((s) => s.classList.remove("drag-over"));
    });

    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      slot.classList.add("drag-over");
    });

    slot.addEventListener("dragleave", () => {
      slot.classList.remove("drag-over");
    });

    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("drag-over");
      if (dragSrc && dragSrc !== slot) {
        // Swap the slots in the DOM
        const parent = slot.parentNode;
        const srcParent = dragSrc.parentNode;
        const srcNext = dragSrc.nextSibling;

        parent.insertBefore(dragSrc, slot);
        if (srcNext) {
          srcParent.insertBefore(slot, srcNext);
        } else {
          srcParent.appendChild(slot);
        }
        showToast("Activity reordered!", "info");
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
// TIMELINE VIEW – Visual timeline for itinerary
// ═══════════════════════════════════════════════════════════
function renderTimelineView(data) {
  if (!data || !data.itinerary) return "<p>No itinerary data.</p>";

  const PERIOD_COLORS = {
    morning: "#f59e0b",
    afternoon: "#3b82f6",
    evening: "#8b5cf6",
  };
  const PERIOD_ICONS = {
    morning: "fa-sun",
    afternoon: "fa-cloud-sun",
    evening: "fa-moon",
  };
  const PERIOD_TIMES = {
    morning: "8:00 AM",
    afternoon: "1:00 PM",
    evening: "6:00 PM",
  };

  const items = [];
  data.itinerary.forEach((day, idx) => {
    items.push({
      type: "day",
      label: day.title || `Day ${idx + 1}`,
      dayNum: day.day || idx + 1,
    });
    ["morning", "afternoon", "evening"].forEach((period) => {
      if (day[period]) {
        items.push({
          type: "activity",
          period,
          activity: day[period].activity || "",
          description: day[period].description || "",
          duration: day[period].duration || "",
          cost: day[period].cost || "",
          time: PERIOD_TIMES[period],
        });
      }
    });
  });

  return `
    <div class="timeline-container">
      ${items
        .map((item) => {
          if (item.type === "day") {
            return `<div class="timeline-day-marker"><span class="timeline-day-badge">Day ${item.dayNum}</span> <span class="timeline-day-label">${item.label}</span></div>`;
          }
          return `
          <div class="timeline-item">
            <div class="timeline-dot" style="background:${PERIOD_COLORS[item.period]}"></div>
            <div class="timeline-time">${item.time}</div>
            <div class="timeline-card">
              <div class="timeline-card-header">
                <i class="fas ${PERIOD_ICONS[item.period]}" style="color:${PERIOD_COLORS[item.period]}"></i>
                <strong>${item.activity}</strong>
              </div>
              <p>${item.description}</p>
              <div class="timeline-card-meta">
                ${item.duration ? `<span><i class="fas fa-clock"></i> ${item.duration}</span>` : ""}
                ${item.cost ? `<span><i class="fas fa-rupee-sign"></i> ${item.cost}</span>` : ""}
              </div>
            </div>
          </div>`;
        })
        .join("")}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRIP DASHBOARD – Wanderlog-style Trip Planning Workspace
   ═══════════════════════════════════════════════════════════════════════════ */

let _tdTrips = [];
let _tdCurrentTrip = null;
let _tdCurrentDayId = null;
let _tdTripMap = null;
let _tdInitialized = false;

function initTripDashboard() {
  if (_tdInitialized) {
    loadTdTrips();
    return;
  }
  _tdInitialized = true;

  // Tab switching – main trip list
  document.querySelectorAll(".td-tabs .td-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".td-tabs .td-tab")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTdTrips(btn.dataset.status);
    });
  });

  // New trip modal
  document
    .getElementById("tdNewTripBtn")
    ?.addEventListener("click", () => openTdModal("tdNewTripModal"));
  document.getElementById("tdTemplatesBtn")?.addEventListener("click", () => {
    openTdModal("tdTemplatesModal");
    loadTdTemplates();
  });
  document.getElementById("tdStatsBtn")?.addEventListener("click", () => {
    openTdModal("tdStatsModal");
    loadTdStats();
  });

  // Create trip form
  document
    .getElementById("tdNewTripForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await createTdTrip();
    });

  // Back button
  document
    .getElementById("tdBackBtn")
    ?.addEventListener("click", () => closeTdWorkspace());

  // Workspace tabs
  document.querySelectorAll(".td-ws-tabs .td-ws-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".td-ws-tabs .td-ws-tab")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document
        .querySelectorAll(".td-ws-panel")
        .forEach((p) => p.classList.remove("active"));
      const panel = document.querySelector(
        `.td-ws-panel[data-panel="${btn.dataset.panel}"]`,
      );
      if (panel) panel.classList.add("active");
      if (btn.dataset.panel === "map") initTdMap();
    });
  });

  // Add day
  document.getElementById("tdAddDayBtn")?.addEventListener("click", addTdDay);

  // Add place
  document
    .getElementById("tdAddPlaceBtn")
    ?.addEventListener("click", () => openTdModal("tdAddPlaceModal"));
  document
    .getElementById("tdAddPlaceForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await addTdPlace();
    });

  // Add reservation
  document
    .getElementById("tdAddResBtn")
    ?.addEventListener("click", () => openTdModal("tdAddResModal"));
  document
    .getElementById("tdAddResForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await addTdReservation();
    });

  // Add companion
  document
    .getElementById("tdAddCompBtn")
    ?.addEventListener("click", () => openTdModal("tdAddCompModal"));
  document
    .getElementById("tdAddCompForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await addTdCompanion();
    });

  // Reservation filters
  document.querySelectorAll(".td-res-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".td-res-filter")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTdReservations(btn.dataset.type);
    });
  });

  // Photo upload
  document
    .getElementById("tdPhotoUpload")
    ?.addEventListener("change", handleTdPhotoUpload);

  // Document upload
  document
    .getElementById("tdDocUpload")
    ?.addEventListener("change", handleTdDocUpload);

  // Workspace actions
  document.getElementById("tdWsEditBtn")?.addEventListener("click", editTdTrip);
  document
    .getElementById("tdWsDeleteBtn")
    ?.addEventListener("click", deleteTdTrip);

  // Template filters
  document.querySelectorAll(".td-tpl-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".td-tpl-filter")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadTdTemplates(btn.dataset.cat);
    });
  });

  // Date auto-calc days
  const startInput = document.getElementById("tdTripStart");
  const endInput = document.getElementById("tdTripEnd");
  const daysInput = document.getElementById("tdTripDays");
  if (startInput && endInput) {
    const calcDays = () => {
      if (startInput.value && endInput.value) {
        const diff =
          Math.ceil(
            (new Date(endInput.value) - new Date(startInput.value)) / 86400000,
          ) + 1;
        if (diff > 0) daysInput.value = diff;
      }
    };
    startInput.addEventListener("change", calcDays);
    endInput.addEventListener("change", calcDays);
  }

  // Close modals on overlay click
  document.querySelectorAll(".td-modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.style.display = "none";
    });
  });

  loadTdTrips();
}

function openTdModal(id) {
  document.getElementById(id).style.display = "flex";
}
function closeTdModal(id) {
  document.getElementById(id).style.display = "none";
}

/* ─── Trip CRUD ─── */

async function loadTdTrips() {
  try {
    const res = await fetch(`${API_BASE}/api/trips/planner`);
    if (!res.ok) return;
    const data = await res.json();
    _tdTrips = data.trips || [];
    renderTdTrips("all");
  } catch (e) {
    console.error("loadTdTrips", e);
  }
}

function renderTdTrips(status) {
  const grid = document.getElementById("tdTripsGrid");
  const empty = document.getElementById("tdEmptyState");
  let trips = _tdTrips;
  if (status && status !== "all")
    trips = trips.filter((t) => t.status === status);

  if (!trips.length) {
    grid.innerHTML = "";
    grid.appendChild(empty);
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";

  const STATUS_COLORS = {
    planning: "#f39c12",
    active: "#27ae60",
    completed: "#3498db",
  };
  const STATUS_ICONS = {
    planning: "fa-pencil-alt",
    active: "fa-plane",
    completed: "fa-check-circle",
  };

  grid.innerHTML = trips
    .map((t) => {
      const coverStyle = t.cover_image_url
        ? `background-image:url(${t.cover_image_url})`
        : "";
      const statusColor = STATUS_COLORS[t.status] || "#ccc";
      const statusIcon = STATUS_ICONS[t.status] || "fa-circle";
      const dates = t.start_date
        ? `${formatDate(t.start_date)}${t.end_date ? " – " + formatDate(t.end_date) : ""}`
        : `${t.num_days || "?"} days`;
      return `
      <div class="td-trip-card" data-action="open-td-trip" data-id="${t.id}">
        <div class="td-trip-cover" style="${coverStyle}">
          <span class="td-trip-status" style="background:${statusColor}"><i class="fas ${statusIcon}"></i> ${t.status}</span>
        </div>
        <div class="td-trip-info">
          <h4 class="td-trip-title">${escapeHtml(t.title)}</h4>
          <p class="td-trip-dest"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(t.destination || "")}</p>
          <p class="td-trip-date"><i class="fas fa-calendar-alt"></i> ${dates}</p>
          <div class="td-trip-stats-row">
            <span><i class="fas fa-map-pin"></i> ${t.places_count || 0}</span>
            <span><i class="fas fa-users"></i> ${t.companions_count || 0}</span>
            <span><i class="fas fa-camera"></i> ${t.photos_count || 0}</span>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function createTdTrip() {
  const body = {
    title: document.getElementById("tdTripTitle").value.trim(),
    destination: document.getElementById("tdTripDest").value.trim(),
    travel_class: document.getElementById("tdTripClass").value,
    start_date: document.getElementById("tdTripStart").value || null,
    end_date: document.getElementById("tdTripEnd").value || null,
    num_days: parseInt(document.getElementById("tdTripDays").value) || 3,
    family_size: parseInt(document.getElementById("tdTripFamily").value) || 2,
    budget_total:
      parseFloat(document.getElementById("tdTripBudget").value) || null,
    notes: document.getElementById("tdTripNotes").value.trim() || null,
  };
  if (!body.title || !body.destination)
    return showToast("Please fill in trip title and destination", "error");

  try {
    const res = await fetch(`${API_BASE}/api/trips/planner`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      showToast(d.error || "Failed", "error");
      return;
    }
    const data = await res.json();
    closeTdModal("tdNewTripModal");
    document.getElementById("tdNewTripForm").reset();
    showToast("Trip created! 🎉", "success");
    await loadTdTrips();
    openTdTrip(data.trip.id);
  } catch (e) {
    showToast("Error creating trip", "error");
  }
}

async function openTdTrip(tripId) {
  try {
    const res = await fetch(`${API_BASE}/api/trips/planner/${tripId}`);
    if (!res.ok) return;
    const data = await res.json();
    _tdCurrentTrip = data.trip;
    _tdCurrentDayId = null;

    // Show workspace, hide grid
    document.getElementById("tdTripsGrid").style.display = "none";
    document.querySelector(".td-tabs").style.display = "none";
    document.querySelector(".td-header-right").style.display = "none";
    const ws = document.getElementById("tdWorkspace");
    ws.style.display = "block";

    // Fill header
    document.getElementById("tdWsTitle").textContent = _tdCurrentTrip.title;
    document.getElementById("tdWsDest").textContent =
      _tdCurrentTrip.destination || "";
    const dates = _tdCurrentTrip.start_date
      ? `${formatDate(_tdCurrentTrip.start_date)}${_tdCurrentTrip.end_date ? " – " + formatDate(_tdCurrentTrip.end_date) : ""}`
      : `${_tdCurrentTrip.num_days} days`;
    document.getElementById("tdWsDates").textContent = dates;
    const badge = document.getElementById("tdWsStatusBadge");
    badge.textContent = _tdCurrentTrip.status;
    badge.className = "td-ws-status-badge td-status-" + _tdCurrentTrip.status;

    // Reset to itinerary tab
    document
      .querySelectorAll(".td-ws-tabs .td-ws-tab")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelector('.td-ws-tab[data-panel="itinerary"]')
      .classList.add("active");
    document
      .querySelectorAll(".td-ws-panel")
      .forEach((p) => p.classList.remove("active"));
    document
      .querySelector('.td-ws-panel[data-panel="itinerary"]')
      .classList.add("active");

    renderTdDays();
    renderTdReservations("all");
    renderTdPhotos();
    renderTdDocs();
    renderTdCompanions();
    renderTdBudget();
  } catch (e) {
    console.error("openTdTrip", e);
  }
}

function closeTdWorkspace() {
  document.getElementById("tdWorkspace").style.display = "none";
  document.getElementById("tdTripsGrid").style.display = "";
  document.querySelector(".td-tabs").style.display = "";
  document.querySelector(".td-header-right").style.display = "";
  _tdCurrentTrip = null;
  loadTdTrips();
}

async function editTdTrip() {
  if (!_tdCurrentTrip) return;
  // Reuse the new trip modal for editing
  document.getElementById("tdTripTitle").value = _tdCurrentTrip.title || "";
  document.getElementById("tdTripDest").value =
    _tdCurrentTrip.destination || "";
  document.getElementById("tdTripClass").value =
    _tdCurrentTrip.travel_class || "mid-range";
  document.getElementById("tdTripStart").value =
    _tdCurrentTrip.start_date || "";
  document.getElementById("tdTripEnd").value = _tdCurrentTrip.end_date || "";
  document.getElementById("tdTripDays").value = _tdCurrentTrip.num_days || 3;
  document.getElementById("tdTripFamily").value =
    _tdCurrentTrip.family_size || 2;
  document.getElementById("tdTripBudget").value =
    _tdCurrentTrip.budget_total || "";
  document.getElementById("tdTripNotes").value = _tdCurrentTrip.notes || "";

  // Change form submit to update
  const form = document.getElementById("tdNewTripForm");
  const oldHandler = form.onsubmit;
  const submitBtn = form.querySelector(".td-form-submit");
  submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Trip';

  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      title: document.getElementById("tdTripTitle").value.trim(),
      destination: document.getElementById("tdTripDest").value.trim(),
      travel_class: document.getElementById("tdTripClass").value,
      start_date: document.getElementById("tdTripStart").value || null,
      end_date: document.getElementById("tdTripEnd").value || null,
      num_days: parseInt(document.getElementById("tdTripDays").value) || 3,
      family_size: parseInt(document.getElementById("tdTripFamily").value) || 2,
      budget_total:
        parseFloat(document.getElementById("tdTripBudget").value) || null,
      notes: document.getElementById("tdTripNotes").value.trim() || null,
    };
    try {
      const res = await fetch(
        `${API_BASE}/api/trips/planner/${_tdCurrentTrip.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRFToken(),
          },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        showToast("Trip updated!", "success");
        closeTdModal("tdNewTripModal");
        openTdTrip(_tdCurrentTrip.id);
      }
    } catch (e) {
      showToast("Update failed", "error");
    }
    // Restore form
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Create Trip';
    form.onsubmit = null;
    form.addEventListener(
      "submit",
      async (ev) => {
        ev.preventDefault();
        await createTdTrip();
      },
      { once: false },
    );
  };
  openTdModal("tdNewTripModal");
}

async function deleteTdTrip() {
  if (!_tdCurrentTrip) return;
  if (!confirm(`Delete "${_tdCurrentTrip.title}"? This cannot be undone.`))
    return;
  try {
    await fetch(`${API_BASE}/api/trips/planner/${_tdCurrentTrip.id}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
    });
    showToast("Trip deleted", "success");
    closeTdWorkspace();
  } catch (e) {
    showToast("Delete failed", "error");
  }
}

/* ─── Day Planner ─── */

function renderTdDays() {
  const trip = _tdCurrentTrip;
  if (!trip) return;
  const dayList = document.getElementById("tdDayList");
  const days = trip.days || [];

  dayList.innerHTML = days
    .map(
      (d, i) => `
    <button class="td-day-btn ${_tdCurrentDayId === d.id || (!_tdCurrentDayId && i === 0) ? "active" : ""}"
      data-day-id="${d.id}" data-action="select-td-day" data-id="${d.id}">
      <span class="td-day-num">Day ${d.day_number}</span>
      <span class="td-day-date">${d.date ? formatDate(d.date) : ""}</span>
      <span class="td-day-label">${escapeHtml(d.title || "")}</span>
      <span class="td-day-place-count">${(d.places || []).length} places</span>
    </button>
  `,
    )
    .join("");

  // Select first day by default
  if (days.length && !_tdCurrentDayId) _tdCurrentDayId = days[0].id;
  renderTdDayContent();
}

function selectTdDay(dayId) {
  _tdCurrentDayId = dayId;
  document
    .querySelectorAll(".td-day-btn")
    .forEach((b) => b.classList.remove("active"));
  const btn = document.querySelector(`.td-day-btn[data-day-id="${dayId}"]`);
  if (btn) btn.classList.add("active");
  renderTdDayContent();
}

function renderTdDayContent() {
  const trip = _tdCurrentTrip;
  if (!trip) return;
  const day = (trip.days || []).find((d) => d.id === _tdCurrentDayId);
  const dayTitle = document.getElementById("tdDayTitle");
  const dayNotes = document.getElementById("tdDayNotes");
  const placesList = document.getElementById("tdPlacesList");

  if (!day) {
    dayTitle.textContent = "Select a day";
    placesList.innerHTML =
      '<div class="td-empty-mini"><i class="fas fa-calendar-plus"></i><p>No days yet — add one!</p></div>';
    return;
  }

  dayTitle.textContent = `Day ${day.day_number}${day.title ? " — " + day.title : ""}`;
  dayNotes.value = day.notes || "";

  // Day notes save on blur
  dayNotes.onblur = async () => {
    if (dayNotes.value !== (day.notes || "")) {
      await fetch(`${API_BASE}/api/trips/planner/${trip.id}/days/${day.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        body: JSON.stringify({ notes: dayNotes.value }),
      });
    }
  };

  const places = day.places || [];
  const CATEGORY_ICONS = {
    attraction: "fa-landmark",
    restaurant: "fa-utensils",
    hotel: "fa-hotel",
    shopping: "fa-shopping-bag",
    beach: "fa-umbrella-beach",
    activity: "fa-hiking",
    transport: "fa-car",
    other: "fa-map-pin",
  };

  if (!places.length) {
    placesList.innerHTML =
      '<div class="td-empty-mini"><i class="fas fa-map-pin"></i><p>No places added for this day</p></div>';
    return;
  }

  placesList.innerHTML = places
    .map((p, i) => {
      const icon = CATEGORY_ICONS[p.category] || "fa-map-pin";
      return `
    <div class="td-place-card" data-place-id="${p.id}" draggable="true"
      data-drag-place="${p.id}">
      <div class="td-place-handle"><i class="fas fa-grip-vertical"></i></div>
      <div class="td-place-icon"><i class="fas ${icon}"></i></div>
      <div class="td-place-info">
        <span class="td-place-name">${escapeHtml(p.name)}</span>
        <span class="td-place-meta">
          ${p.start_time ? `<span><i class="fas fa-clock"></i> ${p.start_time}</span>` : ""}
          ${p.duration_minutes ? `<span>${p.duration_minutes} min</span>` : ""}
          ${p.estimated_cost ? `<span><i class="fas fa-rupee-sign"></i> ${p.estimated_cost}</span>` : ""}
        </span>
        ${p.notes ? `<span class="td-place-notes">${escapeHtml(p.notes)}</span>` : ""}
      </div>
      <div class="td-place-actions">
        <button class="td-place-act" data-action="delete-td-place" data-id="${p.id}" title="Remove"><i class="fas fa-times"></i></button>
      </div>
    </div>`;
    })
    .join("");

  // Show unassigned places (places with null day_id)
  const allPlaces = trip.places || [];
  const unassigned = allPlaces.filter((p) => !p.day_id);
  const unassignedDiv = document.getElementById("tdUnassigned");
  const unassignedList = document.getElementById("tdUnassignedList");
  if (unassigned.length) {
    unassignedDiv.style.display = "block";
    unassignedList.innerHTML = unassigned
      .map((p) => {
        const icon = CATEGORY_ICONS[p.category] || "fa-map-pin";
        return `
      <div class="td-place-card td-place-unassigned" data-place-id="${p.id}">
        <div class="td-place-icon"><i class="fas ${icon}"></i></div>
        <div class="td-place-info">
          <span class="td-place-name">${escapeHtml(p.name)}</span>
        </div>
        <button class="td-place-act" data-action="assign-td-place" data-id="${p.id}" data-day-id="${day.id}" title="Add to this day"><i class="fas fa-plus"></i></button>
        <button class="td-place-act" data-action="delete-td-place" data-id="${p.id}" title="Remove"><i class="fas fa-times"></i></button>
      </div>`;
      })
      .join("");
  } else {
    unassignedDiv.style.display = "none";
  }
}

// Drag-and-drop reordering for places
let _tdDragPlaceId = null;
function tdDragStart(e, placeId) {
  _tdDragPlaceId = placeId;
  e.dataTransfer.effectAllowed = "move";
}
async function tdDrop(e, targetPlaceId) {
  e.preventDefault();
  if (!_tdDragPlaceId || _tdDragPlaceId === targetPlaceId || !_tdCurrentTrip)
    return;
  const day = (_tdCurrentTrip.days || []).find((d) => d.id === _tdCurrentDayId);
  if (!day) return;
  const places = [...(day.places || [])];
  const fromIdx = places.findIndex((p) => p.id === _tdDragPlaceId);
  const toIdx = places.findIndex((p) => p.id === targetPlaceId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = places.splice(fromIdx, 1);
  places.splice(toIdx, 0, moved);
  const order = {};
  order[_tdCurrentDayId] = places.map((p) => p.id);
  try {
    await fetch(
      `${API_BASE}/api/trips/planner/${_tdCurrentTrip.id}/places/reorder`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        body: JSON.stringify(order),
      },
    );
    await openTdTrip(_tdCurrentTrip.id);
    _tdCurrentDayId = day.id;
    selectTdDay(day.id);
  } catch (e) {
    console.error("reorder", e);
  }
}

async function addTdDay() {
  if (!_tdCurrentTrip) return;
  try {
    const res = await fetch(
      `${API_BASE}/api/trips/planner/${_tdCurrentTrip.id}/days`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        body: JSON.stringify({}),
      },
    );
    if (res.ok) {
      const data = await res.json();
      await openTdTrip(_tdCurrentTrip.id);
      selectTdDay(data.day.id);
    }
  } catch (e) {
    showToast("Failed to add day", "error");
  }
}

async function addTdPlace() {
  if (!_tdCurrentTrip) return;
  const body = {
    name: document.getElementById("tdPlaceName").value.trim(),
    category: document.getElementById("tdPlaceCat").value,
    estimated_cost:
      parseFloat(document.getElementById("tdPlaceCost").value) || null,
    start_time: document.getElementById("tdPlaceStart").value || null,
    duration_minutes:
      parseInt(document.getElementById("tdPlaceDuration").value) || null,
    address: document.getElementById("tdPlaceAddr").value.trim() || null,
    notes: document.getElementById("tdPlaceNotes").value.trim() || null,
    day_id: _tdCurrentDayId || null,
  };
  if (!body.name) return showToast("Place name is required", "error");
  try {
    const res = await fetch(
      `${API_BASE}/api/trips/planner/${_tdCurrentTrip.id}/places`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        body: JSON.stringify(body),
      },
    );
    if (res.ok) {
      closeTdModal("tdAddPlaceModal");
      document.getElementById("tdAddPlaceForm").reset();
      showToast("Place added!", "success");
      const dayId = _tdCurrentDayId;
      await openTdTrip(_tdCurrentTrip.id);
      if (dayId) {
        _tdCurrentDayId = dayId;
        selectTdDay(dayId);
      }
    }
  } catch (e) {
    showToast("Failed to add place", "error");
  }
}

async function deleteTdPlace(placeId) {
  if (!_tdCurrentTrip) return;
  try {
    await fetch(
      `${API_BASE}/api/trips/planner/${_tdCurrentTrip.id}/places/${placeId}`,
      {
        method: "DELETE",
        headers: { "X-CSRFToken": getCSRFToken() },
      },
    );
    const dayId = _tdCurrentDayId;
    await openTdTrip(_tdCurrentTrip.id);
    if (dayId) {
      _tdCurrentDayId = dayId;
      selectTdDay(dayId);
    }
  } catch (e) {
    console.error("deleteTdPlace", e);
  }
}

async function assignTdPlace(placeId, dayId) {
  if (!_tdCurrentTrip) return;
  try {
    await fetch(
      `${API_BASE}/api/trips/planner/${_tdCurrentTrip.id}/places/${placeId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        body: JSON.stringify({ day_id: dayId }),
      },
    );
    await openTdTrip(_tdCurrentTrip.id);
    _tdCurrentDayId = dayId;
    selectTdDay(dayId);
  } catch (e) {
    console.error("assignTdPlace", e);
  }
}

/* ─── Map Panel ─── */

function initTdMap() {
  if (!_tdCurrentTrip) return;
  const container = document.getElementById("tdMapView");
  if (!container) return;

  const places = _tdCurrentTrip.places || [];
  const withCoords = places.filter((p) => p.lat && p.lon);

  // Use TomTom map if available
  if (typeof tt !== "undefined") {
    if (_tdTripMap) _tdTripMap.remove();
    const center = withCoords.length
      ? [withCoords[0].lon, withCoords[0].lat]
      : [78.9629, 20.5937];
    _tdTripMap = tt.map({
      key: window.TOMTOM_KEY || "",
      container: "tdMapView",
      center,
      zoom: withCoords.length ? 10 : 5,
    });
    withCoords.forEach((p, i) => {
      const marker = new tt.Marker()
        .setLngLat([p.lon, p.lat])
        .addTo(_tdTripMap);
      const popup = new tt.Popup({ offset: 25 }).setHTML(
        `<strong>${escapeHtml(p.name)}</strong><br>${p.category || ""}`,
      );
      marker.setPopup(popup);
    });
    // Fit bounds
    if (withCoords.length > 1) {
      const bounds = new tt.LngLatBounds();
      withCoords.forEach((p) => bounds.extend([p.lon, p.lat]));
      _tdTripMap.fitBounds(bounds, { padding: 50 });
    }
  } else {
    container.innerHTML = `<div class="td-map-placeholder"><i class="fas fa-map-marked-alt"></i><p>Add places with coordinates to see them on the map</p>
      <p class="td-map-hint">Places: ${places.length} | With coordinates: ${withCoords.length}</p></div>`;
  }

  // Legend
  const legend = document.getElementById("tdMapLegend");
  if (legend && places.length) {
    legend.innerHTML =
      `<h5>Places (${places.length})</h5>` +
      places
        .map(
          (p) =>
            `<div class="td-legend-item"><i class="fas fa-circle" style="color:${getCategoryColor(p.category)}"></i> ${escapeHtml(p.name)}</div>`,
        )
        .join("");
  }
}

function getCategoryColor(cat) {
  const colors = {
    attraction: "#e74c3c",
    restaurant: "#f39c12",
    hotel: "#3498db",
    shopping: "#9b59b6",
    beach: "#1abc9c",
    activity: "#e67e22",
    transport: "#95a5a6",
  };
  return colors[cat] || "#7f8c8d";
}

/* ─── Reservations ─── */

function renderTdReservations(filterType) {
  if (!_tdCurrentTrip) return;
  const list = document.getElementById("tdResList");
  let reservations = _tdCurrentTrip.reservations || [];
  if (filterType && filterType !== "all")
    reservations = reservations.filter((r) => r.res_type === filterType);

  if (!reservations.length) {
    list.innerHTML =
      '<div class="td-empty-mini"><i class="fas fa-ticket-alt"></i><p>No reservations yet</p></div>';
    return;
  }

  const TYPE_ICONS = {
    flight: "fa-plane",
    hotel: "fa-hotel",
    restaurant: "fa-utensils",
    transport: "fa-car",
    activity: "fa-hiking",
  };
  const STATUS_COLORS = {
    confirmed: "#27ae60",
    pending: "#f39c12",
    cancelled: "#e74c3c",
  };

  list.innerHTML = reservations
    .map(
      (r) => `
    <div class="td-res-card">
      <div class="td-res-icon"><i class="fas ${TYPE_ICONS[r.res_type] || "fa-ticket-alt"}"></i></div>
      <div class="td-res-info">
        <div class="td-res-title">${escapeHtml(r.title)}</div>
        <div class="td-res-meta">
          ${r.provider ? `<span><i class="fas fa-building"></i> ${escapeHtml(r.provider)}</span>` : ""}
          ${r.confirmation_code ? `<span><i class="fas fa-barcode"></i> ${r.confirmation_code}</span>` : ""}
          ${r.start_datetime ? `<span><i class="fas fa-clock"></i> ${new Date(r.start_datetime).toLocaleString("en-IN")}</span>` : ""}
          ${r.amount ? `<span><i class="fas fa-rupee-sign"></i> ${r.amount}</span>` : ""}
        </div>
        ${r.notes ? `<div class="td-res-notes">${escapeHtml(r.notes)}</div>` : ""}
      </div>
      <span class="td-res-status" style="color:${STATUS_COLORS[r.status] || "#999"}">${r.status}</span>
      <button class="td-res-del" data-action="delete-td-reservation" data-id="${r.id}" title="Delete"><i class="fas fa-trash"></i></button>
    </div>
  `,
    )
    .join("");
}

async function addTdReservation() {
  if (!_tdCurrentTrip) return;
  const body = {
    trip_id: _tdCurrentTrip.id,
    title: document.getElementById("tdResTitle").value.trim(),
    res_type: document.getElementById("tdResType").value,
    status: document.getElementById("tdResStatus").value,
    provider: document.getElementById("tdResProvider").value.trim() || null,
    confirmation_code:
      document.getElementById("tdResCode").value.trim() || null,
    start_datetime: document.getElementById("tdResStart").value || null,
    end_datetime: document.getElementById("tdResEnd").value || null,
    amount: parseFloat(document.getElementById("tdResAmount").value) || null,
    location: document.getElementById("tdResLocation").value.trim() || null,
    notes: document.getElementById("tdResNotes").value.trim() || null,
  };
  if (!body.title) return showToast("Reservation title is required", "error");
  try {
    const res = await fetch(`${API_BASE}/api/reservations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      closeTdModal("tdAddResModal");
      document.getElementById("tdAddResForm").reset();
      showToast("Reservation added!", "success");
      await openTdTrip(_tdCurrentTrip.id);
    }
  } catch (e) {
    showToast("Failed to add reservation", "error");
  }
}

async function deleteTdReservation(resId) {
  try {
    await fetch(`${API_BASE}/api/reservations/${resId}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
    });
    await openTdTrip(_tdCurrentTrip.id);
  } catch (e) {
    console.error("deleteRes", e);
  }
}

/* ─── Budget ─── */

function renderTdBudget() {
  if (!_tdCurrentTrip) return;
  const trip = _tdCurrentTrip;
  const budget = trip.budget_total || 0;
  const places = trip.places || [];
  const reservations = trip.reservations || [];

  // Calculate estimated spend
  const placeCost = places.reduce((s, p) => s + (p.estimated_cost || 0), 0);
  const resCost = reservations.reduce((s, r) => s + (r.amount || 0), 0);
  const totalSpent = placeCost + resCost;
  const remaining = budget - totalSpent;

  document.getElementById("tdBudgetTotal").textContent =
    `₹${budget.toLocaleString("en-IN")}`;
  document.getElementById("tdBudgetSpent").textContent =
    `₹${totalSpent.toLocaleString("en-IN")}`;
  const remEl = document.getElementById("tdBudgetRemaining");
  remEl.textContent = `₹${remaining.toLocaleString("en-IN")}`;
  remEl.style.color = remaining < 0 ? "#e74c3c" : "#27ae60";

  // Draw pie chart
  drawTdPieChart(places, reservations);
  // Draw bar chart
  drawTdBarChart(trip);
}

function drawTdPieChart(places, reservations) {
  const canvas = document.getElementById("tdBudgetPieChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const w = canvas.offsetWidth,
    h = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);

  // Aggregate by category
  const cats = {};
  places.forEach((p) => {
    if (p.estimated_cost) {
      const c = p.category || "other";
      cats[c] = (cats[c] || 0) + p.estimated_cost;
    }
  });
  reservations.forEach((r) => {
    if (r.amount) {
      const c = r.res_type || "other";
      cats[c] = (cats[c] || 0) + r.amount;
    }
  });

  const entries = Object.entries(cats);
  if (!entries.length) {
    ctx.fillStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--text-muted")
        .trim() || "#94a3b8";
    ctx.font = "500 14px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No spending data yet", w / 2, h / 2);
    return;
  }

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const colors = [
    "#667eea",
    "#e74c3c",
    "#2ecc71",
    "#f39c12",
    "#764ba2",
    "#1abc9c",
    "#3498db",
    "#e67e22",
  ];
  const cx = w / 2,
    cy = h / 2;
  const outerR = Math.min(cx, cy) - 30;
  const innerR = outerR * 0.55; // Donut
  let startAngle = -Math.PI / 2;

  entries.forEach(([cat, amount], i) => {
    const sliceAngle = (amount / total) * 2 * Math.PI;
    const color = colors[i % colors.length];

    // Draw donut slice
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, color + "cc");
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle separator
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    const midAngle = startAngle + sliceAngle / 2;
    const labelR = outerR + 18;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    if (sliceAngle > 0.3) {
      ctx.fillStyle =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--text-secondary")
          .trim() || "#94a3b8";
      ctx.font = "600 10px Poppins, sans-serif";
      ctx.textAlign =
        midAngle > Math.PI / 2 && midAngle < 1.5 * Math.PI ? "right" : "left";
      ctx.fillText(`${cat} ₹${amount.toLocaleString("en-IN")}`, lx, ly);
    }
    startAngle += sliceAngle;
  });

  // Center text
  ctx.fillStyle =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--text-primary")
      .trim() || "#f1f5f9";
  ctx.font = "800 16px Poppins, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`₹${total.toLocaleString("en-IN")}`, cx, cy - 2);
  ctx.fillStyle =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--text-muted")
      .trim() || "#94a3b8";
  ctx.font = "500 10px Poppins, sans-serif";
  ctx.fillText("Total Spent", cx, cy + 14);
}

function drawTdBarChart(trip) {
  const canvas = document.getElementById("tdBudgetBarChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const w = canvas.offsetWidth,
    h = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);

  const days = trip.days || [];
  if (!days.length) {
    ctx.fillStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--text-muted")
        .trim() || "#94a3b8";
    ctx.font = "500 14px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Add places with costs to see daily spending", w / 2, h / 2);
    return;
  }

  const daySpend = days.map((d) => {
    const cost = (d.places || []).reduce(
      (s, p) => s + (p.estimated_cost || 0),
      0,
    );
    return { label: `Day ${d.day_number}`, cost };
  });

  const maxCost = Math.max(...daySpend.map((d) => d.cost), 1);
  const padding = { top: 20, right: 20, bottom: 35, left: 50 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const barWidth = Math.min(44, chartW / daySpend.length - 12);

  // Grid lines
  const gridLines = 4;
  ctx.strokeStyle =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--border-color")
      .trim() || "rgba(255,255,255,0.06)";
  ctx.lineWidth = 0.5;
  const mutedColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--text-muted")
      .trim() || "#94a3b8";
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = mutedColor;
    ctx.font = "500 9px Poppins, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(
      `₹${Math.round(maxCost - (maxCost / gridLines) * i)}`,
      padding.left - 6,
      y + 3,
    );
  }

  daySpend.forEach((d, i) => {
    const barH = (d.cost / maxCost) * chartH;
    const x =
      padding.left +
      (chartW / daySpend.length) * i +
      (chartW / daySpend.length - barWidth) / 2;
    const y = padding.top + chartH - barH;

    // Rounded bar with gradient
    const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
    grad.addColorStop(0, "#667eea");
    grad.addColorStop(1, "#764ba2");
    ctx.fillStyle = grad;
    const r = Math.min(6, barWidth / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barWidth - r, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
    ctx.lineTo(x + barWidth, padding.top + chartH);
    ctx.lineTo(x, padding.top + chartH);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();

    // Glow effect
    ctx.shadowColor = "rgba(102,126,234,0.3)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Label
    ctx.fillStyle = mutedColor;
    ctx.font = "600 9px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(d.label, x + barWidth / 2, padding.top + chartH + 16);

    // Value on top
    if (d.cost > 0) {
      ctx.fillStyle =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--text-primary")
          .trim() || "#f1f5f9";
      ctx.font = "700 9px Poppins, sans-serif";
      ctx.fillText(
        `₹${d.cost.toLocaleString("en-IN")}`,
        x + barWidth / 2,
        y - 6,
      );
    }
  });
}

/* ─── Photos ─── */

function openTdLightbox(url) {
  let lb = document.getElementById("tdLightbox");
  if (!lb) {
    lb = document.createElement("div");
    lb.id = "tdLightbox";
    lb.className = "td-lightbox";
    lb.innerHTML =
      '<button class="td-lightbox-close"><i class="fas fa-times"></i></button><img src="" alt="Photo">';
    lb.addEventListener("click", (e) => {
      if (e.target === lb || e.target.closest(".td-lightbox-close")) {
        lb.classList.remove("active");
        setTimeout(() => (lb.style.display = "none"), 300);
      }
    });
    document.body.appendChild(lb);
  }
  lb.querySelector("img").src = url;
  lb.style.display = "flex";
  requestAnimationFrame(() => lb.classList.add("active"));
}

function renderTdPhotos() {
  if (!_tdCurrentTrip) return;
  const grid = document.getElementById("tdPhotosGrid");
  const photos = _tdCurrentTrip.photos || [];

  if (!photos.length) {
    grid.innerHTML =
      '<div class="td-empty-mini"><i class="fas fa-camera"></i><p>No photos yet — capture your memories!</p></div>';
    return;
  }

  grid.innerHTML = photos
    .map(
      (p) => `
    <div class="td-photo-card">
      <img src="${API_BASE}${p.url}" alt="${escapeHtml(p.caption || p.original_name)}" loading="lazy" data-action="open-td-lightbox" data-url="${API_BASE}${p.url}">
      <div class="td-photo-overlay">
        <span class="td-photo-caption">${escapeHtml(p.caption || p.original_name)}</span>
        <button class="td-photo-del" data-action="delete-td-photo" data-id="${p.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `,
    )
    .join("");
}

async function handleTdPhotoUpload(e) {
  if (!_tdCurrentTrip) return;
  const files = e.target.files;
  if (!files.length) return;

  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("trip_id", _tdCurrentTrip.id);
    try {
      await fetch(`${API_BASE}/api/uploads/photos`, {
        method: "POST",
        headers: { "X-CSRFToken": getCSRFToken() },
        body: fd,
      });
    } catch (err) {
      console.error("photo upload", err);
    }
  }
  showToast(`${files.length} photo(s) uploaded!`, "success");
  e.target.value = "";
  await openTdTrip(_tdCurrentTrip.id);
}

async function deleteTdPhoto(photoId) {
  try {
    await fetch(`${API_BASE}/api/uploads/photos/${photoId}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
    });
    await openTdTrip(_tdCurrentTrip.id);
  } catch (e) {
    console.error("deleteTdPhoto", e);
  }
}

/* ─── Documents ─── */

function renderTdDocs() {
  if (!_tdCurrentTrip) return;
  const grid = document.getElementById("tdDocsGrid");

  // Docs come from /api/uploads/documents — filter by trip
  fetch(`${API_BASE}/api/uploads/documents`)
    .then((r) => r.json())
    .then((data) => {
      const docs = (data.documents || []).filter(
        (d) => d.trip_id === _tdCurrentTrip.id || !d.trip_id,
      );
      if (!docs.length) {
        grid.innerHTML =
          '<div class="td-empty-mini"><i class="fas fa-file-alt"></i><p>Store passports, visas, tickets & insurance</p></div>';
        return;
      }
      const TYPE_ICONS = {
        passport: "fa-passport",
        visa: "fa-stamp",
        insurance: "fa-shield-alt",
        ticket: "fa-ticket-alt",
        other: "fa-file",
      };
      grid.innerHTML = docs
        .map(
          (d) => `
        <div class="td-doc-card">
          <div class="td-doc-icon"><i class="fas ${TYPE_ICONS[d.doc_type] || "fa-file"}"></i></div>
          <div class="td-doc-info">
            <span class="td-doc-title">${escapeHtml(d.title || d.original_name)}</span>
            <span class="td-doc-type">${d.doc_type || "document"}</span>
            ${d.expiry_date ? `<span class="td-doc-expiry"><i class="fas fa-calendar"></i> Expires: ${d.expiry_date}</span>` : ""}
          </div>
          <div class="td-doc-actions">
            <a href="${API_BASE}${d.url}" target="_blank" class="td-doc-act"><i class="fas fa-download"></i></a>
            <button class="td-doc-act" data-action="delete-td-doc" data-id="${d.id}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `,
        )
        .join("");
    })
    .catch(() => {});
}

async function handleTdDocUpload(e) {
  if (!_tdCurrentTrip) return;
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("trip_id", _tdCurrentTrip.id);
  fd.append("doc_type", "other");
  fd.append("title", file.name);
  try {
    await fetch(`${API_BASE}/api/uploads/documents`, {
      method: "POST",
      headers: { "X-CSRFToken": getCSRFToken() },
      body: fd,
    });
    showToast("Document uploaded!", "success");
    e.target.value = "";
    renderTdDocs();
  } catch (err) {
    showToast("Upload failed", "error");
  }
}

async function deleteTdDoc(docId) {
  try {
    await fetch(`${API_BASE}/api/uploads/documents/${docId}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
    });
    renderTdDocs();
  } catch (e) {
    console.error("deleteTdDoc", e);
  }
}

/* ─── Companions ─── */

function renderTdCompanions() {
  if (!_tdCurrentTrip) return;
  const list = document.getElementById("tdCompList");
  const companions = _tdCurrentTrip.companions || [];

  if (!companions.length) {
    list.innerHTML =
      '<div class="td-empty-mini"><i class="fas fa-users"></i><p>Add your travel buddies!</p></div>';
    return;
  }

  list.innerHTML = companions
    .map(
      (c) => `
    <div class="td-comp-card">
      <div class="td-comp-avatar" style="background:${c.avatar_color || "#667eea"}">${(c.name || "?")[0].toUpperCase()}</div>
      <div class="td-comp-info">
        <span class="td-comp-name">${escapeHtml(c.name)}</span>
        <span class="td-comp-role">${c.role || "traveler"}</span>
        ${c.email ? `<span class="td-comp-email"><i class="fas fa-envelope"></i> ${escapeHtml(c.email)}</span>` : ""}
        ${c.phone ? `<span class="td-comp-phone"><i class="fas fa-phone"></i> ${c.phone}</span>` : ""}
      </div>
      <button class="td-comp-del" data-action="delete-td-companion" data-id="${c.id}"><i class="fas fa-trash"></i></button>
    </div>
  `,
    )
    .join("");
}

async function addTdCompanion() {
  if (!_tdCurrentTrip) return;
  const body = {
    name: document.getElementById("tdCompName").value.trim(),
    email: document.getElementById("tdCompEmail").value.trim() || null,
    phone: document.getElementById("tdCompPhone").value.trim() || null,
    role: document.getElementById("tdCompRole").value,
  };
  if (!body.name) return showToast("Name is required", "error");
  try {
    const res = await fetch(
      `${API_BASE}/api/trips/planner/${_tdCurrentTrip.id}/companions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        body: JSON.stringify(body),
      },
    );
    if (res.ok) {
      closeTdModal("tdAddCompModal");
      document.getElementById("tdAddCompForm").reset();
      showToast("Companion added!", "success");
      await openTdTrip(_tdCurrentTrip.id);
    }
  } catch (e) {
    showToast("Failed to add companion", "error");
  }
}

async function deleteTdCompanion(compId) {
  if (!_tdCurrentTrip) return;
  try {
    await fetch(
      `${API_BASE}/api/trips/planner/${_tdCurrentTrip.id}/companions/${compId}`,
      {
        method: "DELETE",
        headers: { "X-CSRFToken": getCSRFToken() },
      },
    );
    await openTdTrip(_tdCurrentTrip.id);
  } catch (e) {
    console.error("deleteComp", e);
  }
}

/* ─── Templates ─── */

async function loadTdTemplates(category) {
  const grid = document.getElementById("tdTplGrid");
  try {
    const url =
      category && category !== "all"
        ? `${API_BASE}/api/templates?category=${category}`
        : `${API_BASE}/api/templates`;
    const res = await fetch(url);
    const data = await res.json();
    const templates = data.templates || [];

    if (!templates.length) {
      grid.innerHTML =
        '<div class="td-empty-mini"><i class="fas fa-magic"></i><p>No templates found for this category</p></div>';
      return;
    }

    const CAT_ICONS = {
      honeymoon: "fa-heart",
      family: "fa-users",
      adventure: "fa-mountain",
      budget: "fa-piggy-bank",
      luxury: "fa-gem",
      cultural: "fa-landmark",
    };

    grid.innerHTML = templates
      .map(
        (t) => `
      <div class="td-tpl-card">
        <div class="td-tpl-badge"><i class="fas ${CAT_ICONS[t.category] || "fa-star"}"></i> ${t.category || "general"}</div>
        <h4 class="td-tpl-title">${escapeHtml(t.title)}</h4>
        <p class="td-tpl-dest"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(t.destination)} · ${t.num_days} days</p>
        <p class="td-tpl-desc">${escapeHtml(t.description || "")}</p>
        <button class="btn-neon-sm" data-action="clone-td-template" data-id="${t.id}"><i class="fas fa-copy"></i> Use Template</button>
      </div>
    `,
      )
      .join("");
  } catch (e) {
    grid.innerHTML =
      '<div class="td-empty-mini"><p>Failed to load templates</p></div>';
  }
}

async function cloneTdTemplate(templateId) {
  try {
    const res = await fetch(`${API_BASE}/api/templates/${templateId}/clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      closeTdModal("tdTemplatesModal");
      showToast("Trip created from template! 🎉", "success");
      await loadTdTrips();
      openTdTrip(data.trip.id);
    }
  } catch (e) {
    showToast("Failed to clone template", "error");
  }
}

/* ─── Stats ─── */

async function loadTdStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) return;
    const data = await res.json();
    const s = data.stats;

    document.getElementById("tdStatTrips").textContent = s.trips.total;
    document.getElementById("tdStatDests").textContent = s.destinations_visited;
    document.getElementById("tdStatDays").textContent = s.total_travel_days;
    document.getElementById("tdStatPlaces").textContent = s.places_visited;
    document.getElementById("tdStatPhotos").textContent = s.photos_uploaded;
    document.getElementById("tdStatSpent").textContent =
      `₹${s.total_spent.toLocaleString("en-IN")}`;

    // Top destinations
    const topDestsEl = document.getElementById("tdTopDests");
    if (s.top_destinations.length) {
      topDestsEl.innerHTML = s.top_destinations
        .map(
          (d) =>
            `<div class="td-top-dest"><span class="td-top-dest-name">${escapeHtml(d.destination)}</span><span class="td-top-dest-count">${d.trips} trip(s)</span></div>`,
        )
        .join("");
    } else {
      topDestsEl.innerHTML = '<p class="td-muted">No trips yet</p>';
    }

    // Spending chart
    const canvas = document.getElementById("tdStatsSpendingChart");
    if (canvas && Object.keys(s.spending_breakdown).length) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const entries = Object.entries(s.spending_breakdown);
      const total = entries.reduce((sum, [, v]) => sum + v, 0);
      const colors = [
        "#e74c3c",
        "#3498db",
        "#2ecc71",
        "#f39c12",
        "#9b59b6",
        "#1abc9c",
        "#e67e22",
      ];
      let startAngle = -Math.PI / 2;
      const cx = canvas.width / 2,
        cy = canvas.height / 2,
        r = Math.min(cx, cy) - 30;
      entries.forEach(([cat, amt], i) => {
        const slice = (amt / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, startAngle + slice);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        const mid = startAngle + slice / 2;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          cat,
          cx + r * 0.6 * Math.cos(mid),
          cy + r * 0.6 * Math.sin(mid),
        );
        startAngle += slice;
      });
    }
  } catch (e) {
    console.error("loadTdStats", e);
  }
}

function scrollToSection(id) {
  // If the router is available, use it to navigate to the correct route
  if (window.appRouter && window.appRouter.ROUTE_MAP[id]) {
    const info = window.appRouter.ROUTE_MAP[id];
    window.appRouter.navigateTo(info.route, { scrollTo: info.scrollTo || id });
    return;
  }
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Briefly flash the section
    el.style.transition = "box-shadow 0.5s";
    el.style.boxShadow = "0 0 0 4px rgba(102,126,234,0.3)";
    setTimeout(() => {
      el.style.boxShadow = "none";
    }, 1500);
  }
}

// ═══════════════════════════════════════════════════════════════
// SMART DESTINATION HUB – One search, everything you need
// ═══════════════════════════════════════════════════════════════
let _shubAbort = null; // AbortController for in-flight API calls
let _shubAcIdx = -1; // autocomplete highlight index

// ── Destination photo map (reliable Unsplash URLs, avoids API flakiness) ──
const SHUB_PHOTOS = {
  goa: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=960&q=80",
  jaipur:
    "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=960&q=80",
  manali:
    "https://images.unsplash.com/photo-1626621331169-5f34be280ed9?w=960&q=80",
  kerala:
    "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=960&q=80",
  varanasi:
    "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=960&q=80",
  udaipur:
    "https://images.unsplash.com/photo-1597074866923-dc0589150642?w=960&q=80",
  mumbai:
    "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=960&q=80",
  delhi:
    "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=960&q=80",
  agra: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=960&q=80",
  shimla:
    "https://images.unsplash.com/photo-1597074866923-dc0589150642?w=960&q=80",
  rishikesh:
    "https://images.unsplash.com/photo-1583396060268-1c2f9e6f6e94?w=960&q=80",
  kolkata:
    "https://images.unsplash.com/photo-1558431382-27e303142255?w=960&q=80",
  bangalore:
    "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=960&q=80",
  chennai:
    "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=960&q=80",
  hyderabad:
    "https://images.unsplash.com/photo-1572435555646-7ad9a149ad91?w=960&q=80",
  amritsar:
    "https://images.unsplash.com/photo-1609947017136-9daf32a55b94?w=960&q=80",
  darjeeling:
    "https://images.unsplash.com/photo-1622308644420-72e06be2bb68?w=960&q=80",
  mysore:
    "https://images.unsplash.com/photo-1600100397608-fed1e4e077cd?w=960&q=80",
  leh: "https://images.unsplash.com/photo-1626015365107-43a8e9a1c72a?w=960&q=80",
  _default:
    "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=960&q=80",
};

// Destination taglines
const SHUB_TAGLINES = {
  goa: "Sun, sand & vibrant nightlife",
  jaipur: "The Pink City of royal heritage",
  manali: "Mountain paradise in the Himalayas",
  kerala: "God's own country — backwaters & spice",
  varanasi: "India's oldest living city on the Ganges",
  udaipur: "City of Lakes & Rajput grandeur",
  mumbai: "The city that never sleeps",
  delhi: "Where ancient history meets modernity",
  agra: "Home of the Taj Mahal",
  shimla: "Queen of the Hills",
  rishikesh: "Yoga capital of the world",
  kolkata: "City of Joy & culture",
  bangalore: "India's Silicon Valley garden city",
  chennai: "Gateway to South India",
  hyderabad: "City of Pearls & biryanis",
  amritsar: "The Golden Temple city",
  darjeeling: "Himalayan tea gardens & toy trains",
  mysore: "Royal City of sandalwood & silk",
  leh: "High-altitude desert wonderland",
};

function initSmartHub() {
  const overlay = document.getElementById("smartHubOverlay");
  if (!overlay) return;

  const closeBtn = document.getElementById("smartHubClose");
  const goBtn = document.getElementById("smartHubGo");
  const input = document.getElementById("smartHubInput");
  const acBox = document.getElementById("smartHubAc");
  const chips = overlay.querySelectorAll(".smart-hub-chip");

  // Close handlers
  if (closeBtn) closeBtn.addEventListener("click", closeSmartHub);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSmartHub();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open"))
      closeSmartHub();
  });

  // Go button
  if (goBtn)
    goBtn.addEventListener("click", () => {
      const v = input ? input.value.trim() : "";
      if (v) smartHubExplore(v);
    });

  // Text input: autocomplete + Enter
  if (input) {
    input.addEventListener("input", () => shubAutocomplete(input.value));
    input.addEventListener("keydown", (e) => {
      const items = acBox ? acBox.querySelectorAll(".shub-ac-item") : [];
      if (e.key === "ArrowDown") {
        e.preventDefault();
        _shubAcIdx = Math.min(_shubAcIdx + 1, items.length - 1);
        shubHighlightAc(items);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        _shubAcIdx = Math.max(_shubAcIdx - 1, 0);
        shubHighlightAc(items);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (_shubAcIdx >= 0 && items[_shubAcIdx]) {
          input.value = items[_shubAcIdx].dataset.dest;
          shubCloseAc();
        }
        if (input.value.trim()) smartHubExplore(input.value.trim());
      }
    });
    // Close AC on outside click
    document.addEventListener("click", (e) => {
      if (acBox && !acBox.contains(e.target) && e.target !== input)
        shubCloseAc();
    });
  }

  // Popular destination chips
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const dest = chip.dataset.dest;
      if (input) input.value = dest;
      shubCloseAc();
      smartHubExplore(dest);
    });
  });

  // Populate recent searches in intro
  shubPopulateRecent();
}

/** Autocomplete: fuzzy-filter DEST_COORDS labels */
function shubAutocomplete(query) {
  const acBox = document.getElementById("smartHubAc");
  if (!acBox) return;
  _shubAcIdx = -1;
  const q = (query || "").trim().toLowerCase();
  if (!q || q.length < 1 || typeof DEST_COORDS === "undefined") {
    acBox.innerHTML = "";
    acBox.style.display = "none";
    return;
  }

  const matches = [];
  for (const [key, d] of Object.entries(DEST_COORDS)) {
    const label = d.label || key;
    if (label.toLowerCase().includes(q)) {
      matches.push({ key, label });
    }
  }
  // Sort: starts-with first, then alphabetical
  matches.sort((a, b) => {
    const aStarts = a.label.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.label.toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts || a.label.localeCompare(b.label);
  });

  if (!matches.length) {
    acBox.innerHTML =
      '<div class="shub-ac-empty">No matching destinations — press Enter to search anyway</div>';
    acBox.style.display = "block";
    return;
  }

  acBox.innerHTML = matches
    .slice(0, 8)
    .map((m, i) => {
      // Highlight matching substring
      const idx = m.label.toLowerCase().indexOf(q);
      const before = m.label.slice(0, idx);
      const match = m.label.slice(idx, idx + q.length);
      const after = m.label.slice(idx + q.length);
      const tagline = SHUB_TAGLINES[m.key.toLowerCase()] || "";
      return `<div class="shub-ac-item" data-dest="${m.label}" data-idx="${i}">
      <i class="fas fa-map-marker-alt" style="color:var(--primary);margin-right:8px;font-size:0.8rem"></i>
      <div>
        <div class="shub-ac-name">${before}<strong>${match}</strong>${after}</div>
        ${tagline ? `<div class="shub-ac-tagline">${tagline}</div>` : ""}
      </div>
    </div>`;
    })
    .join("");
  acBox.style.display = "block";

  // Click handlers
  acBox.querySelectorAll(".shub-ac-item").forEach((item) => {
    item.addEventListener("click", () => {
      const input = document.getElementById("smartHubInput");
      if (input) input.value = item.dataset.dest;
      shubCloseAc();
      smartHubExplore(item.dataset.dest);
    });
  });
}

function shubHighlightAc(items) {
  items.forEach((it, i) => it.classList.toggle("active", i === _shubAcIdx));
  if (items[_shubAcIdx]) items[_shubAcIdx].scrollIntoView({ block: "nearest" });
}

function shubCloseAc() {
  const acBox = document.getElementById("smartHubAc");
  if (acBox) {
    acBox.innerHTML = "";
    acBox.style.display = "none";
  }
  _shubAcIdx = -1;
}

/** Populate recent searches chips in the intro section */
function shubPopulateRecent() {
  const recentWrap = document.getElementById("smartHubRecent");
  const chipsEl = document.getElementById("smartHubRecentChips");
  if (!recentWrap || !chipsEl) return;
  const recent = getRecentShubSearches();
  if (!recent.length) {
    recentWrap.style.display = "none";
    return;
  }

  recentWrap.style.display = "";
  chipsEl.innerHTML = recent
    .slice(0, 6)
    .map(
      (dest) =>
        `<button class="smart-hub-chip shub-recent-chip" data-dest="${dest}"><i class="fas fa-history" style="font-size:0.7rem;opacity:0.5;margin-right:4px"></i>${dest}</button>`,
    )
    .join("");

  chipsEl.querySelectorAll(".shub-recent-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const input = document.getElementById("smartHubInput");
      if (input) input.value = chip.dataset.dest;
      shubCloseAc();
      smartHubExplore(chip.dataset.dest);
    });
  });
}

function openSmartHub(preselect) {
  const overlay = document.getElementById("smartHubOverlay");
  if (!overlay) return;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  // Show intro, hide loading & results
  const introEl = overlay.querySelector(".smart-hub-intro");
  const loadEl = overlay.querySelector(".smart-hub-loading");
  const resultsEl = overlay.querySelector(".smart-hub-results");
  if (introEl) introEl.style.display = "";
  if (loadEl) loadEl.style.display = "none";
  if (resultsEl) resultsEl.style.display = "none";

  // Refresh recent searches
  shubPopulateRecent();

  // Reset input
  const input = document.getElementById("smartHubInput");
  if (input && !preselect) {
    input.value = "";
    input.focus();
  }

  // Pre-select destination if provided
  if (preselect) {
    if (input) input.value = preselect;
    smartHubExplore(preselect);
  }
}

function closeSmartHub() {
  const overlay = document.getElementById("smartHubOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  if (_shubAbort) {
    _shubAbort.abort();
    _shubAbort = null;
  }
  shubCloseAc();
}

/** Look up the DEST_COORDS key for a label (e.g., "Goa" → "goa") */
function destKeyByLabel(label) {
  if (!label || typeof DEST_COORDS === "undefined") return null;
  const lc = label.toLowerCase();
  for (const [key, d] of Object.entries(DEST_COORDS)) {
    if (d.label.toLowerCase() === lc || key.toLowerCase() === lc) return key;
  }
  return null;
}

/** Resolve a banner photo URL for a destination — tries hardcoded map first, then Unsplash API */
function shubGetPhoto(dest) {
  const key = (dest || "").toLowerCase().replace(/\s+/g, "");
  if (SHUB_PHOTOS[key]) return SHUB_PHOTOS[key];
  for (const [k, url] of Object.entries(SHUB_PHOTOS)) {
    if (k !== "_default" && key.includes(k)) return url;
  }
  return SHUB_PHOTOS._default;
}

/** Async photo fetch — tries Unsplash hero API, falls back to hardcoded */
async function shubFetchPhoto(dest, signal) {
  // If hardcoded photo exists (not the default), use it immediately
  const hardcoded = shubGetPhoto(dest);
  if (hardcoded !== SHUB_PHOTOS._default) return hardcoded;
  // Try Unsplash API for unknown destinations
  try {
    const res = await fetch(
      `${API_BASE}/api/images/hero/${encodeURIComponent(dest)}`,
      { signal },
    );
    if (res.ok) {
      const data = await res.json();
      if (data.image && data.image.url_regular) return data.image.url_regular;
    }
  } catch (_) {
    /* fallback silently */
  }
  return hardcoded;
}

async function smartHubExplore(dest) {
  if (!dest) return;
  const overlay = document.getElementById("smartHubOverlay");
  if (!overlay) return;

  // Set chat destination context so AI knows what we're exploring
  if (typeof setChatContext === "function") setChatContext(dest);

  const introEl = overlay.querySelector(".smart-hub-intro");
  const loadEl = overlay.querySelector(".smart-hub-loading");
  const resultsEl = overlay.querySelector(".smart-hub-results");

  // Switch to loading state
  if (introEl) introEl.style.display = "none";
  if (loadEl) loadEl.style.display = "";
  if (resultsEl) resultsEl.style.display = "none";

  // Update loading label
  const loadDest = document.getElementById("smartHubLoadDest");
  if (loadDest) loadDest.textContent = dest;

  // Reset step indicators
  const steps = loadEl ? loadEl.querySelectorAll(".load-step") : [];
  steps.forEach((s) => {
    s.classList.remove("done", "error");
    s.classList.add("loading");
  });

  // Save to recent searches
  saveRecentShubSearch(dest);

  // Cancel previous if still running
  if (_shubAbort) _shubAbort.abort();
  _shubAbort = new AbortController();
  const signal = _shubAbort.signal;

  // Look up coordinates for Places API
  const key = destKeyByLabel(dest);
  const coords = key && DEST_COORDS[key] ? DEST_COORDS[key] : null;

  // Step index map (matches data-step attributes)
  const stepByName = {};
  steps.forEach((s, i) => {
    stepByName[s.dataset.step] = i;
  });

  // Fire all 6 API calls in parallel (weather, safety, budget, places, news, AI summary)
  const apis = {
    weather: fetch(`${API_BASE}/api/weather/${encodeURIComponent(dest)}`, {
      signal,
    }).then((r) => r.json()),
    safety: fetch(`${API_BASE}/api/safety/${encodeURIComponent(dest)}`, {
      signal,
    }).then((r) => r.json()),
    budget: fetch(`${API_BASE}/api/budget/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        destination: dest,
        num_days: 3,
        family_size: 2,
        travel_class: "economy",
      }),
      signal,
    }).then((r) => r.json()),
    places: coords
      ? fetch(
          `${API_BASE}/api/places/search?lat=${coords.lat}&lon=${coords.lon}&limit=6`,
          { signal },
        ).then((r) => r.json())
      : Promise.resolve({ results: [] }),
    news: fetch(
      `${API_BASE}/api/news/travel?limit=5&destination=${encodeURIComponent(dest)}`,
      { signal },
    ).then((r) => r.json()),
    ai: fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        message: `Give a concise 2-3 sentence travel overview of ${dest}, India. Include the best time to visit and one unique highlight. Keep it under 60 words.`,
        mode: "ai",
        session_id: "shub_" + Date.now(),
      }),
      signal,
    })
      .then((r) => r.json())
      .catch(() => ({ reply: null })),
    photo: shubFetchPhoto(dest, signal),
  };

  const results = {};

  // Process each as it completes (photo is silent — no step indicator)
  const entries = Object.entries(apis);
  await Promise.allSettled(
    entries.map(async ([name, prom]) => {
      try {
        const data = await prom;
        results[name] = data;
        const si = stepByName[name];
        if (si !== undefined && steps[si]) {
          steps[si].classList.remove("loading");
          steps[si].classList.add("done");
        }
      } catch (err) {
        if (err.name === "AbortError") throw err;
        results[name] = { error: err.message };
        const si = stepByName[name];
        if (si !== undefined && steps[si]) {
          steps[si].classList.remove("loading");
          steps[si].classList.add("error");
        }
      }
    }),
  );

  // If aborted, don't render
  if (signal.aborted) return;

  // Render results
  renderSmartHubResults(dest, results);
}

function renderSmartHubResults(dest, data) {
  const overlay = document.getElementById("smartHubOverlay");
  if (!overlay) return;
  const loadEl = overlay.querySelector(".smart-hub-loading");
  const resultsEl = overlay.querySelector(".smart-hub-results");
  if (loadEl) loadEl.style.display = "none";
  if (resultsEl) resultsEl.style.display = "";

  // ── Photo Banner ──
  const bannerImg = document.getElementById("shubBannerImg");
  const bannerDest = document.getElementById("shubBannerDest");
  const bannerSub = document.getElementById("shubBannerSub");
  const bannerMeta = document.getElementById("shubBannerMeta");
  const photoBanner = document.getElementById("shubPhotoBanner");
  const photoUrl =
    typeof data.photo === "string" && data.photo
      ? data.photo
      : shubGetPhoto(dest);
  if (bannerImg) {
    bannerImg.src = photoUrl;
    bannerImg.alt = dest;
  }
  if (bannerDest) bannerDest.textContent = dest;
  if (bannerSub)
    bannerSub.textContent =
      SHUB_TAGLINES[(dest || "").toLowerCase()] || "Explore this destination";
  if (photoBanner) photoBanner.style.display = "";

  // Banner meta tags (weather summary + safety score quick glance)
  if (bannerMeta) {
    const metaTags = [];
    const w = data.weather && !data.weather.error ? data.weather : null;
    if (w) {
      const t = w.temperature_c ?? w.temperature;
      if (t !== undefined)
        metaTags.push(
          `<span class="shub-banner-tag"><i class="fas fa-thermometer-half"></i> ${Math.round(t)}°C</span>`,
        );
    }
    const s = data.safety && !data.safety.error ? data.safety : null;
    if (s) {
      const sc = s.overall_score ?? s.overall_safety ?? s.score;
      if (sc !== null && sc !== undefined) {
        const sc100 = Math.round(sc * 10);
        const cl = sc100 >= 65 ? "safe" : sc100 >= 40 ? "mod" : "warn";
        metaTags.push(
          `<span class="shub-banner-tag shub-tag-${cl}"><i class="fas fa-shield-alt"></i> Safety ${sc.toFixed(1)}/10</span>`,
        );
      }
    }
    metaTags.push(
      `<span class="shub-banner-tag"><i class="fas fa-calendar-alt"></i> ${new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>`,
    );
    bannerMeta.innerHTML = metaTags.join("");
  }

  // ── AI Summary ──
  const aiSummary = document.getElementById("shubAiSummary");
  const aiText = document.getElementById("shubAiText");
  if (aiSummary && aiText) {
    const reply = data.ai && data.ai.reply;
    if (reply) {
      aiText.textContent = reply;
      aiSummary.style.display = "";
    } else {
      aiSummary.style.display = "none";
    }
  }

  // ── Card renders ──
  renderShubWeather(data.weather);
  renderShubSafety(data.safety);
  renderShubBudget(data.budget);
  renderShubPlaces(data.places, dest);
  renderShubNews(data.news);

  // Re-trigger staggered card entrance animation
  resultsEl.querySelectorAll(".shub-card").forEach((card) => {
    card.style.animation = "none";
    void card.offsetHeight; // force reflow
    card.style.animation = "";
  });

  // Wire up quick action buttons in results
  resultsEl.querySelectorAll(".shub-action-btn").forEach((btn) => {
    // Remove old listeners by cloning
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener("click", () => {
      closeSmartHub();
      const target = fresh.dataset.section;
      const inputId = fresh.dataset.input;
      if (target) {
        scrollToSection(target);
        if (inputId) {
          setTimeout(() => {
            const inp = document.getElementById(inputId);
            if (inp) {
              inp.value = dest;
              inp.dispatchEvent(new Event("change"));
            }
          }, 500);
        }
      }
    });
  });
}

// ── Weather Card ─────────────────────────────────────────
function renderShubWeather(d) {
  const body = document.getElementById("shubWeatherBody");
  if (!body) return;
  if (!d || d.error) {
    body.innerHTML =
      '<p style="color:var(--text-muted);font-size:0.85rem">Weather data unavailable</p>';
    return;
  }
  // API returns flat: temperature_c, feels_like_c, wind_speed_kmh, humidity, description
  const temp = d.temperature_c ?? d.temperature ?? d.temp ?? "—";
  const desc = d.description || d.condition || "";
  const humidity = d.humidity ?? "—";
  const wind = d.wind_speed_kmh ?? d.wind_speed ?? d.wind ?? "—";
  const feelsLike = d.feels_like_c ?? d.feels_like ?? null;

  // Weather icon mapping
  const dl = desc.toLowerCase();
  let emoji = "🌤️";
  if (dl.includes("rain") || dl.includes("drizzle")) emoji = "🌧️";
  else if (dl.includes("cloud") || dl.includes("overcast")) emoji = "☁️";
  else if (dl.includes("clear") || dl.includes("sun") || dl.includes("fair"))
    emoji = "☀️";
  else if (dl.includes("snow")) emoji = "❄️";
  else if (dl.includes("storm") || dl.includes("thunder")) emoji = "⛈️";
  else if (dl.includes("mist") || dl.includes("fog") || dl.includes("haze"))
    emoji = "🌫️";

  body.innerHTML = `
    <div class="shub-weather-main">
      <span class="shub-weather-icon">${emoji}</span>
      <div>
        <div class="shub-weather-temp">${Math.round(temp)}°C</div>
        <div class="shub-weather-desc">${desc}</div>
      </div>
    </div>
    <div class="shub-weather-details">
      <span><i class="fas fa-tint"></i> ${humidity}%</span>
      <span><i class="fas fa-wind"></i> ${wind} km/h</span>
      ${feelsLike !== null ? `<span><i class="fas fa-thermometer-half"></i> Feels ${Math.round(feelsLike)}°</span>` : ""}
    </div>
  `;
}

// ── Safety Card ──────────────────────────────────────────
function renderShubSafety(d) {
  const body = document.getElementById("shubSafetyBody");
  if (!body) return;
  if (!d || d.error) {
    body.innerHTML =
      '<p style="color:var(--text-muted);font-size:0.85rem">Safety data unavailable</p>';
    return;
  }
  // API returns overall_score (0-10 scale), plus sub-scores and advisory string
  const rawScore =
    d.overall_score ?? d.safety_index ?? d.overall_safety ?? d.score ?? null;
  // Normalize: API gives 0-10, display as x/10 but use 0-100 range for color logic
  const score100 = rawScore !== null ? Math.round(rawScore * 10) : null;
  const displayScore = rawScore !== null ? rawScore.toFixed(1) : "—";

  let color = "#27ae60",
    label = "Safe";
  if (score100 !== null) {
    if (score100 < 40) {
      color = "#e74c3c";
      label = "Caution Advised";
    } else if (score100 < 65) {
      color = "#f39c12";
      label = "Moderate";
    } else {
      color = "#27ae60";
      label = "Safe";
    }
  }

  // Build sub-scores display
  const subScores = [];
  if (d.crime_score != null)
    subScores.push({ label: "Crime", val: d.crime_score });
  if (d.health_score != null)
    subScores.push({ label: "Health", val: d.health_score });
  if (d.infrastructure_score != null)
    subScores.push({ label: "Infra", val: d.infrastructure_score });
  if (d.tourist_friendliness != null)
    subScores.push({ label: "Tourist", val: d.tourist_friendliness });
  const subHTML = subScores.length
    ? `<div class="shub-safety-subs">${subScores
        .map(
          (s) =>
            `<div class="shub-safety-sub"><span>${s.label}</span><span class="shub-safety-sub-val">${s.val.toFixed(1)}</span></div>`,
        )
        .join("")}</div>`
    : "";

  // Advisory (API returns a single string, not an array)
  const advisory = d.advisory || "";
  const advisoryHTML = advisory
    ? `<div class="shub-safety-advisory">› ${advisory}</div>`
    : "";

  body.innerHTML = `
    <div class="shub-safety-score">
      <div class="shub-safety-badge" style="background:${color}">${displayScore}</div>
      <div>
        <div class="shub-safety-label">${label}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">out of 10</div>
      </div>
    </div>
    ${subHTML}
    ${advisoryHTML}
  `;
}

// ── Budget Card ──────────────────────────────────────────
function renderShubBudget(d) {
  const body = document.getElementById("shubBudgetBody");
  if (!body) return;
  if (!d || d.error) {
    body.innerHTML =
      '<p style="color:var(--text-muted);font-size:0.85rem">Budget data unavailable</p>';
    return;
  }
  // API returns FLAT fields: accommodation, food, transport, activities, miscellaneous, total
  // Build breakdown from the known category fields
  const budgetCategories = [
    { key: "accommodation", label: "Accommodation", icon: "fa-bed" },
    { key: "food", label: "Food & Dining", icon: "fa-utensils" },
    { key: "transport", label: "Transport", icon: "fa-car" },
    { key: "activities", label: "Activities", icon: "fa-hiking" },
    { key: "miscellaneous", label: "Miscellaneous", icon: "fa-ellipsis-h" },
  ];
  const total = d.total || d.total_estimated_cost || d.estimated_total || 0;
  const numDays = d.num_days || 3;
  const familySize = d.family_size || 2;
  const fmt = (v) => Number(v).toLocaleString("en-IN");

  const entries = budgetCategories
    .map((c) => ({ ...c, amt: Number(d[c.key]) || 0 }))
    .filter((c) => c.amt > 0);

  if (!entries.length) {
    body.innerHTML =
      '<p style="color:var(--text-muted);font-size:0.85rem">No budget data</p>';
    return;
  }

  let rows = entries
    .map((c) => {
      const pct = total > 0 ? Math.round((c.amt / total) * 100) : 50;
      return `<div class="shub-budget-row">
      <div class="shub-budget-row-top">
        <span class="shub-budget-cat"><i class="fas ${c.icon}"></i> ${c.label}</span>
        <span class="shub-budget-amt">₹${fmt(c.amt)}</span>
      </div>
      <div class="shub-budget-bar"><div class="shub-budget-bar-fill" style="width:${Math.min(pct, 100)}%"></div></div>
    </div>`;
    })
    .join("");

  if (total) {
    rows += `<div class="shub-budget-total-row">
      <span>Total <small>(${numDays} days, ${familySize} people)</small></span>
      <span class="shub-budget-total">₹${fmt(total)}</span>
    </div>`;
  }

  body.innerHTML = rows;
}

// ── Places Card ──────────────────────────────────────────
function renderShubPlaces(d, dest) {
  const body = document.getElementById("shubPlacesBody");
  if (!body) return;
  const places = d && (d.results || d.places || []);
  if (!places || !places.length) {
    body.innerHTML =
      '<p style="color:var(--text-muted);font-size:0.85rem">No places found</p>';
    return;
  }
  body.innerHTML = places
    .slice(0, 5)
    .map((p) => {
      const name = p.name || p.title || "Unknown";
      const cat = p.category || p.type || "";
      const rating = p.rating ?? null;
      const addr = p.address || p.location || "";
      const catLc = cat.toLowerCase();
      const icon =
        catLc.includes("restaurant") || catLc.includes("food")
          ? "fa-utensils"
          : catLc.includes("hotel") || catLc.includes("lodge")
            ? "fa-bed"
            : catLc.includes("museum") || catLc.includes("monument")
              ? "fa-landmark"
              : catLc.includes("park") || catLc.includes("garden")
                ? "fa-tree"
                : catLc.includes("temple") ||
                    catLc.includes("church") ||
                    catLc.includes("mosque")
                  ? "fa-place-of-worship"
                  : catLc.includes("shop") || catLc.includes("market")
                    ? "fa-store"
                    : "fa-map-pin";

      // Star rating
      let starsHtml = "";
      if (rating !== null && rating > 0) {
        const full = Math.floor(rating / 2); // Convert 10-scale to 5-star
        const normRating = rating <= 5 ? rating : rating / 2;
        const fullStars = Math.floor(normRating);
        const half = normRating - fullStars >= 0.3 ? 1 : 0;
        starsHtml = `<div class="shub-place-rating">`;
        for (let i = 0; i < fullStars; i++)
          starsHtml += '<i class="fas fa-star"></i>';
        if (half) starsHtml += '<i class="fas fa-star-half-alt"></i>';
        starsHtml += ` <span>${normRating.toFixed(1)}</span></div>`;
      }

      return `<div class="shub-place-item">
      <div class="shub-place-icon"><i class="fas ${icon}"></i></div>
      <div class="shub-place-info">
        <div class="shub-place-name">${name}</div>
        <div class="shub-place-cat">${cat}${addr ? ` · ${addr}` : ""}</div>
        ${starsHtml}
      </div>
    </div>`;
    })
    .join("");
}

// ── News Card ────────────────────────────────────────────
function renderShubNews(d) {
  const body = document.getElementById("shubNewsBody");
  if (!body) return;
  const articles = d && (d.articles || d.news || d.results || []);
  if (!articles || !articles.length) {
    body.innerHTML =
      '<p style="color:var(--text-muted);font-size:0.85rem">No travel news found</p>';
    return;
  }
  body.innerHTML = articles
    .slice(0, 4)
    .map((a) => {
      const title = a.title || "Untitled";
      const source = a.source || a.publisher || "";
      const url = a.url || a.link || "#";
      const date = a.published_at || a.publishedAt || a.date || "";
      let dateStr = "";
      if (date) {
        try {
          const d = new Date(date);
          dateStr = d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          });
        } catch (_) {
          dateStr = "";
        }
      }
      return `<div class="shub-news-item">
      <a href="${url}" target="_blank" rel="noopener">${title}</a>
      <div class="shub-news-meta">
        ${source ? `<span class="shub-news-source"><i class="fas fa-newspaper"></i> ${source}</span>` : ""}
        ${dateStr ? `<span class="shub-news-date"><i class="fas fa-clock"></i> ${dateStr}</span>` : ""}
      </div>
    </div>`;
    })
    .join("");
}

/** Save/retrieve recent Smart Hub searches */
function saveRecentShubSearch(dest) {
  try {
    let recent = JSON.parse(localStorage.getItem("shubRecent") || "[]");
    recent = recent.filter((d) => d !== dest);
    recent.unshift(dest);
    if (recent.length > 8) recent = recent.slice(0, 8);
    localStorage.setItem("shubRecent", JSON.stringify(recent));
  } catch (_) {
    /* ignore */
  }
}

function getRecentShubSearches() {
  try {
    return JSON.parse(localStorage.getItem("shubRecent") || "[]");
  } catch (_) {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// ENHANCED COMMAND PALETTE – Destination quick-explore + actions
// ═══════════════════════════════════════════════════════════════
function enhanceCommandPalette() {
  const overlay = document.getElementById("navSearchOverlay");
  const input = document.getElementById("navSearchInput");
  const resultsList = document.getElementById("navSearchResults");
  if (!overlay || !input || !resultsList) return;

  // Build destination command items
  function getDestCommands() {
    if (typeof DEST_COORDS === "undefined" || !DEST_COORDS) return [];
    return Object.values(DEST_COORDS).map((d) => ({
      type: "dest",
      label: `✈ Quick Explore: ${d.label}`,
      sublabel: "Weather + Safety + Budget + Places + News",
      iconClass: "fas fa-globe-asia",
      action: () => openSmartHub(d.label),
    }));
  }

  // Build action commands
  function getActionCommands() {
    return [
      {
        type: "action",
        label: "🔍 Smart Destination Hub",
        sublabel: "Search once, get everything",
        iconClass: "fas fa-search-plus",
        action: () => openSmartHub(),
      },
      {
        type: "action",
        label: "🤖 Ask AI Chatbot",
        sublabel: "Get AI travel advice",
        iconClass: "fas fa-robot",
        action: () => scrollToSection("chatbot"),
      },
      {
        type: "action",
        label: "📊 New Trip",
        sublabel: "Create a new trip plan",
        iconClass: "fas fa-plus-circle",
        action: () => {
          scrollToSection("tripDashboard");
          setTimeout(() => {
            const b = document.getElementById("tdNewTripBtn");
            if (b) b.click();
          }, 400);
        },
      },
      {
        type: "action",
        label: "⚖️ Compare Destinations",
        sublabel: "Side-by-side comparison",
        iconClass: "fas fa-columns",
        action: () => scrollToSection("compare"),
      },
      {
        type: "action",
        label: "💰 Budget Estimator",
        sublabel: "Plan your travel budget",
        iconClass: "fas fa-wallet",
        action: () => scrollToSection("budget"),
      },
      {
        type: "action",
        label: "🗓 Generate Itinerary",
        sublabel: "AI-powered day plans",
        iconClass: "fas fa-route",
        action: () => scrollToSection("itinerary"),
      },
      {
        type: "action",
        label: "🗺 Explore Map",
        sublabel: "Interactive map view",
        iconClass: "fas fa-map-marked-alt",
        action: () => scrollToSection("maps"),
      },
      {
        type: "action",
        label: "📰 Travel News",
        sublabel: "Latest travel updates",
        iconClass: "fas fa-newspaper",
        action: () => scrollToSection("news"),
      },
      {
        type: "action",
        label: "💱 Currency Converter",
        sublabel: "Exchange rate lookup",
        iconClass: "fas fa-coins",
        action: () => scrollToSection("currency"),
      },
      {
        type: "action",
        label: "🧳 Packing Checklist",
        sublabel: "Smart packing helper",
        iconClass: "fas fa-suitcase-rolling",
        action: () => scrollToSection("packingChecklist"),
      },
    ];
  }

  let enhancedHighlighted = -1;
  let enhancedItems = [];

  function renderEnhanced(filter) {
    const q = (filter || "").toLowerCase().trim();
    enhancedItems = [];

    if (!q) {
      // Show recent searches + action commands
      const recent =
        typeof getRecentShubSearches === "function"
          ? getRecentShubSearches()
          : [];
      if (recent.length) {
        recent.slice(0, 3).forEach((dest) => {
          enhancedItems.push({
            type: "recent",
            label: `🕐 ${dest}`,
            sublabel: "Quick Explore (recent)",
            iconClass: "fas fa-history",
            action: () => openSmartHub(dest),
          });
        });
      }
      enhancedItems.push(...getActionCommands());
      // Also add original nav section items
      document
        .querySelectorAll("#navLinks a[href^='#'], .nav-mega-menu a[href^='#']")
        .forEach((a) => {
          const href = a.getAttribute("href");
          const icon = a.querySelector("i");
          const iconClass = icon ? icon.className : "fas fa-link";
          const labelEl =
            a.querySelector(".nav-mega-label") || a.querySelector("span") || a;
          const label = labelEl.textContent.trim();
          if (
            label &&
            href &&
            !enhancedItems.some((i) => i.label.includes(label))
          ) {
            enhancedItems.push({ type: "nav", label, iconClass, href });
          }
        });
    } else {
      // Filter destinations
      const destCmds = getDestCommands().filter((i) =>
        i.label.toLowerCase().includes(q),
      );
      // Filter actions
      const actCmds = getActionCommands().filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.sublabel.toLowerCase().includes(q),
      );
      // Filter nav sections
      const navItems = [];
      document
        .querySelectorAll("#navLinks a[href^='#'], .nav-mega-menu a[href^='#']")
        .forEach((a) => {
          const href = a.getAttribute("href");
          const icon = a.querySelector("i");
          const iconClass = icon ? icon.className : "fas fa-link";
          const labelEl =
            a.querySelector(".nav-mega-label") || a.querySelector("span") || a;
          const label = labelEl.textContent.trim();
          if (label && href && label.toLowerCase().includes(q)) {
            navItems.push({ type: "nav", label, iconClass, href });
          }
        });
      // Destinations first, then actions, then nav
      enhancedItems = [...destCmds.slice(0, 5), ...actCmds, ...navItems];
    }

    if (!enhancedItems.length) {
      resultsList.innerHTML =
        '<li class="nav-search-empty">No results found</li>';
      enhancedHighlighted = -1;
      return;
    }

    resultsList.innerHTML = enhancedItems
      .map((item, idx) => {
        const sub = item.sublabel
          ? `<span style="font-size:0.72rem;color:var(--text-muted,#94a3b8);margin-left:8px">${item.sublabel}</span>`
          : "";
        if (item.href) {
          return `<li><a href="${item.href}" data-eidx="${idx}"><i class="${item.iconClass}"></i>${item.label}${sub}</a></li>`;
        }
        return `<li><a href="#" data-eidx="${idx}" data-action="true"><i class="${item.iconClass}"></i>${item.label}${sub}</a></li>`;
      })
      .join("");
    enhancedHighlighted = -1;
  }

  function enhancedKeydown(e) {
    const anchors = resultsList.querySelectorAll("a");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      enhancedHighlighted = Math.min(
        enhancedHighlighted + 1,
        anchors.length - 1,
      );
      anchors.forEach((a) => a.classList.remove("highlighted"));
      if (anchors[enhancedHighlighted]) {
        anchors[enhancedHighlighted].classList.add("highlighted");
        anchors[enhancedHighlighted].scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      enhancedHighlighted = Math.max(enhancedHighlighted - 1, 0);
      anchors.forEach((a) => a.classList.remove("highlighted"));
      if (anchors[enhancedHighlighted]) {
        anchors[enhancedHighlighted].classList.add("highlighted");
        anchors[enhancedHighlighted].scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (enhancedHighlighted >= 0 && anchors[enhancedHighlighted]) {
        anchors[enhancedHighlighted].click();
      }
    }
  }

  // ── Properly replace old listeners ──
  // Clone input to nuke all old listeners from initNavSearch
  const freshInput = input.cloneNode(true);
  input.parentNode.replaceChild(freshInput, input);
  // Re-bind with enhanced handlers only
  freshInput.addEventListener("input", () => renderEnhanced(freshInput.value));
  freshInput.addEventListener("keydown", enhancedKeydown);

  // Also handle Escape on the fresh input
  freshInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      overlay.classList.remove("open");
      freshInput.value = "";
      enhancedHighlighted = -1;
    }
  });

  // Handle action clicks (replace old listener by cloning resultsList)
  const freshResults = resultsList.cloneNode(false);
  resultsList.parentNode.replaceChild(freshResults, resultsList);
  freshResults.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    const idx = parseInt(a.dataset.eidx, 10);
    if (
      a.dataset.action === "true" &&
      enhancedItems[idx] &&
      enhancedItems[idx].action
    ) {
      e.preventDefault();
      overlay.classList.remove("open");
      freshInput.value = "";
      enhancedItems[idx].action();
    } else {
      // Regular nav link – just close
      overlay.classList.remove("open");
      freshInput.value = "";
    }
  });

  // Update local references (for renderEnhanced)
  // Use a reassigned pointer so renderEnhanced writes to correct element
  const resultsRef = freshResults;
  const origRender = renderEnhanced;
  // Patch renderEnhanced to use fresh resultsList
  // (Already referencing `resultsList` via closure — need to redirect)
  // Since we replaced in DOM, querySelector will get the new one:
  const actualResults = document.getElementById("navSearchResults")
    ? document.getElementById("navSearchResults")
    : freshResults;

  function openPalette() {
    overlay.classList.add("open");
    // Re-query in case DOM was modified
    const inp = document.getElementById("navSearchInput") || freshInput;
    const res = document.getElementById("navSearchResults") || freshResults;
    // Build results into correct element
    enhancedItems = [];
    enhancedHighlighted = -1;
    // Inline render to correct target
    renderEnhanced("");
    setTimeout(() => inp.focus(), 80);
  }

  function closePalette() {
    overlay.classList.remove("open");
    const inp = document.getElementById("navSearchInput") || freshInput;
    inp.value = "";
    enhancedHighlighted = -1;
  }

  // Override search trigger button (clone to remove old listener)
  const triggerBtn = document.getElementById("navSearchBtn");
  if (triggerBtn) {
    const newBtn = triggerBtn.cloneNode(true);
    triggerBtn.parentNode.replaceChild(newBtn, triggerBtn);
    newBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPalette();
    });
  }

  // Single Cmd+K handler — mark it so we only add once
  if (!window._enhancedCmdKBound) {
    window._enhancedCmdKBound = true;
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (overlay.classList.contains("open")) {
          closePalette();
        } else {
          openPalette();
        }
      }
      if (e.key === "Escape" && overlay.classList.contains("open")) {
        closePalette();
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// INIT Smart Hub + FAB + Enhanced Palette on DOM ready
// ═══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initSmartHub();
  // Enhance command palette after a short delay to ensure destinations are loaded
  setTimeout(enhanceCommandPalette, 1500);
});
