/* =======================================================
 * Time Travel - Places Explorer - Smart recommendations,
 * Foursquare search, sorting, detail modal, favourites
 * ======================================================= */

// ── State ────────────────────────────────────────────────
let _placesData = []; // current result set (for re-sorting)
let _listView = false;
let _activeSituation = "";
let _cachedWeather = null; // cache weather for the current destination
let _placesCtxTimer = null;
let _placesLastCtxId = "";

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

/** Escape HTML to prevent XSS */
function _escHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/** Price tier to dollar signs */
function priceTierLabel(tier) {
  if (!tier || tier < 1) return "";
  return "$".repeat(tier);
}

/** Rating score badge colour */
function ratingColor(score) {
  if (score >= 8) return "#4da8da";
  if (score >= 6) return "#ffd93d";
  if (score >= 4) return "#ff7e5f";
  return "#1b263b";
}

/** Format distance */
function fmtDistance(m) {
  if (m == null) return "";
  return m >= 1000 ? (m / 1000).toFixed(1) + " km" : m + " m";
}

async function _fetchUnsplashPlacePhotos(placeName, limit = 6) {
  if (!placeName) return [];
  try {
    const res = await fetch(
      `${API_BASE}/api/images/destination/${encodeURIComponent(placeName)}`,
    );
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.images)) return [];

    return data.images.slice(0, limit).map((img) => ({
      url_medium: img.url_small || img.url_regular || img.url_thumb,
      url: img.url_full || img.url_regular || img.url_small || img.url_thumb,
      source: "unsplash",
    }));
  } catch {
    return [];
  }
}

/** Get place favourites from localStorage */
function _getPlaceFavs() {
  try {
    return JSON.parse(localStorage.getItem("tt_place_favs") || "[]");
  } catch {
    return [];
  }
}
function _togglePlaceFav(fsqId, name) {
  let favs = _getPlaceFavs();
  const idx = favs.findIndex((f) => f.id === fsqId);
  if (idx >= 0) {
    favs.splice(idx, 1);
    showToast(`Removed from favourites`, "info");
  } else {
    favs.push({ id: fsqId, name: name || "", ts: Date.now() });
    showToast(`Added to favourites!`, "success");
  }
  localStorage.setItem("tt_place_favs", JSON.stringify(favs));
  _updateFavButtons();
}
function _updateFavButtons() {
  const favs = _getPlaceFavs();
  const favIds = new Set(favs.map((f) => f.id));
  document.querySelectorAll(".place-card-btn.btn-fav").forEach((btn) => {
    const id = btn.dataset.fsqId;
    if (favIds.has(id)) {
      btn.classList.add("is-fav");
      btn.querySelector("i").className = "fas fa-heart";
    } else {
      btn.classList.remove("is-fav");
      btn.querySelector("i").className = "far fa-heart";
    }
  });
}

function _resolvePlacesDestKey(rawDest) {
  const dest = (rawDest || "").trim().toLowerCase();
  if (!dest) return null;
  for (const [key, d] of Object.entries(DEST_COORDS || {})) {
    if (key.toLowerCase() === dest || (d.label || "").toLowerCase() === dest) {
      return key;
    }
  }
  return null;
}

