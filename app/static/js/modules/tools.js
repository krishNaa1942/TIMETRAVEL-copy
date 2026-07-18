/* =======================================================
 * Time Travel - Travel Tools - Budget estimator, safety score, weather checker
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
// BUDGET ESTIMATOR
// ═══════════════════════════════════════════════════════════
document.getElementById("budgetSubmit")?.addEventListener("click", async () => {
  const destEl = document.getElementById("budgetDest");
  const daysEl = document.getElementById("budgetDays");
  const familyEl = document.getElementById("budgetFamily");
  const dest = destEl.value;
  const days = parseInt(daysEl.value);
  const family = parseInt(familyEl.value);
  const cls = document.getElementById("budgetClass").value;

  // Clear previous highlights
  [destEl, daysEl, familyEl].forEach((el) =>
    el.classList.remove("input-invalid"),
  );

  let hasError = false;
  if (!dest) {
    destEl.classList.add("input-invalid");
    hasError = true;
  }
  if (!days || days < 1) {
    daysEl.classList.add("input-invalid");
    hasError = true;
  }
  if (!family || family < 1) {
    familyEl.classList.add("input-invalid");
    hasError = true;
  }

  if (hasError)
    return showToast("Please fill in all required fields.", "warning");

  document.getElementById("budgetResult").innerHTML = `
    <div class="tool-skeleton">
      <div class="skel-bar w60"></div>
      <div class="skel-bar w80"></div>
      <div class="skel-bar w40"></div>
      <div class="skel-bar w70"></div>
      <div class="skel-bar w50"></div>
    </div>`;
  try {
    const res = await fetch(`${API_BASE}/api/budget/estimate`, {
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
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      document.getElementById("budgetResult").innerHTML = `
                <div class="result-placeholder"><i class="fas fa-exclamation-triangle"></i><p>${data.error}</p></div>`;
      return;
    }

    const icons = {
      accommodation: "fa-bed",
      food: "fa-utensils",
      transport: "fa-bus",
      activities: "fa-hiking",
      miscellaneous: "fa-ellipsis-h",
    };

    const items = [
      "accommodation",
      "food",
      "transport",
      "activities",
      "miscellaneous",
    ]
      .map(
        (key) => `
                <div class="budget-item">
                    <span class="budget-item-label">
                        <i class="fas ${icons[key]}"></i>
                        ${key.charAt(0).toUpperCase() + key.slice(1)}
                    </span>
                    <span class="budget-item-value">${formatINR(data[key])}</span>
                </div>
            `,
      )
      .join("");

    document.getElementById("budgetResult").innerHTML = `
            <div class="budget-breakdown">
                <div class="budget-header">
                    <h3><i class="fas fa-map-marker-alt" style="color:var(--primary);margin-right:8px;"></i>${data.destination}</h3>
                    <div class="budget-total">${formatINR(data.total)}</div>
                </div>
                <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px;">
                    ${data.num_days} days · ${data.family_size} people · ${data.travel_class} class
                </p>
                <div class="budget-items">${items}</div>
                <button class="btn-export" id="exportBudgetPdf">
                    <i class="fas fa-file-pdf"></i> Export as PDF
                </button>
            </div>
        `;
    // Wire up export button
    document.getElementById("exportBudgetPdf").addEventListener("click", () => {
      downloadPDF("/api/export/budget", data, `${data.destination}_Budget.pdf`);
    });
  } catch (err) {
    document.getElementById("budgetResult").innerHTML = "";
    showToast("Network error – is the server running?", "error");
  }
});

// ═══════════════════════════════════════════════════════════
// SAFETY SCORE
// ═══════════════════════════════════════════════════════════
document.getElementById("safetySubmit")?.addEventListener("click", async () => {
  const destEl = document.getElementById("safetyDest");
  const dest = destEl.value;
  destEl.classList.remove("input-invalid");
  if (!dest) {
    destEl.classList.add("input-invalid");
    return showToast("Please select a destination.", "warning");
  }

  document.getElementById("safetyResult").innerHTML = `
    <div class="tool-skeleton">
      <div class="skel-circle"></div>
      <div class="skel-bar w60"></div>
      <div class="skel-bar w80"></div>
      <div class="skel-bar w70"></div>
      <div class="skel-bar w80"></div>
    </div>`;
  try {
    const res = await fetch(
      `${API_BASE}/api/safety/${encodeURIComponent(dest)}`,
    );
    const data = await res.json();

    if (!res.ok) {
      document.getElementById("safetyResult").innerHTML = `
                <div class="result-placeholder light"><i class="fas fa-exclamation-triangle"></i><p>${data.error}</p></div>`;
      return;
    }

    const scoreClass =
      data.overall_score >= 7
        ? "score-high"
        : data.overall_score >= 4
          ? "score-medium"
          : "score-low";

    function barColor(val) {
      if (val >= 7) return "#10b981";
      if (val >= 4) return "#f59e0b";
      return "#ef4444";
    }

    const bars = [
      { label: "Crime Safety", key: "crime_score" },
      { label: "Health & Medical", key: "health_score" },
      { label: "Infrastructure", key: "infrastructure_score" },
      { label: "Tourist Friendliness", key: "tourist_friendliness" },
    ]
      .map(
        (b) => `
            <div class="safety-bar-item">
                <div class="safety-bar-label">
                    <span>${b.label}</span>
                    <span>${data[b.key]}/10</span>
                </div>
                <div class="safety-bar-track">
                    <div class="safety-bar-fill" style="width:${data[b.key] * 10}%;background:${barColor(data[b.key])};"></div>
                </div>
            </div>
        `,
      )
      .join("");

    document.getElementById("safetyResult").innerHTML = `
            <div class="safety-result">
                <div class="safety-header">
                    <div class="safety-score-circle ${scoreClass}">${data.overall_score}</div>
                    <h3 style="font-size:1.2rem;">${data.destination}</h3>
                </div>
                <div class="safety-advisory">${data.advisory}</div>
                <div class="safety-bars">${bars}</div>
            </div>
        `;
  } catch (err) {
    document.getElementById("safetyResult").innerHTML = "";
    showToast("Network error – is the server running?", "error");
  }
});

// ═══════════════════════════════════════════════════════════
// WEATHER & PACKING
// ═══════════════════════════════════════════════════════════
document
  .getElementById("weatherSubmit")
  ?.addEventListener("click", async () => {
    const destEl = document.getElementById("weatherDest");
    const dest = destEl.value;
    destEl.classList.remove("input-invalid");
    if (!dest) {
      destEl.classList.add("input-invalid");
      return showToast("Please select a destination.", "warning");
    }

    document.getElementById("weatherResult").innerHTML = `
      <div class="tool-skeleton">
        <div class="skel-circle"></div>
        <div class="skel-bar w50"></div>
        <div class="skel-bar w80"></div>
        <div class="skel-bar w60"></div>
      </div>`;
    try {
      const res = await fetch(
        `${API_BASE}/api/weather/${encodeURIComponent(dest)}`,
      );
      const data = await res.json();

      if (!res.ok) {
        document.getElementById("weatherResult").innerHTML = `
                <div class="result-placeholder"><i class="fas fa-exclamation-triangle"></i><p>${data.error}${data.hint ? "<br><small>" + data.hint + "</small>" : ""}</p></div>`;
        return;
      }

      const packingTags = (data.packing_suggestions || [])
        .map((s) => `<span class="packing-tag">${s}</span>`)
        .join("");

      document.getElementById("weatherResult").innerHTML = `
            <div class="weather-result">
                <div class="weather-header">
                    <div class="weather-temp">${Math.round(data.temperature_c)}<sup>°C</sup></div>
                    <div class="weather-meta">
                        <strong>${data.destination}</strong>
                        ${data.description}
                    </div>
                </div>
                <div class="weather-details">
                    <div class="weather-detail">
                        <i class="fas fa-temperature-low"></i>
                        <div class="detail-value">${data.feels_like_c}°C</div>
                        <div class="detail-label">Feels Like</div>
                    </div>
                    <div class="weather-detail">
                        <i class="fas fa-tint"></i>
                        <div class="detail-value">${data.humidity}%</div>
                        <div class="detail-label">Humidity</div>
                    </div>
                    <div class="weather-detail">
                        <i class="fas fa-wind"></i>
                        <div class="detail-value">${data.wind_speed_kmh} km/h</div>
                        <div class="detail-label">Wind Speed</div>
                    </div>
                </div>
                <h4 class="packing-title"><i class="fas fa-suitcase-rolling"></i> Packing Suggestions</h4>
                <div class="packing-list">${packingTags}</div>
            </div>
        `;
    } catch (err) {
      document.getElementById("weatherResult").innerHTML = "";
      showToast("Network error – is the server running?", "error");
    }
  });

let _toolsCtxTimer = null;
let _toolsLastCtxId = "";

function _syncToolDestination(selectId, destination) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const match = Array.from(sel.options || []).find(
    (o) => (o.value || "").toLowerCase() === destination.toLowerCase(),
  );
  if (match) {
    sel.value = match.value;
  } else {
    const opt = document.createElement("option");
    opt.value = destination;
    opt.textContent = destination;
    sel.appendChild(opt);
    sel.value = destination;
  }
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  sel.dispatchEvent(new Event("input", { bubbles: true }));
}

function bindToolsDestinationContextListener() {
  if (window._ttToolsCtxBound) return;
  window._ttToolsCtxBound = true;

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

    clearTimeout(_toolsCtxTimer);
    _toolsCtxTimer = setTimeout(() => {
      const dedupeId =
        detail.contextId || `${dest.toLowerCase()}:${detail.autoRun ? 1 : 0}`;
      if (dedupeId === _toolsLastCtxId) return;
      _toolsLastCtxId = dedupeId;

      _syncToolDestination("budgetDest", dest);
      _syncToolDestination("safetyDest", dest);
      _syncToolDestination("weatherDest", dest);

      if (detail.autoRun) {
        ["budgetSubmit", "safetySubmit", "weatherSubmit"].forEach((id, idx) => {
          setTimeout(
            () => {
              const btn = document.getElementById(id);
              if (btn && !btn.disabled) btn.click();
            },
            100 + idx * 140,
          );
        });
      }
    }, 240);
  });
}

bindToolsDestinationContextListener();
