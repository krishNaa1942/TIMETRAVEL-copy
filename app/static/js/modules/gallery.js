/* =======================================================
 * Time Travel - Destination Gallery - Unsplash images, DEST_META, lightbox, filters
 * ======================================================= */

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
    "#4da8da",
    "#1b263b",
    "#ff7e5f",
    "#ffd93d",
    "#78c4ea",
    "#2e7fae",
    "#f5f7fa",
    "#24324a",
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
      <div class="dest-card-inner" data-action="open-smart-hub-dest" data-dest="${name}" role="button" tabindex="0" aria-label="Explore ${name} in Smart Destination Hub">
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

  // Enable keyboard-first exploration for each destination card.
  initDestCardKeyboardAccess();

  // Observe cards for scroll-triggered reveal + lazy live data
  observeDestCards();

  // Lazy-load live weather badges when cards scroll into view
  observeDestLiveData();
}

/** Add Enter/Space keyboard activation for destination cards. */
function initDestCardKeyboardAccess() {
  document.querySelectorAll('.dest-card-inner[role="button"]').forEach((cardInner) => {
    if (cardInner.dataset.kbdBound === "1") return;
    cardInner.dataset.kbdBound = "1";

    cardInner.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;

      const nestedInteractive = e.target.closest(
        "button, a, input, select, textarea",
      );
      if (nestedInteractive && nestedInteractive !== cardInner) return;

      e.preventDefault();
      const dest = cardInner.getAttribute("data-dest");
      if (dest && typeof openSmartHub === "function") openSmartHub(dest);
    });
  });
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

/** Fallback destination metadata maps (used to enrich shared DEST_META from maps API) */
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

// Enrich shared DEST_META loaded in maps.js without redeclaring it.
if (typeof DEST_META !== "undefined" && DEST_META) {
  Object.entries(DEST_META_FALLBACK).forEach(([key, meta]) => {
    DEST_META[key] = { ...meta, ...(DEST_META[key] || {}) };
  });
}

function getDestMeta(key) {
  const shared =
    typeof DEST_META !== "undefined" && DEST_META ? DEST_META[key] : null;
  const fallback = DEST_META_FALLBACK[key] || {};
  return { ...fallback, ...(shared || {}) };
}

function getDestTags(key) {
  return getDestMeta(key).tags || ["nature"];
}
function getDestRegion(key) {
  return getDestMeta(key).region || "India";
}
function getDestSeason(key) {
  return getDestMeta(key).season || "Oct–Mar";
}
function getDestHighlight(key) {
  return getDestMeta(key).highlight || "Explore";
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
        .forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
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
        .forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      const gallery = document.getElementById("destGallery");
      if (gallery) {
        gallery.classList.remove("dest-view-grid", "dest-view-list");
        gallery.classList.add("dest-view-" + btn.dataset.view);
      }
      updateDestHubStatus();
    });
  });

  // Apply default sort (Trending)
  sortDestinations();
  updateDestHubStatus();
}

/** Keep Smart Destination Hub status pills synchronized with current controls. */
function updateDestHubStatus(visibleCount) {
  const activeFilter = document.querySelector(".dest-filter-btn.active");
  const activeViewBtn = document.querySelector(".dest-view-btn.active");
  const sortSel = document.getElementById("destSortSelect");
  const searchVal = (document.getElementById("destSearchInput")?.value || "")
    .trim()
    .replace(/\s+/g, " ");

  const filterText = activeFilter
    ? activeFilter.textContent.replace(/\s+/g, " ").trim()
    : "All";
  const viewText = activeViewBtn?.dataset.view === "list" ? "List view" : "Grid view";
  const sortText =
    sortSel && sortSel.selectedIndex >= 0
      ? sortSel.options[sortSel.selectedIndex].textContent.trim()
      : "Trending";

  const filterEl = document.getElementById("destStatusFilter");
  const viewEl = document.getElementById("destStatusView");
  const sortEl = document.getElementById("destStatusSort");
  const queryEl = document.getElementById("destStatusQuery");

  if (filterEl) filterEl.textContent = filterText;
  if (viewEl) viewEl.textContent = viewText;
  if (sortEl) sortEl.textContent = sortText;
  if (queryEl) {
    queryEl.textContent = searchVal ? `Search: ${searchVal}` : "No active search";
  }

  const hubBar = document.getElementById("destHubStatus");
  if (hubBar) {
    const visible =
      typeof visibleCount === "number" ? visibleCount : getVisibleDestinationCount();
    hubBar.setAttribute(
      "aria-label",
      `${visible} destination${visible === 1 ? "" : "s"} shown`,
    );
  }
}

function getVisibleDestinationCount() {
  const cards = document.querySelectorAll(".dest-card");
  let visible = 0;
  cards.forEach((card) => {
    if (card.style.display !== "none") visible++;
  });
  return visible;
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

  updateDestHubStatus(visibleCount);
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

  updateDestHubStatus();
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
      <div class="dest-photo-item" style="animation-delay:${i * 0.08}s" data-action="open-lightbox" data-url="${p.url_regular}" data-alt="${(p.alt || "").replace(/'/g, "\\'")}" data-photographer="${p.photographer}" data-photographer-url="${p.photographer_url}" data-stop-propagation>
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

// Make gallery loader available for modules that initialize on DOMContentLoaded.
window.loadDestinationGallery = loadDestinationGallery;
document.dispatchEvent(new CustomEvent("gallery:ready"));