function bindPlacesDestinationContextListener() {
  if (window._ttPlacesCtxBound) return;
  window._ttPlacesCtxBound = true;

  document.addEventListener("tt:destination-context", (evt) => {
    if (
      typeof window.isDestinationOrchestrationEnabled === "function" &&
      !window.isDestinationOrchestrationEnabled()
    ) {
      return;
    }

    const detail = evt.detail || {};
    const dest = (detail.destination || "").trim();
    if (!dest) return;

    clearTimeout(_placesCtxTimer);
    _placesCtxTimer = setTimeout(() => {
      const key = _resolvePlacesDestKey(dest);
      if (!key) return;

      const dedupeId = detail.contextId || `${key}:${detail.autoRun ? 1 : 0}`;
      if (dedupeId === _placesLastCtxId) return;
      _placesLastCtxId = dedupeId;

      const sel = document.getElementById("placesDest");
      if (sel) {
        sel.value = key;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (detail.autoRun) {
        const btn = document.getElementById("placesSearchBtn");
        if (btn && !btn.disabled) btn.click();
      }
    }, 220);
  });
}

// ── Fetch weather for destination (for smart recs) ───────
async function _fetchDestWeather(dest) {
  if (_cachedWeather && _cachedWeather.dest === dest)
    return _cachedWeather.condition;
  try {
    const res = await fetch(
      `${API_BASE}/api/weather/${encodeURIComponent(dest)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const condition = data.weather?.description || data.weather?.main || null;
    _cachedWeather = { dest, condition };
    return condition;
  } catch {
    return null;
  }
}

// ── Smart Recommendation ─────────────────────────────────
async function _loadSmartRecommendations(situation) {
  const dest = document.getElementById("placesDest").value;
  if (!dest) {
    showToast("Please select a destination first.", "warning");
    return;
  }

  const coords = DEST_COORDS[dest];
  if (!coords) return;

  const grid = document.getElementById("placesResults");
  const toolbar = document.getElementById("placesToolbar");
  const reasonsEl = document.getElementById("smartRecommendReasons");
  const emptyEl = document.getElementById("placesEmpty");
  if (emptyEl) emptyEl.style.display = "none";

  grid.style.display = "grid";
  grid.innerHTML =
    '<div class="places-loading"><i class="fas fa-magic fa-spin"></i> Finding smart recommendations…</div>';

  // Fetch weather context
  const weather = await _fetchDestWeather(dest);

  try {
    let url = `${API_BASE}/api/places/recommend?lat=${coords.lat}&lon=${coords.lon}&limit=6&situation=${encodeURIComponent(situation)}`;
    if (weather) url += `&weather=${encodeURIComponent(weather)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Recommendation failed");

    // Show reasoning
    if (data.reasons && data.reasons.length) {
      reasonsEl.style.display = "block";
      reasonsEl.innerHTML = data.reasons
        .map(
          (r) =>
            `<div class="reason-item"><i class="fas fa-lightbulb"></i> ${_escHtml(r)}</div>`,
        )
        .join("");
    }

    if (!data.places || data.places.length === 0) {
      grid.innerHTML = `
        <div class="places-empty">
          <i class="fas fa-map-marked-alt"></i>
          <p>No recommendations found for this situation. Try searching manually.</p>
        </div>`;
      toolbar.style.display = "none";
      return;
    }

    _placesData = data.places;
    _renderResults(
      data.places,
      `${_escHtml(data.situation)} · ${_escHtml(data.time_slot)}`,
    );
  } catch (err) {
    console.error("Smart recommend error:", err);
    grid.innerHTML = `
      <div class="places-empty">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${_escHtml(err.message) || "Could not load recommendations."}</p>
      </div>`;
  }
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

    // Clear situation chips
    _activeSituation = "";
    document
      .querySelectorAll(".situation-chip.active")
      .forEach((c) => c.classList.remove("active"));
    const reasonsEl = document.getElementById("smartRecommendReasons");
    if (reasonsEl) reasonsEl.style.display = "none";

    const placesEmptyEl = document.getElementById("placesEmpty");
    if (placesEmptyEl) placesEmptyEl.style.display = "none";

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
        document.getElementById("placesToolbar").style.display = "none";
        return;
      }

      _placesData = data.places;
      const contextLabel = cat ? _escHtml(cat) : "all categories";
      _renderResults(data.places, contextLabel);
    } catch (err) {
      console.error("Places search error:", err);
      grid.innerHTML = `
        <div class="places-empty">
          <i class="fas fa-exclamation-triangle"></i>
          <p>${_escHtml(err.message) || "Could not search places. Please try again."}</p>
        </div>`;
    }
  });
}

// ── Render results with toolbar ──────────────────────────
function _renderResults(places, contextLabel) {
  const toolbar = document.getElementById("placesToolbar");
  const countEl = document.getElementById("placesCount");
  const contextEl = document.getElementById("placesContext");
  const grid = document.getElementById("placesResults");

  toolbar.style.display = "flex";
  countEl.textContent = `${places.length} place${places.length !== 1 ? "s" : ""} found`;
  contextEl.textContent = contextLabel || "";

  // Reset sort
  const sortSel = document.getElementById("placesSort");
  if (sortSel) sortSel.value = "relevance";

  renderPlaceCards(places, grid);
}

