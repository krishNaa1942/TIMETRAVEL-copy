/* =======================================================
 * Time Travel - Live Location - GPS tracking, accuracy circle, smart suggestions
 * ======================================================= */

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
document.getElementById("liveLocBtn")?.addEventListener("click", () => {
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
