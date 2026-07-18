/* =======================================================
 * Time Travel - Trip Dashboard - Wanderlog-style trip planning workspace
 * ======================================================= */

let _tdTrips = [];
let _tdCurrentTrip = null;
let _tdCurrentDayId = null;
let _tdTripMap = null;
let _tdInitialized = false;
let _tdEmptyStateEl = null;

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
  if (!_tdEmptyStateEl) {
    _tdEmptyStateEl = document.getElementById("tdEmptyState");
  }
  const empty = _tdEmptyStateEl;
  let trips = _tdTrips;
  if (status && status !== "all")
    trips = trips.filter((t) => t.status === status);

  if (!trips.length) {
    grid.innerHTML = "";
    if (empty) {
      grid.appendChild(empty);
      empty.style.display = "flex";
    }
    return;
  }
  if (empty) {
    empty.remove();
    empty.style.display = "none";
  }

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