// ── Sort logic ───────────────────────────────────────────
const placesSortSel = document.getElementById("placesSort");
if (placesSortSel) {
  placesSortSel.addEventListener("change", () => {
    if (!_placesData.length) return;
    const sorted = [..._placesData];
    const val = placesSortSel.value;
    if (val === "rating") {
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (val === "distance") {
      sorted.sort(
        (a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity),
      );
    } else if (val === "price-low") {
      sorted.sort((a, b) => (a.price_tier || 99) - (b.price_tier || 99));
    } else if (val === "price-high") {
      sorted.sort((a, b) => (b.price_tier || 0) - (a.price_tier || 0));
    }
    // else "relevance" — keep original order
    const grid = document.getElementById("placesResults");
    if (grid) renderPlaceCards(sorted, grid);
  });
}

// ── View toggle ──────────────────────────────────────────
const viewToggleBtn = document.getElementById("placesViewToggle");
if (viewToggleBtn) {
  viewToggleBtn.addEventListener("click", () => {
    _listView = !_listView;
    const grid = document.getElementById("placesResults");
    if (grid) grid.classList.toggle("list-view", _listView);
    viewToggleBtn.innerHTML = _listView
      ? '<i class="fas fa-th-large"></i>'
      : '<i class="fas fa-list"></i>';
  });
}

// ── Situation chip clicks ────────────────────────────────
document.querySelectorAll(".situation-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const situation = chip.dataset.situation;
    const wasActive = chip.classList.contains("active");

    // Toggle
    document
      .querySelectorAll(".situation-chip.active")
      .forEach((c) => c.classList.remove("active"));
    const reasonsEl = document.getElementById("smartRecommendReasons");

    if (wasActive) {
      _activeSituation = "";
      if (reasonsEl) reasonsEl.style.display = "none";
      return;
    }

    chip.classList.add("active");
    _activeSituation = situation;
    _loadSmartRecommendations(situation);
  });
});

/** Render place cards into grid */
function renderPlaceCards(places, grid) {
  const favIds = new Set(_getPlaceFavs().map((f) => f.id));

  grid.innerHTML = places
    .map((p) => {
      // Smart badge
      let badgeHtml = "";
      if (p.recommended_for) {
        badgeHtml = `<span class="place-card-badge badge-recommended"><i class="fas fa-magic"></i> Recommended</span>`;
      } else if (p.rating && p.rating >= 8.5) {
        badgeHtml = `<span class="place-card-badge badge-top-rated"><i class="fas fa-trophy"></i> Top Rated</span>`;
      } else if (p.is_open) {
        badgeHtml = `<span class="place-card-badge badge-open-now"><i class="fas fa-clock"></i> Open</span>`;
      }

      const isFav = favIds.has(p.fsq_id);

      return `
    <div class="place-card" data-action="open-place-detail" data-fsq-id="${_escHtml(p.fsq_id)}">
      ${badgeHtml}
      <div class="place-card-header">
        <div class="place-card-name">
          ${_escHtml(p.name)}
          ${p.verified ? '<i class="fas fa-check-circle verified-badge" title="Verified"></i>' : ""}
        </div>
        <div class="place-card-cats">${(p.categories || [p.category]).map((c) => _escHtml(c)).join(" · ")}</div>
        <div class="place-card-stats">
          ${p.rating ? `<span class="place-stat rating"><i class="fas fa-star"></i> <strong style="color:${ratingColor(p.rating)}">${p.rating.toFixed(1)}</strong>/10</span>` : ""}
          ${p.price_tier ? `<span class="place-stat price">${priceTierLabel(p.price_tier)}</span>` : ""}
          ${p.distance_m != null ? `<span class="place-stat distance"><i class="fas fa-route"></i> ${fmtDistance(p.distance_m)}</span>` : ""}
          ${p.popularity != null ? `<span class="place-stat popularity"><i class="fas fa-fire"></i> ${(p.popularity * 100).toFixed(0)}%</span>` : ""}
          ${p.is_open !== null && p.is_open !== undefined ? `<span class="place-stat open-status ${p.is_open ? "is-open" : "is-closed"}">${p.is_open ? "Open" : "Closed"}</span>` : ""}
        </div>
      </div>
      <div class="place-card-address">
        <i class="fas fa-map-marker-alt" style="color:var(--primary);margin-right:4px;"></i>
        ${_escHtml(p.address) || "Address not available"}${p.locality ? ", " + _escHtml(p.locality) : ""}
      </div>
      <div class="place-card-footer">
        <button class="place-card-btn" data-action="open-place-detail" data-fsq-id="${_escHtml(p.fsq_id)}" data-stop-propagation>
          <i class="fas fa-info-circle"></i> Details
        </button>
        ${p.website ? `<a class="place-card-btn" href="${_escHtml(p.website)}" target="_blank" rel="noopener" data-stop-propagation><i class="fas fa-globe"></i> Website</a>` : ""}
        ${p.phone ? `<a class="place-card-btn" href="tel:${_escHtml(p.phone)}" data-stop-propagation><i class="fas fa-phone"></i> Call</a>` : ""}
        ${p.lat && p.lon ? `<button class="place-card-btn" data-action="fly-to-poi" data-lat="${p.lat}" data-lon="${p.lon}" data-stop-propagation><i class="fas fa-location-arrow"></i> Map</button>` : ""}
        <button class="place-card-btn btn-fav ${isFav ? "is-fav" : ""}" data-action="toggle-place-fav" data-fsq-id="${_escHtml(p.fsq_id)}" data-name="${_escHtml(p.name)}" data-stop-propagation>
          <i class="${isFav ? "fas" : "far"} fa-heart"></i>
        </button>
      </div>
    </div>
  `;
    })
    .join("");
}

