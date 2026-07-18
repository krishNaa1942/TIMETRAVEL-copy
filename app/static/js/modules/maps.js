/* =======================================================
 * Time Travel - Interactive Map - TomTom map, destinations data, route planner
 * ======================================================= */

// INTERACTIVE MAP (TomTom)
// ═══════════════════════════════════════════════════════════
let TOMTOM_KEY = ""; // fetched from /api/maps/config at runtime

let ttMap = null;
let mapMarkers = [];
let routeLayer = null;
let _mapCtxTimer = null;
let _mapLastCtxId = "";

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

    // Build DEST_COORDS from API response
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
    } catch (_) {
      // Metadata is non-critical; continue without it
    }

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
  if (tt.FullscreenControl) {
    ttMap.addControl(new tt.FullscreenControl());
  }

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
  // Keep destination markers, remove POI markers
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

function _mapResolveDestKey(rawDest) {
  const dest = (rawDest || "").trim().toLowerCase();
  if (!dest) return null;
  for (const [key, d] of Object.entries(DEST_COORDS || {})) {
    if (key.toLowerCase() === dest || (d.label || "").toLowerCase() === dest) {
      return key;
    }
  }
  return null;
}

function bindMapDestinationContextListener() {
  if (window._ttMapCtxBound) return;
  window._ttMapCtxBound = true;

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

    clearTimeout(_mapCtxTimer);
    _mapCtxTimer = setTimeout(() => {
      const key = _mapResolveDestKey(dest);
      if (!key) return;

      const dedupeId = detail.contextId || `${key}:${detail.autoRun ? 1 : 0}`;
      if (dedupeId === _mapLastCtxId) return;
      _mapLastCtxId = dedupeId;

      const mapDest = document.getElementById("mapDest");
      if (mapDest) {
        mapDest.value = key;
        mapDest.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (detail.autoRun) {
        const exploreBtn = document.getElementById("mapExploreBtn");
        if (exploreBtn && !exploreBtn.disabled) exploreBtn.click();
      }
    }, 220);
  });
}

// ── Explore Nearby POIs ──────────────────────────────────
document
  .getElementById("mapExploreBtn")
  ?.addEventListener("click", async () => {
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
document.getElementById("mapRouteBtn")?.addEventListener("click", async () => {
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

// ── Resize map when navigating to maps route ─────────────
window.addEventListener("routechange", (e) => {
  if (e.detail.route === "maps" && ttMap) {
    setTimeout(() => ttMap.resize(), 120);
  }
});

// ── Sync map destination dropdown with Explore click ─────
document.getElementById("mapDest")?.addEventListener("change", function () {
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
  bindMapDestinationContextListener();
  checkChatStatus(); // Check if Gemini AI is available
  // Load gallery after DEST_COORDS are ready. Guard in case gallery script initializes later.
  if (typeof loadDestinationGallery === "function") {
    loadDestinationGallery();
  } else {
    document.addEventListener(
      "gallery:ready",
      () => {
        if (typeof loadDestinationGallery === "function") {
          loadDestinationGallery();
        }
      },
      { once: true },
    );
  }
});
