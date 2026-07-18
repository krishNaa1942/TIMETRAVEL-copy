/* =======================================================
 * Time Travel - AI Itinerary - Generator, sharing, drag-drop reorder, timeline view
 * ======================================================= */

document.getElementById("itinSubmit")?.addEventListener("click", async () => {
  const destEl = document.getElementById("itinDest");
  const daysEl = document.getElementById("itinDays");
  const familyEl = document.getElementById("itinFamily");
  const dest = destEl.value;
  const days = parseInt(daysEl.value);
  const family = parseInt(familyEl.value);
  const cls = document.getElementById("itinClass").value;
  const interests = document.getElementById("itinInterests").value.trim();

  // Clear previous highlights
  [destEl, daysEl, familyEl].forEach((el) =>
    el.classList.remove("input-invalid"),
  );

  let hasError = false;
  if (!dest) {
    destEl.classList.add("input-invalid");
    hasError = true;
  }
  if (!days || days < 1 || days > 14) {
    daysEl.classList.add("input-invalid");
    hasError = true;
  }
  if (!family || family < 1) {
    familyEl.classList.add("input-invalid");
    hasError = true;
  }

  if (hasError)
    return showToast("Please fill in all required fields.", "warning");

  const resultDiv = document.getElementById("itinResult");
  resultDiv.innerHTML = `
    <div class="result-placeholder">
      <i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--primary-light)"></i>
      <p style="margin-top:12px">Generating your personalised itinerary…<br>
      <small style="color:var(--text-muted)">This may take 10–20 seconds</small></p>
    </div>`;

  try {
    const res = await fetch(`${API_BASE}/api/itinerary/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify({
        destination: dest,
        num_days: days,
        family_size: family,
        travel_class: cls,
        interests: interests,
      }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      resultDiv.innerHTML = `
        <div class="result-placeholder">
          <i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i>
          <p>${data.error || "Failed to generate itinerary."}</p>
        </div>`;
      return;
    }

    if (data.warning) {
      showToast(data.warning, "warning", 5000);
    }

    resultDiv.innerHTML = renderItinerary(data);

    // Wire up accordion toggles
    resultDiv.querySelectorAll(".itin-day-header").forEach((hdr) => {
      hdr.addEventListener("click", () => {
        hdr.closest(".itin-day").classList.toggle("open");
      });
    });

    // Wire up PDF export
    const itinExportBtn = resultDiv.querySelector("#exportItinPdf");
    if (itinExportBtn) {
      itinExportBtn.addEventListener("click", () => {
        downloadPDF(
          "/api/export/itinerary",
          data,
          `${data.destination}_Itinerary.pdf`,
        );
      });
    }

    // Wire up Share Trip button
    const shareBtn = resultDiv.querySelector("#shareItinBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", () => shareItinerary(data));
    }

    // Wire up view toggle (Accordion / Timeline)
    resultDiv.querySelectorAll(".itin-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        resultDiv
          .querySelectorAll(".itin-view-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const view = btn.dataset.view;
        const accordionView = resultDiv.querySelector(".itin-accordion-view");
        const timelineView = resultDiv.querySelector(".itin-timeline-view");
        if (view === "timeline") {
          accordionView.style.display = "none";
          timelineView.style.display = "";
          timelineView.innerHTML = renderTimelineView(data);
        } else {
          accordionView.style.display = "";
          timelineView.style.display = "none";
        }
      });
    });

    // Wire up drag-and-drop for itinerary slots
    initItineraryDragDrop(resultDiv, data);

    showToast(`${days}-day itinerary for ${dest} ready!`, "success");
  } catch (err) {
    resultDiv.innerHTML = `
      <div class="result-placeholder">
        <i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i>
        <p>Network error – is the server running?</p>
      </div>`;
    showToast("Network error – is the server running?", "error");
  }
});

function renderItinerary(data) {
  const SLOT_ICONS = {
    morning: { icon: "fas fa-sun", cls: "morning", label: "Morning" },
    afternoon: {
      icon: "fas fa-cloud-sun",
      cls: "afternoon",
      label: "Afternoon",
    },
    evening: { icon: "fas fa-moon", cls: "evening", label: "Evening" },
  };

  const dayCards = data.itinerary
    .map((day, idx) => {
      const slots = ["morning", "afternoon", "evening"]
        .map((period) => {
          const s = day[period];
          if (!s) return "";
          const meta = SLOT_ICONS[period];
          return `
          <div class="itin-slot" draggable="true" data-day="${idx}" data-period="${period}">
            <div class="itin-slot-icon ${meta.cls}"><i class="${meta.icon}"></i></div>
            <div class="itin-slot-content">
              <div class="itin-slot-label">${meta.label}</div>
              <div class="itin-slot-activity" contenteditable="true" title="Click to edit">${s.activity || ""}</div>
              <div class="itin-slot-desc">${s.description || ""}</div>
              <div class="itin-slot-meta">
                ${s.duration ? `<span><i class="fas fa-clock"></i>${s.duration}</span>` : ""}
                ${s.cost ? `<span><i class="fas fa-rupee-sign"></i>${s.cost}</span>` : ""}
              </div>
            </div>
          </div>`;
        })
        .join("");

      const tip = day.tip
        ? `<div class="itin-tip"><i class="fas fa-lightbulb"></i>${day.tip}</div>`
        : "";

      return `
        <div class="itin-day ${idx === 0 ? "open" : ""}">
          <div class="itin-day-header">
            <div class="itin-day-badge">${day.day || idx + 1}</div>
            <div class="itin-day-title">${day.title || `Day ${idx + 1}`}</div>
            <div class="itin-day-toggle"><i class="fas fa-chevron-down"></i></div>
          </div>
          <div class="itin-day-body">
            <div class="itin-slots">${slots}</div>
            ${tip}
          </div>
        </div>`;
    })
    .join("");

  const isFallback = data.source === "fallback";
  const sourceBadge = isFallback
    ? `<span class="itin-source-badge fallback"><i class="fas fa-triangle-exclamation"></i> AI fallback mode</span>`
    : `<span class="itin-source-badge ai"><i class="fas fa-brain"></i> AI generated</span>`;

  const sourceNote = data.warning
    ? `<p class="itin-source-note">${data.warning}</p>`
    : "";

  return `
    <div class="itin-timeline">
      <div style="text-align:center;margin-bottom:8px;">
        <span style="background:var(--primary);color:#fff;padding:6px 16px;border-radius:20px;font-size:0.85rem;font-weight:600">
          <i class="fas fa-route"></i> ${data.num_days}-Day ${data.destination} Itinerary
        </span>
      </div>
      <div style="text-align:center;margin-top:-2px;margin-bottom:4px;">
        ${sourceBadge}
      </div>
      ${sourceNote}
      <div class="itin-view-toggle" style="text-align:center;margin-bottom:12px;">
        <button class="btn btn-sm btn-outline itin-view-btn active" data-view="accordion"><i class="fas fa-list"></i> Accordion</button>
        <button class="btn btn-sm btn-outline itin-view-btn" data-view="timeline"><i class="fas fa-stream"></i> Timeline</button>
      </div>
      <div class="itin-accordion-view">${dayCards}</div>
      <div class="itin-timeline-view" style="display:none"></div>
      <div style="text-align:center;margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn-export" id="exportItinPdf">
          <i class="fas fa-file-pdf"></i> Export as PDF
        </button>
        <button class="btn-export" id="shareItinBtn" style="background:var(--primary)">
          <i class="fas fa-share-alt"></i> Share Trip
        </button>
      </div>
      <div id="shareResult" style="display:none;text-align:center;margin-top:10px;"></div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// TRIP SHARING – Generate shareable links for itineraries
// ═══════════════════════════════════════════════════════════
async function shareItinerary(data) {
  if (!currentUser) {
    showToast("Please log in to share trips.", "warning");
    openAuthModal("login");
    return;
  }

  const shareResultDiv = document.getElementById("shareResult");
  if (!shareResultDiv) return;

  try {
    const res = await fetch(`${API_BASE}/api/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify({
        title: `${data.num_days}-Day ${data.destination} Trip`,
        itinerary_json: JSON.stringify(data),
        notes: `${data.destination} itinerary for ${data.family_size || 1} people`,
      }),
    });
    const result = await res.json();

    if (res.ok) {
      const shareUrl = `${window.location.origin}/api/share/${result.share_token}`;
      shareResultDiv.style.display = "block";
      shareResultDiv.innerHTML = `
        <div class="share-link-box">
          <i class="fas fa-link"></i>
          <input type="text" value="${shareUrl}" readonly id="shareLinkInput" />
          <button class="btn btn-sm btn-primary" data-action="copy-share-link"><i class="fas fa-copy"></i> Copy</button>
        </div>
        <small style="color:var(--text-muted)">Anyone with this link can view your trip</small>
      `;
      showToast("Share link created!", "success");
    } else {
      showToast(result.error || "Could not create share link.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

function copyShareLink() {
  const input = document.getElementById("shareLinkInput");
  if (!input) return;
  input.select();
  navigator.clipboard
    .writeText(input.value)
    .then(() => {
      showToast("Link copied to clipboard!", "success");
    })
    .catch(() => {
      document.execCommand("copy");
      showToast("Link copied!", "success");
    });
}

// ═══════════════════════════════════════════════════════════
// ITINERARY DRAG-AND-DROP – Reorder activities
// ═══════════════════════════════════════════════════════════
function initItineraryDragDrop(container, data) {
  let dragSrc = null;

  container.querySelectorAll(".itin-slot[draggable]").forEach((slot) => {
    slot.addEventListener("dragstart", (e) => {
      dragSrc = slot;
      slot.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");
    });

    slot.addEventListener("dragend", () => {
      slot.classList.remove("dragging");
      container
        .querySelectorAll(".itin-slot")
        .forEach((s) => s.classList.remove("drag-over"));
    });

    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      slot.classList.add("drag-over");
    });

    slot.addEventListener("dragleave", () => {
      slot.classList.remove("drag-over");
    });

    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("drag-over");
      if (dragSrc && dragSrc !== slot) {
        // Swap the slots in the DOM
        const parent = slot.parentNode;
        const srcParent = dragSrc.parentNode;
        const srcNext = dragSrc.nextSibling;

        parent.insertBefore(dragSrc, slot);
        if (srcNext) {
          srcParent.insertBefore(slot, srcNext);
        } else {
          srcParent.appendChild(slot);
        }
        showToast("Activity reordered!", "info");
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
// TIMELINE VIEW – Visual timeline for itinerary
// ═══════════════════════════════════════════════════════════
function renderTimelineView(data) {
  if (!data || !data.itinerary) return "<p>No itinerary data.</p>";

  const PERIOD_COLORS = {
    morning: "#f59e0b",
    afternoon: "#3b82f6",
    evening: "#8b5cf6",
  };
  const PERIOD_ICONS = {
    morning: "fa-sun",
    afternoon: "fa-cloud-sun",
    evening: "fa-moon",
  };
  const PERIOD_TIMES = {
    morning: "8:00 AM",
    afternoon: "1:00 PM",
    evening: "6:00 PM",
  };

  const items = [];
  data.itinerary.forEach((day, idx) => {
    items.push({
      type: "day",
      label: day.title || `Day ${idx + 1}`,
      dayNum: day.day || idx + 1,
    });
    ["morning", "afternoon", "evening"].forEach((period) => {
      if (day[period]) {
        items.push({
          type: "activity",
          period,
          activity: day[period].activity || "",
          description: day[period].description || "",
          duration: day[period].duration || "",
          cost: day[period].cost || "",
          time: PERIOD_TIMES[period],
        });
      }
    });
  });

  return `
    <div class="timeline-container">
      ${items
        .map((item) => {
          if (item.type === "day") {
            return `<div class="timeline-day-marker"><span class="timeline-day-badge">Day ${item.dayNum}</span> <span class="timeline-day-label">${item.label}</span></div>`;
          }
          return `
          <div class="timeline-item">
            <div class="timeline-dot" style="background:${PERIOD_COLORS[item.period]}"></div>
            <div class="timeline-time">${item.time}</div>
            <div class="timeline-card">
              <div class="timeline-card-header">
                <i class="fas ${PERIOD_ICONS[item.period]}" style="color:${PERIOD_COLORS[item.period]}"></i>
                <strong>${item.activity}</strong>
              </div>
              <p>${item.description}</p>
              <div class="timeline-card-meta">
                ${item.duration ? `<span><i class="fas fa-clock"></i> ${item.duration}</span>` : ""}
                ${item.cost ? `<span><i class="fas fa-rupee-sign"></i> ${item.cost}</span>` : ""}
              </div>
            </div>
          </div>`;
        })
        .join("")}
    </div>`;
}
