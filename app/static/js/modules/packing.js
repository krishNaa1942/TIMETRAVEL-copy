/* =======================================================
 * Time Travel - Packing Checklist - Weather-based suggestions and custom items
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
// SMART PACKING CHECKLIST – Weather-based + custom items
// ═══════════════════════════════════════════════════════════
let packingCache = [];

function initPackingChecklist() {
  const genBtn = document.getElementById("packGenBtn");
  const customBtn = document.getElementById("packCustomBtn");
  if (!genBtn) return;

  genBtn.addEventListener("click", async () => {
    const dest = document.getElementById("packDest").value;
    if (!dest) return showToast("Please select a destination.", "warning");

    genBtn.disabled = true;
    genBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';

    try {
      const res = await fetch(`${API_BASE}/api/packing/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify({ destination: dest }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`Packing list for ${dest} generated!`, "success");
        await loadPackingItems();
      } else {
        showToast(data.error || "Failed to generate packing list.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      genBtn.disabled = false;
      genBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Checklist';
    }
  });

  if (customBtn) {
    customBtn.addEventListener("click", addCustomPackingItem);
    const input = document.getElementById("packCustomInput");
    if (input)
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addCustomPackingItem();
      });
  }
}

async function addCustomPackingItem() {
  const input = document.getElementById("packCustomInput");
  const text = input ? input.value.trim() : "";
  if (!text) return;

  const dest = document.getElementById("packDest").value || "General";

  try {
    const res = await fetch(`${API_BASE}/api/packing/custom`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify({ destination: dest, item_text: text }),
    });
    if (res.ok) {
      input.value = "";
      await loadPackingItems();
    } else {
      const data = await res.json();
      showToast(data.error || "Could not add item.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

async function loadPackingItems() {
  if (!currentUser) return;

  try {
    const res = await fetch(`${API_BASE}/api/packing`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    packingCache = data.items || [];
    renderPackingList(packingCache);
  } catch {
    packingCache = [];
  }
}

function renderPackingList(items) {
  const listEl = document.getElementById("packList");
  const progressWrap = document.getElementById("packProgressWrap");
  const progressFill = document.getElementById("packProgressFill");
  const progressText = document.getElementById("packProgressText");
  const customWrap = document.getElementById("packCustomWrap");

  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML =
      '<div class="empty-state" id="packEmpty"><i class="fas fa-suitcase"></i><p>Select a destination and click <strong>Generate Checklist</strong> to get weather-based packing suggestions.</p></div>';
    if (progressWrap) progressWrap.style.display = "none";
    if (customWrap) customWrap.style.display = "none";
    return;
  }

  // Show progress & custom input
  if (progressWrap) progressWrap.style.display = "";
  if (customWrap) customWrap.style.display = "";

  const checked = items.filter((i) => i.is_checked).length;
  const pct = Math.round((checked / items.length) * 100);
  if (progressFill) progressFill.style.width = pct + "%";
  if (progressText)
    progressText.textContent = `${pct}% packed (${checked}/${items.length})`;

  // Group items by destination
  const groups = {};
  items.forEach((i) => {
    const key = i.destination || "General";
    if (!groups[key]) groups[key] = [];
    groups[key].push(i);
  });

  listEl.innerHTML = Object.entries(groups)
    .map(
      ([dest, destItems]) => `
    <div class="pack-group">
      <h4 class="pack-group-title"><i class="fas fa-map-marker-alt"></i> ${dest}</h4>
      ${destItems
        .map(
          (item) => `
        <div class="pack-item ${item.is_checked ? "checked" : ""}">
          <label class="pack-check-label">
            <input type="checkbox" ${item.is_checked ? "checked" : ""} data-action="toggle-packing" data-id="${item.id}" />
            <span class="pack-item-text">${item.item_text}</span>
            ${item.is_custom ? '<span class="pack-custom-badge">custom</span>' : ""}
          </label>
          <button class="pack-del-btn" data-action="delete-packing" data-id="${item.id}" title="Remove"><i class="fas fa-times"></i></button>
        </div>
      `,
        )
        .join("")}
    </div>
  `,
    )
    .join("");
}

async function togglePackingItem(id) {
  try {
    await fetch(`${API_BASE}/api/packing/${id}/toggle`, {
      method: "PUT",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
    // Update local cache without re-fetching
    const item = packingCache.find((i) => i.id === id);
    if (item) item.is_checked = !item.is_checked;
    renderPackingList(packingCache);
  } catch {
    showToast("Could not update item.", "error");
  }
}

async function deletePackingItem(id) {
  try {
    const res = await fetch(`${API_BASE}/api/packing/${id}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
    if (res.ok) {
      packingCache = packingCache.filter((i) => i.id !== id);
      renderPackingList(packingCache);
    }
  } catch {
    showToast("Network error.", "error");
  }
}
