/* =======================================================
 * Time Travel - Smart Hub - Unified destination search, explore, enhanced palette
 * ======================================================= */

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

// Destination taglines — loaded dynamically, with static fallback
const SHUB_TAGLINES = {};

/** Get tagline for a destination: prefers DEST_META (from API), falls back to SHUB_TAGLINES */
function _getTagline(key) {
  const k = (key || "").toLowerCase().replace(/\s+/g, "_");
  if (typeof DEST_META !== "undefined" && DEST_META[k] && DEST_META[k].tagline)
    return DEST_META[k].tagline;
  return SHUB_TAGLINES[k] || "";
}

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
      const tagline = _getTagline(m.key);
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
    setSharedDestinationContext(preselect, { autoRun: true });
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

  setSharedDestinationContext(dest, { autoRun: true });

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
    bannerSub.textContent = _getTagline(dest) || "Explore this destination";
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

let _lastAutoRunDest = "";
let _lastAutoRunAt = 0;

function isDestinationOrchestrationEnabled() {
  if (
    window.TT_FLAGS &&
    typeof window.TT_FLAGS.destinationOrchestration === "boolean"
  ) {
    return window.TT_FLAGS.destinationOrchestration;
  }
  try {
    const raw = localStorage.getItem("tt-feature-destination-orchestration");
    if (raw === null) return true;
    return !["0", "false", "off", "disabled"].includes(
      String(raw).toLowerCase(),
    );
  } catch (_) {
    return true;
  }
}

function buildDestinationContextDetail(place, opts = {}) {
  const now = Date.now();
  return {
    event: "tt:destination-context",
    version: 1,
    contextId:
      opts.contextId || `ctx_${now}_${Math.random().toString(36).slice(2, 8)}`,
    source: opts.source || "smart-hub",
    destination: place,
    normalizedDestination: place.toLowerCase(),
    autoRun: !!opts.autoRun,
    timestampMs: now,
    timestampIso: new Date(now).toISOString(),
  };
}

function autoTriggerLinkedModules(dest) {
  const place = (dest || "").trim();
  if (!place) return;

  const now = Date.now();
  if (
    _lastAutoRunDest.toLowerCase() === place.toLowerCase() &&
    now - _lastAutoRunAt < 7000
  ) {
    return;
  }
  _lastAutoRunDest = place;
  _lastAutoRunAt = now;

  const autoButtons = [
    "itinSubmit",
    "bookingSearchBtn",
    "langSearchBtn",
    "packGenBtn",
  ];

  autoButtons.forEach((id, idx) => {
    setTimeout(
      () => {
        const btn = document.getElementById(id);
        if (btn && !btn.disabled) btn.click();
      },
      120 + idx * 120,
    );
  });
}

function setSharedDestinationContext(dest, opts = {}) {
  const place = (dest || "").trim();
  if (!place) return;
  const autoRun = !!opts.autoRun;
  const orchestrationEnabled =
    opts.force === true ? true : isDestinationOrchestrationEnabled();

  const destinationInputs = [
    "budgetDest",
    "safetyDest",
    "weatherDest",
    "itinDest",
    "mapDest",
    "placesDest",
    "newsDest",
    "bookingDest",
    "langDest",
    "expDest",
    "packDest",
    "journalDest",
    "tdTripDest",
  ];

  if (orchestrationEnabled) {
    destinationInputs.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === "SELECT") {
        const hasOption = Array.from(el.options || []).some(
          (o) => (o.value || "").toLowerCase() === place.toLowerCase(),
        );
        if (!hasOption) {
          const option = document.createElement("option");
          option.value = place;
          option.textContent = place;
          el.appendChild(option);
        }
      }
      const prev = (el.value || "").trim().toLowerCase();
      if (prev === place.toLowerCase()) return;
      el.value = place;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  const detail = buildDestinationContextDetail(place, {
    source: opts.source,
    autoRun,
    contextId: opts.contextId,
  });

  const heroPlace = document.getElementById("heroPlace");
  if (heroPlace) heroPlace.textContent = place;
  const wsDest = document.getElementById("tdWsDest");
  if (wsDest) wsDest.textContent = place;
  const navDest = document.getElementById("navActiveDestination");
  if (navDest) {
    const clean = place.trim();
    navDest.textContent = clean;
    navDest.style.display = clean ? "inline-block" : "none";
    navDest.title = clean ? `Active destination: ${clean}` : "";
  }

  try {
    localStorage.setItem("tt-last-destination", place);
  } catch (_) {
    /* ignore */
  }

  if (orchestrationEnabled) {
    document.dispatchEvent(
      new CustomEvent("tt:destination-context", {
        detail,
      }),
    );
  }

  if (autoRun && orchestrationEnabled) autoTriggerLinkedModules(place);
}