// ── Place Detail Modal ───────────────────────────────────
async function openPlaceDetail(fsqId) {
  const overlay = document.getElementById("placeModal");
  const content = document.getElementById("placeModalContent");
  if (!overlay || !content) return;

  const placeRef = _placesData.find((p) => p.fsq_id === fsqId) || null;
  const placeName = placeRef?.name || "Selected place";

  overlay.style.display = "flex";
  content.innerHTML =
    '<div class="places-loading"><i class="fas fa-spinner fa-spin"></i> Loading place details…</div>';

  try {
    const res = await fetch(
      `${API_BASE}/api/places/detail/${encodeURIComponent(fsqId)}`,
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load details");

    const p = data.place;
    if ((!p.photos || !p.photos.length) && placeName) {
      const fallbackPhotos = await _fetchUnsplashPlacePhotos(placeName, 6);
      if (fallbackPhotos.length) {
        p.photos = fallbackPhotos;
        p.total_photos = fallbackPhotos.length;
        p.photo_source = "unsplash_fallback";
      }
    }

    const cats = (p.categories || [p.category])
      .map((c) => _escHtml(c))
      .join(" · ");

    let html = `<div class="place-modal-card">`;

    // Close button
    html += `<button style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted);" data-action="close-place-modal">
      <i class="fas fa-times"></i>
    </button>`;

    // Header
    html += `<div class="place-detail-header">
      <h2>${_escHtml(p.name)} ${p.verified ? '<i class="fas fa-check-circle" style="color:var(--primary);font-size:0.9rem;"></i>' : ""}</h2>
      <div class="place-detail-cats">${cats}</div>
    </div>`;

    // Stats row
    html += `<div class="place-detail-stats">`;
    if (p.rating)
      html += `<span class="place-stat rating"><i class="fas fa-star"></i> <strong style="color:${ratingColor(p.rating)}">${p.rating.toFixed(1)}</strong>/10</span>`;
    if (p.price_tier)
      html += `<span class="place-stat price">${priceTierLabel(p.price_tier)}</span>`;
    if (p.popularity != null)
      html += `<span class="place-stat popularity"><i class="fas fa-fire"></i> ${(p.popularity * 100).toFixed(0)}% popular</span>`;
    if (p.is_open !== null && p.is_open !== undefined)
      html += `<span class="place-stat open-status ${p.is_open ? "is-open" : "is-closed"}">${p.is_open ? "Open Now" : "Closed"}</span>`;
    html += `</div>`;

    // Description
    if (p.description) {
      html += `<div class="place-detail-section">
        <h3><i class="fas fa-align-left"></i> About</h3>
        <p style="font-size:0.88rem;color:var(--text-dark);line-height:1.6;">${_escHtml(p.description)}</p>
      </div>`;
    }

    // Info rows
    html += `<div class="place-detail-section">
      <h3><i class="fas fa-info-circle"></i> Info</h3>`;
    if (p.address)
      html += `<div class="place-info-row"><i class="fas fa-map-marker-alt"></i> ${_escHtml(p.address)}${p.locality ? ", " + _escHtml(p.locality) : ""}${p.region ? ", " + _escHtml(p.region) : ""}</div>`;
    if (p.phone)
      html += `<div class="place-info-row"><i class="fas fa-phone"></i> <a href="tel:${_escHtml(p.phone)}">${_escHtml(p.phone)}</a></div>`;
    if (p.website)
      html += `<div class="place-info-row"><i class="fas fa-globe"></i> <a href="${_escHtml(p.website)}" target="_blank" rel="noopener">${_escHtml(p.website)}</a></div>`;
    if (p.hours_display)
      html += `<div class="place-info-row"><i class="fas fa-clock"></i> ${_escHtml(p.hours_display)}</div>`;
    if (p.menu_url)
      html += `<div class="place-info-row"><i class="fas fa-utensils"></i> <a href="${_escHtml(p.menu_url)}" target="_blank" rel="noopener">View Menu</a></div>`;
    html += `</div>`;

    // Photos
    if (p.photos && p.photos.length) {
      html += `<div class="place-detail-section">
        <h3><i class="fas fa-camera"></i> Photos (${p.total_photos || p.photos.length}) ${p.photo_source === "unsplash_fallback" ? '<small style="font-weight:500;color:var(--text-muted);">(Unsplash fallback)</small>' : ""}</h3>
        <div class="place-photos-grid">
          ${p.photos.map((ph) => `<img src="${_escHtml(ph.url_medium)}" alt="Place photo" data-action="open-lightbox" data-url="${_escHtml(ph.url)}" />`).join("")}
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
            <p>${_escHtml(t.text)}</p>
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
          ${p.tastes.map((t) => `<span class="place-feature-tag">${_escHtml(t)}</span>`).join("")}
        </div>
      </div>`;
    }

    // Features
    if (p.features && p.features.length) {
      html += `<div class="place-detail-section">
        <h3><i class="fas fa-check-double"></i> Features</h3>
        <div class="place-features-list">
          ${p.features.map((f) => `<span class="place-feature-tag">${_escHtml(f)}</span>`).join("")}
        </div>
      </div>`;
    }

    // Action buttons row
    html += `<div style="margin-top:16px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">`;
    if (p.lat && p.lon) {
      html += `<button class="place-card-btn" data-action="close-and-fly" data-lat="${p.lat}" data-lon="${p.lon}" style="padding:10px 24px;font-size:0.85rem;">
        <i class="fas fa-map-marked-alt"></i> Show on Map
      </button>`;
    }
    html += `<button class="place-card-btn btn-fav ${_getPlaceFavs().some((f) => f.id === fsqId) ? "is-fav" : ""}" data-action="toggle-place-fav" data-fsq-id="${_escHtml(fsqId)}" data-name="${_escHtml(p.name)}" style="padding:10px 24px;font-size:0.85rem;">
      <i class="${_getPlaceFavs().some((f) => f.id === fsqId) ? "fas" : "far"} fa-heart"></i> Favourite
    </button>`;
    html += `</div>`;

    html += `</div>`;
    content.innerHTML = html;
  } catch (err) {
    console.error("Place detail error:", err);
    const fallbackPhotos = await _fetchUnsplashPlacePhotos(placeName, 6);
    if (fallbackPhotos.length) {
      content.innerHTML = `
      <div class="place-modal-card">
        <button style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted);" data-action="close-place-modal">
          <i class="fas fa-times"></i>
        </button>
        <div class="place-detail-header">
          <h2>${_escHtml(placeName)}</h2>
          <div class="place-detail-cats">Details unavailable from Foursquare right now</div>
        </div>
        <div class="place-detail-section">
          <h3><i class="fas fa-camera"></i> Photos (Unsplash fallback)</h3>
          <div class="place-photos-grid">
            ${fallbackPhotos.map((ph) => `<img src="${_escHtml(ph.url_medium)}" alt="Place photo" data-action="open-lightbox" data-url="${_escHtml(ph.url)}" />`).join("")}
          </div>
        </div>
      </div>`;
      return;
    }

    content.innerHTML = `
      <div class="place-modal-card" style="text-align:center;padding:48px;">
        <i class="fas fa-exclamation-circle" style="font-size:2rem;color:var(--danger);margin-bottom:12px;"></i>
        <p>${_escHtml(err.message) || "Could not load place details."}</p>
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

// All place card actions (open-place-detail, close-place-modal, close-and-fly,
// fly-to-poi, open-lightbox, toggle-place-fav) are handled centrally by
// event-delegation.js ACTION_MAP — no duplicate listener needed here.

bindPlacesDestinationContextListener();
