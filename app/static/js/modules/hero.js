/* =======================================================
 * Time Travel - Hero Section - Particles, typewriter, slideshow, search, parallax
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
// HERO PARTICLES – floating dots & connecting lines
// ═══════════════════════════════════════════════════════════
function initHeroParticles() {
  const canvas = document.getElementById("heroParticles");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  let w, h, particles;
  const IS_MOBILE = window.matchMedia("(max-width: 768px)").matches;
  const PARTICLE_COUNT = IS_MOBILE ? 36 : 64;
  const CONNECT_DIST = 130;
  const CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;
  const MOUSE_RADIUS = 180;
  const MOUSE_RADIUS_SQ = MOUSE_RADIUS * MOUSE_RADIUS;
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
        const distSq = dx * dx + dy * dy;
        if (distSq < CONNECT_DIST_SQ) {
          const dist = Math.sqrt(distSq);
          const alpha = 0.1 * (1 - dist / CONNECT_DIST);
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
      const distSq = dx * dx + dy * dy;
      if (distSq < MOUSE_RADIUS_SQ && distSq > 0) {
        const dist = Math.sqrt(distSq);
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

  let rafId = null;
  let lastFrameTs = 0;
  const FRAME_MS = 1000 / (IS_MOBILE ? 28 : 40);

  function loop(ts) {
    if (document.hidden) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    if (ts - lastFrameTs < FRAME_MS) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    lastFrameTs = ts;
    update();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  let mouseRaf = false;
  let pendingX = -9999;
  let pendingY = -9999;
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    pendingX = e.clientX - rect.left;
    pendingY = e.clientY - rect.top;
    if (!mouseRaf) {
      mouseRaf = true;
      requestAnimationFrame(() => {
        mouse.x = pendingX;
        mouse.y = pendingY;
        mouseRaf = false;
      });
    }
  });
  canvas.addEventListener("mouseleave", () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  resize();
  createParticles();
  rafId = requestAnimationFrame(loop);
  window.addEventListener("resize", () => {
    resize();
    createParticles();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && rafId === null) {
      rafId = requestAnimationFrame(loop);
    }
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
function initHeroParallax() {
  const heroContent = document.getElementById("heroContent");
  const hero = document.getElementById("hero");
  if (
    !heroContent ||
    !hero ||
    window.innerWidth <= 640 ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;

  let parallaxFrame = false;
  let tx = 0;
  let ty = 0;
  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    tx = x * -6;
    ty = y * -4;
    if (!parallaxFrame) {
      parallaxFrame = true;
      requestAnimationFrame(() => {
        heroContent.style.transform = `translate(${tx}px, ${ty}px)`;
        parallaxFrame = false;
      });
    }
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

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (window.scrollY > 200) {
          indicator.style.opacity = "0";
          indicator.style.pointerEvents = "none";
        } else {
          indicator.style.opacity = "";
          indicator.style.pointerEvents = "";
        }
        ticking = false;
      });
    },
    { passive: true },
  );
}

// ═══════════════════════════════════════════════════════════
// HERO SLIDESHOW – crossfade background + place name cycle
// ═══════════════════════════════════════════════════════════
function initHeroSlideshow() {
  const slides = document.querySelectorAll(".hero-bg-slide");
  const place = document.getElementById("heroPlace");
  if (!slides.length) return;

  const names = ["Agra", "Kerala", "Jaipur", "Udaipur"];
  let cur = 0;
  let interval;

  function goTo(idx) {
    slides[cur].classList.remove("active");
    cur = idx % slides.length;
    slides[cur].classList.add("active");
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
    clearInterval(interval);
    interval = setInterval(next, 5500);
  }
  function resetAuto() {
    clearInterval(interval);
    startAuto();
  }

  // Activate first slide
  slides[0].classList.add("active");
  startAuto();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInterval(interval);
    } else {
      startAuto();
    }
  });

  // Safety: ensure hero content becomes visible after animations
  const heroCenter = document.getElementById("heroContent");
  if (heroCenter) {
    setTimeout(() => heroCenter.classList.add("loaded"), 1200);
  }
}

// ═══════════════════════════════════════════════════════════
// HERO PROOF COUNT-UP – subtle metric animation on first reveal
// ═══════════════════════════════════════════════════════════
function initHeroProofCountUp() {
  const metrics = Array.from(document.querySelectorAll("[data-count-up]"));
  if (!metrics.length) return;

  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const animateMetric = (el) => {
    const target = Number(el.dataset.countUp || 0);
    if (!Number.isFinite(target) || target <= 0) return;

    const prefix = el.dataset.countPrefix || "";
    const suffix = el.dataset.countSuffix || "";

    if (prefersReduced) {
      el.textContent = `${prefix}${target}${suffix}`;
      return;
    }

    const duration = Math.min(1400, Math.max(700, target * 8));
    const start = performance.now();

    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      // Ease-out cubic keeps the motion subtle near the end.
      const eased = 1 - Math.pow(1 - p, 3);
      const value = Math.round(target * eased);
      el.textContent = `${prefix}${value}${suffix}`;
      if (p < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  const root = document.getElementById("hero");
  if (!root || typeof IntersectionObserver !== "function") {
    metrics.forEach(animateMetric);
    return;
  }

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        metrics.forEach(animateMetric);
        obs.disconnect();
      });
    },
    { threshold: 0.35 },
  );

  obs.observe(root);
}

// ═══════════════════════════════════════════════════════════
// HERO TRENDING TAGS – dynamic chips from DEST_COORDS/DEST_META
// ═══════════════════════════════════════════════════════════
function initHeroTrendingTags() {
  const container = document.getElementById("heroSearchSuggestions");
  if (!container) return;

  const fallback = Array.from(container.querySelectorAll(".hero-tag"))
    .map((el) => (el.dataset.dest || el.textContent || "").trim())
    .filter(Boolean);

  const monthMap = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };

  const getSeasonMonths = (seasonText) => {
    const raw = (seasonText || "").toLowerCase().replace(/\s+/g, "");
    if (!raw) return new Set();
    if (/all|year/.test(raw))
      return new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const cleaned = raw.replace(/–/g, "-");
    const match = cleaned.match(
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/,
    );
    if (!match) return new Set();

    const start = monthMap[match[1]];
    const end = monthMap[match[2]];
    if (!start || !end) return new Set();

    const out = new Set();
    if (start <= end) {
      for (let m = start; m <= end; m += 1) out.add(m);
    } else {
      for (let m = start; m <= 12; m += 1) out.add(m);
      for (let m = 1; m <= end; m += 1) out.add(m);
    }
    return out;
  };

  const resolveKeyByLabel = (label) => {
    const needle = (label || "").trim().toLowerCase();
    if (!needle || typeof DEST_COORDS === "undefined") return null;
    for (const [key, d] of Object.entries(DEST_COORDS || {})) {
      if ((d.label || "").toLowerCase() === needle) return key;
    }
    return null;
  };

  const renderTags = (labels) => {
    const uniq = [];
    const seen = new Set();
    (labels || []).forEach((name) => {
      const clean = (name || "").trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      uniq.push(clean);
    });

    const finalList = uniq.slice(0, 6);
    if (!finalList.length) return;

    container.innerHTML = finalList
      .map(
        (name) =>
          `<span class="hero-tag" data-dest="${name.replace(/"/g, "&quot;")}">${name}</span>`,
      )
      .join("");
  };

  const computeTrending = (contextDest = "") => {
    if (
      typeof DEST_COORDS === "undefined" ||
      !Object.keys(DEST_COORDS || {}).length
    ) {
      return [];
    }

    let contextLabel = (contextDest || "").trim();
    if (!contextLabel) {
      try {
        contextLabel = (
          localStorage.getItem("tt-last-destination") || ""
        ).trim();
      } catch (_) {
        contextLabel = "";
      }
    }

    const contextKey = resolveKeyByLabel(contextLabel);
    const contextRegion =
      contextKey &&
      typeof DEST_META !== "undefined" &&
      DEST_META[contextKey] &&
      DEST_META[contextKey].region
        ? DEST_META[contextKey].region
        : "";

    const nowMonth = new Date().getMonth() + 1;

    const scored = Object.entries(DEST_COORDS)
      .map(([key, d], idx) => {
        const meta =
          typeof DEST_META !== "undefined" && DEST_META && DEST_META[key]
            ? DEST_META[key]
            : {};

        let score = 0;
        if (meta.highlight) score += 2;
        if (meta.tagline) score += 1;

        const seasonMonths = getSeasonMonths(meta.season || "");
        if (seasonMonths.has(nowMonth)) score += 3;

        if (
          contextLabel &&
          d.label &&
          d.label.toLowerCase() === contextLabel.toLowerCase()
        ) {
          score += 8;
        }
        if (contextRegion && meta.region && meta.region === contextRegion) {
          score += 2;
        }

        // Stable tie-breaker to avoid visual jumping across renders.
        score += Math.max(0, 1 - idx * 0.0001);

        return { label: d.label || key, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.label)
      .filter(Boolean);

    return scored.slice(0, 6);
  };

  // Render static fallback first, then upgrade once destination data is available.
  renderTags(fallback);

  let tries = 0;
  const maxTries = 14;
  const retryMs = 700;
  const timer = setInterval(() => {
    tries += 1;
    const list = computeTrending();
    if (list.length >= 4 || tries >= maxTries) {
      if (list.length) renderTags(list);
      clearInterval(timer);
    }
  }, retryMs);

  document.addEventListener("tt:destination-context", (evt) => {
    const dest = (evt.detail && evt.detail.destination) || "";
    const list = computeTrending(dest);
    if (list.length) renderTags(list);
  });
}

// ═══════════════════════════════════════════════════════════
// HERO SEARCH – glassmorphism search bar → Smart Hub
// ═══════════════════════════════════════════════════════════
function initHeroSearch() {
  const input = document.getElementById("heroSearchInput");
  const btn = document.getElementById("heroSearchBtn");
  const tagsWrap = document.getElementById("heroSearchSuggestions");
  if (!input) return;

  initHeroTrendingTags();

  // ── Autocomplete dropdown ─────────────────────────────
  let _acDropdown = null;
  let _acItems = [];
  let _acIdx = -1;

  function _createDropdown() {
    if (_acDropdown) return;
    _acDropdown = document.createElement("div");
    _acDropdown.className = "hero-autocomplete";
    _acDropdown.setAttribute("role", "listbox");
    _acDropdown.id = "heroAutocomplete";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", "heroAutocomplete");
    input.parentElement.style.position = "relative";
    input.parentElement.appendChild(_acDropdown);
  }

  function _getDestNames() {
    if (typeof DEST_COORDS === "object" && Object.keys(DEST_COORDS).length) {
      return Object.values(DEST_COORDS)
        .map((d) => d.label)
        .filter(Boolean);
    }
    return [];
  }

  function _showSuggestions(query) {
    _createDropdown();
    const q = query.toLowerCase().trim();
    if (!q) {
      _hideSuggestions();
      return;
    }

    const names = _getDestNames();
    // Prioritise starts-with, then contains
    const starts = names.filter((n) => n.toLowerCase().startsWith(q));
    const contains = names.filter(
      (n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q),
    );
    _acItems = [...starts, ...contains].slice(0, 8);
    _acIdx = -1;

    if (!_acItems.length) {
      _hideSuggestions();
      return;
    }

    _acDropdown.innerHTML = _acItems
      .map((name, i) => {
        // Highlight matching text
        const idx = name.toLowerCase().indexOf(q);
        const before = name.slice(0, idx);
        const match = name.slice(idx, idx + q.length);
        const after = name.slice(idx + q.length);
        return `<div class="hero-ac-item" role="option" data-idx="${i}">
        <i class="fas fa-map-marker-alt"></i>
        ${before}<strong>${match}</strong>${after}
      </div>`;
      })
      .join("");

    _acDropdown.style.display = "block";

    // Click handler for suggestions
    _acDropdown.querySelectorAll(".hero-ac-item").forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const idx = parseInt(item.dataset.idx);
        input.value = _acItems[idx];
        _hideSuggestions();
        doSearch(_acItems[idx]);
      });
    });
  }

  function _hideSuggestions() {
    if (_acDropdown) _acDropdown.style.display = "none";
    _acIdx = -1;
  }

  function _highlightItem(idx) {
    if (!_acDropdown) return;
    const items = _acDropdown.querySelectorAll(".hero-ac-item");
    items.forEach((el) => el.classList.remove("active"));
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add("active");
      items[idx].scrollIntoView({ block: "nearest" });
    }
  }

  input.addEventListener("input", () => _showSuggestions(input.value));
  input.addEventListener("focus", () => {
    if (input.value.trim()) _showSuggestions(input.value);
  });
  input.addEventListener("blur", () => setTimeout(_hideSuggestions, 200));

  input.addEventListener("keydown", (e) => {
    if (
      _acDropdown &&
      _acDropdown.style.display === "block" &&
      _acItems.length
    ) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        _acIdx = Math.min(_acIdx + 1, _acItems.length - 1);
        _highlightItem(_acIdx);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        _acIdx = Math.max(_acIdx - 1, 0);
        _highlightItem(_acIdx);
        return;
      } else if (e.key === "Enter" && _acIdx >= 0) {
        e.preventDefault();
        input.value = _acItems[_acIdx];
        _hideSuggestions();
        doSearch(_acItems[_acIdx]);
        return;
      } else if (e.key === "Escape") {
        _hideSuggestions();
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      _hideSuggestions();
      doSearch(input.value);
    }
  });

  // ── ⌘K / Ctrl+K keyboard shortcut ─────────────────────
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => input.focus(), 350);
    }
  });

  // ── Core search logic ─────────────────────────────────
  function doSearch(query) {
    query = (query || "").trim();
    if (!query) return;
    if (typeof setSharedDestinationContext === "function") {
      setSharedDestinationContext(query, { autoRun: true });
    }
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

  btn &&
    btn.addEventListener("click", () => {
      _hideSuggestions();
      doSearch(input.value);
    });
  if (tagsWrap) {
    tagsWrap.addEventListener("click", (e) => {
      const tag = e.target.closest(".hero-tag");
      if (!tag) return;
      const dest = tag.dataset.dest || tag.textContent.trim();
      input.value = dest;
      _hideSuggestions();
      doSearch(dest);
    });
  }
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
