/* =======================================================
 * Time Travel - UI Effects - Stat counters, scroll reveal, dark mode, ripple, tooltips, cursor glow
 * ======================================================= */

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
