/* =======================================================
 * Time Travel - Favorites and Wishlist - Save, toggle, render favorite destinations
 * ======================================================= */

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