function activateTool(sectionId, dest) {
  scrollToSection(sectionId);
  if (dest) setSharedDestinationContext(dest);
}

// ═══════════════════════════════════════════════════════════════
// ENHANCED COMMAND PALETTE – Destination quick-explore + actions
// ═══════════════════════════════════════════════════════════════
function enhanceCommandPalette() {
  if (window._ttEnhancedPaletteInitDone) return;
  const overlay = document.getElementById("navSearchOverlay");
  const input = document.getElementById("navSearchInput");
  const resultsList = document.getElementById("navSearchResults");
  if (!overlay || !input || !resultsList) return;
  window._ttEnhancedPaletteInitDone = true;

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
        label: "🔍 Smart Hub",
        sublabel: "Search once, get everything",
        iconClass: "fas fa-search-plus",
        action: () => openSmartHub(),
      },
      {
        type: "action",
        label: "🤖 AI Chat",
        sublabel: "Launch AI travel assistant",
        iconClass: "fas fa-robot",
        action: () => activateTool("chatbot"),
      },
      {
        type: "action",
        label: "🗓 Itinerary",
        sublabel: "Generate day-by-day plans",
        iconClass: "fas fa-route",
        action: () => activateTool("itinerary"),
      },
      {
        type: "action",
        label: "⚖️ Compare",
        sublabel: "Compare destinations side by side",
        iconClass: "fas fa-columns",
        action: () => activateTool("compare"),
      },
      {
        type: "action",
        label: "💰 Budget",
        sublabel: "Estimate travel cost",
        iconClass: "fas fa-wallet",
        action: () => activateTool("budget"),
      },
      {
        type: "action",
        label: "🗺 Maps",
        sublabel: "Open interactive map",
        iconClass: "fas fa-map-marked-alt",
        action: () => activateTool("maps"),
      },
      {
        type: "action",
        label: "📍 Places",
        sublabel: "Nearby places and POIs",
        iconClass: "fas fa-map-pin",
        action: () => activateTool("places"),
      },
      {
        type: "action",
        label: "📰 News",
        sublabel: "Latest destination updates",
        iconClass: "fas fa-newspaper",
        action: () => activateTool("news"),
      },
      {
        type: "action",
        label: "🎟 Booking",
        sublabel: "Flights, hotels and transport",
        iconClass: "fas fa-ticket-alt",
        action: () => activateTool("booking"),
      },
      {
        type: "action",
        label: "💱 Currency",
        sublabel: "Check exchange rates",
        iconClass: "fas fa-coins",
        action: () => activateTool("currency"),
      },
      {
        type: "action",
        label: "🗣 Phrases",
        sublabel: "Local language helper",
        iconClass: "fas fa-language",
        action: () => activateTool("language"),
      },
      {
        type: "action",
        label: "🧾 Expenses",
        sublabel: "Track trip spending",
        iconClass: "fas fa-receipt",
        action: () => activateTool("expenses"),
      },
      {
        type: "action",
        label: "🧳 Packing",
        sublabel: "Smart checklist",
        iconClass: "fas fa-suitcase-rolling",
        action: () => activateTool("packingChecklist"),
      },
      {
        type: "action",
        label: "📔 Journal",
        sublabel: "Save travel memories",
        iconClass: "fas fa-book-open",
        action: () => activateTool("journal"),
      },
      {
        type: "action",
        label: "❤️ Wishlist",
        sublabel: "Open saved places",
        iconClass: "fas fa-heart",
        action: () => activateTool("wishlist"),
      },
      {
        type: "action",
        label: "🧭 History",
        sublabel: "View previous trips",
        iconClass: "fas fa-suitcase",
        action: () => activateTool("history"),
      },
      {
        type: "action",
        label: "📊 Dashboard",
        sublabel: "Trip workspace",
        iconClass: "fas fa-plus-circle",
        action: () => {
          activateTool("tripDashboard");
          setTimeout(() => {
            const b = document.getElementById("tdNewTripBtn");
            if (b) b.click();
          }, 400);
        },
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
      if (enhancedItems[idx] && enhancedItems[idx].type === "dest") {
        const rawLabel =
          enhancedItems[idx].label
            .replace(/^✈\s*Quick\s*Explore:\s*/i, "")
            .trim() || "";
        if (rawLabel) setSharedDestinationContext(rawLabel);
      }
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

window.setSharedDestinationContext = setSharedDestinationContext;
window.isDestinationOrchestrationEnabled = isDestinationOrchestrationEnabled;

// ═══════════════════════════════════════════════════════════════
// INIT Smart Hub + FAB + Enhanced Palette on DOM ready
// ═══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initSmartHub();
  // Defer enhanced palette wiring until browser is idle to avoid startup jank.
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => enhanceCommandPalette(), {
      timeout: 1800,
    });
  } else {
    setTimeout(enhanceCommandPalette, 1800);
  }
});
