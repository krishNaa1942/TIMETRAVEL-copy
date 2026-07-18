/* =======================================================
 * Time Travel - Trip History - Load and delete saved trips
 * ======================================================= */

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
