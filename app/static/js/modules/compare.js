/* =======================================================
 * Time Travel - Destination Comparison - Side-by-side destination analysis
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
(function initCompare() {
  const cmpDest1 = document.getElementById("cmpDest1");
  const cmpDest2 = document.getElementById("cmpDest2");
  const cmpMeta1 = document.getElementById("cmpMeta1");
  const cmpMeta2 = document.getElementById("cmpMeta2");
  const cmpPickCard1 = document.getElementById("cmpPickCard1");
  const cmpPickCard2 = document.getElementById("cmpPickCard2");
  const cmpResult = document.getElementById("cmpResult");

  if (!cmpDest1 || !cmpDest2) return;

  // ── Destination preview meta on select ──
  function renderPickMeta(val, metaEl, cardEl) {
    // Try multiple key formats: "goa", "leh_ladakh", etc.
    const key = val.toLowerCase().replace(/[\s-]+/g, "_");
    const m =
      typeof DEST_META !== "undefined" &&
      (DEST_META[key] ||
        DEST_META[val.toLowerCase()] ||
        Object.values(DEST_META).find(
          (v) => v.label === val || v.region === val,
        ));
    if (m && (m.region || m.season || m.highlight)) {
      metaEl.innerHTML = `<span class="cmp-meta-region"><i class="fas fa-map-pin"></i> ${m.region}</span>
        <span class="cmp-meta-season"><i class="fas fa-sun"></i> ${m.season}</span>
        <span class="cmp-meta-hl"><i class="fas fa-star"></i> ${m.highlight}</span>`;
      cardEl.classList.add("selected");
    } else {
      metaEl.innerHTML = "";
      cardEl.classList.remove("selected");
    }
  }
  cmpDest1.addEventListener("change", () =>
    renderPickMeta(cmpDest1.value, cmpMeta1, cmpPickCard1),
  );
  cmpDest2.addEventListener("change", () =>
    renderPickMeta(cmpDest2.value, cmpMeta2, cmpPickCard2),
  );

  // ── Popular matchup chips ──
  document.querySelectorAll(".cmp-popular-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const d1 = chip.dataset.d1;
      const d2 = chip.dataset.d2;
      if (cmpDest1) {
        cmpDest1.value = d1;
        renderPickMeta(d1, cmpMeta1, cmpPickCard1);
      }
      if (cmpDest2) {
        cmpDest2.value = d2;
        renderPickMeta(d2, cmpMeta2, cmpPickCard2);
      }
      document
        .querySelectorAll(".cmp-popular-chip")
        .forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });

  // ── Compare submit ──
  document.getElementById("cmpSubmit")?.addEventListener("click", async () => {
    const d1 = cmpDest1.value;
    const d2 = cmpDest2.value;
    const days = parseInt(document.getElementById("cmpDays").value) || 5;
    const family = parseInt(document.getElementById("cmpFamily").value) || 4;
    const cls = document.getElementById("cmpClass").value;

    // Clear previous highlights
    [cmpDest1, cmpDest2].forEach((el) => el.classList.remove("input-invalid"));

    if (!d1 || !d2) {
      if (!d1) cmpDest1.classList.add("input-invalid");
      if (!d2) cmpDest2.classList.add("input-invalid");
      return showToast("Please select both destinations.", "warning");
    }
    if (d1 === d2) {
      cmpDest2.classList.add("input-invalid");
      return showToast("Choose two different destinations.", "warning");
    }

    showLoader();
    cmpResult.innerHTML = `
      <div class="tool-skeleton" style="display:flex;gap:24px;">
        <div style="flex:1"><div class="skel-bar w60"></div><div class="skel-bar w80"></div><div class="skel-bar w50"></div><div class="skel-bar w70"></div></div>
        <div style="flex:1"><div class="skel-bar w60"></div><div class="skel-bar w80"></div><div class="skel-bar w50"></div><div class="skel-bar w70"></div></div>
      </div>`;
    try {
      const url = `${API_BASE}/api/compare?dest1=${encodeURIComponent(d1)}&dest2=${encodeURIComponent(d2)}&days=${days}&family=${family}&class=${cls}`;
      const res = await fetch(url);
      const data = await res.json();
      hideLoader();
      if (!res.ok) {
        showToast(data.error || "Comparison failed.", "error");
        cmpResult.innerHTML = "";
        return;
      }
      cmpResult.innerHTML = renderComparison(data);
      cmpResult._exportData = data;

      // Animate score bars
      setTimeout(() => {
        cmpResult.querySelectorAll(".cmp-score-fill").forEach((bar) => {
          bar.style.width = bar.dataset.w;
        });
      }, 100);

      // PDF export
      const exportBtn = document.getElementById("exportCmpPdf");
      if (exportBtn) {
        exportBtn.addEventListener("click", () => {
          const ed = cmpResult._exportData;
          if (!ed) return showToast("No comparison data to export.", "warning");
          downloadPDF(
            "/api/export/comparison",
            ed,
            `${ed.dest1?.destination || "A"}_vs_${ed.dest2?.destination || "B"}_Comparison.pdf`,
          );
        });
      }

      // Share button
      const shareBtn = document.getElementById("cmpShareBtn");
      if (shareBtn) {
        shareBtn.addEventListener("click", () => {
          const text = `Compare: ${d1} vs ${d2} (${days} days, ${family} people, ${cls}) on Time Travel!`;
          if (navigator.share) {
            navigator.share({
              title: "Time Travel Comparison",
              text,
              url: window.location.href,
            });
          } else {
            navigator.clipboard
              .writeText(text)
              .then(() => showToast("Comparison link copied!", "success"));
          }
        });
      }

      cmpResult.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast(`${d1} vs ${d2} — comparison ready!`, "success");
    } catch (err) {
      hideLoader();
      showToast("Network error – is the server running?", "error");
    }
  });
})();

// ── Compare renderer ──────────────────────────────────────
function renderComparison(data) {
  const p1 = data.dest1;
  const p2 = data.dest2;
  const params = data.params;

  function destKey(name) {
    return name.toLowerCase().replace(/[\s-]+/g, "_");
  }
  function getMeta(name) {
    return (typeof DEST_META !== "undefined" && DEST_META[destKey(name)]) || {};
  }

  function scoreColor(val) {
    if (val >= 7) return "#10b981";
    if (val >= 5) return "#f59e0b";
    return "#ef4444";
  }

  function scoreLabel(val) {
    if (val >= 8) return "Excellent";
    if (val >= 6) return "Good";
    if (val >= 4) return "Fair";
    return "Poor";
  }

  // ── Verdict logic ──
  const b1 = p1.budget.total,
    b2 = p2.budget.total;
  const s1 = p1.safety.overall_score,
    s2 = p2.safety.overall_score;
  let budgetWinner =
    b1 < b2 ? p1.destination : b2 < b1 ? p2.destination : "Tie";
  let safetyWinner =
    s1 > s2 ? p1.destination : s2 > s1 ? p2.destination : "Tie";
  const savings = Math.abs(b1 - b2);
  const safetyDiff = Math.abs(s1 - s2).toFixed(1);

  // Overall verdict
  let overallScore1 = 0,
    overallScore2 = 0;
  if (b1 <= b2) overallScore1++;
  else overallScore2++;
  if (s1 >= s2) overallScore1++;
  else overallScore2++;
  if (p1.weather && p2.weather) {
    if (p1.weather.humidity <= p2.weather.humidity) overallScore1++;
    else overallScore2++;
  }
  let overallWinner =
    overallScore1 > overallScore2
      ? p1.destination
      : overallScore2 > overallScore1
        ? p2.destination
        : "Tie";

  function verdictBanner() {
    if (overallWinner === "Tie") {
      return `<div class="cmp-verdict tie"><i class="fas fa-handshake"></i>
        <div class="cmp-verdict-text"><strong>It's a Tie!</strong><span>Both destinations are evenly matched</span></div></div>`;
    }
    const loser =
      overallWinner === p1.destination ? p2.destination : p1.destination;
    return `<div class="cmp-verdict">
      <div class="cmp-verdict-trophy"><i class="fas fa-trophy"></i></div>
      <div class="cmp-verdict-text"><strong>${overallWinner}</strong> <span>edges out ${loser} overall</span></div>
      <div class="cmp-verdict-pills">
        ${budgetWinner !== "Tie" ? `<span class="cmp-vpill budget"><i class="fas fa-wallet"></i> ${budgetWinner} saves ${formatINR(savings)}</span>` : ""}
        ${safetyWinner !== "Tie" ? `<span class="cmp-vpill safety"><i class="fas fa-shield-alt"></i> ${safetyWinner} +${safetyDiff} safer</span>` : ""}
      </div>
    </div>`;
  }

  // ── Quick Stats Row ──
  function quickStats() {
    const items = [
      {
        icon: "fa-wallet",
        label: "Budget Gap",
        value: savings > 0 ? formatINR(savings) : "Even",
        sub: savings > 0 ? `${budgetWinner} is cheaper` : "",
      },
      {
        icon: "fa-shield-alt",
        label: "Safety Gap",
        value: safetyDiff > 0 ? `${safetyDiff} pts` : "Even",
        sub: safetyDiff > 0 ? `${safetyWinner} is safer` : "",
      },
    ];
    if (p1.weather && p2.weather) {
      const tDiff = Math.abs(
        p1.weather.temperature_c - p2.weather.temperature_c,
      ).toFixed(1);
      const warmer =
        p1.weather.temperature_c >= p2.weather.temperature_c
          ? p1.destination
          : p2.destination;
      items.push({
        icon: "fa-thermometer-half",
        label: "Temp Diff",
        value: `${tDiff}°C`,
        sub: `${warmer} is warmer`,
      });
    }
    return `<div class="cmp-quick-stats">${items
      .map(
        (i) => `
      <div class="cmp-qs-item">
        <div class="cmp-qs-icon"><i class="fas ${i.icon}"></i></div>
        <div class="cmp-qs-label">${i.label}</div>
        <div class="cmp-qs-value">${i.value}</div>
        ${i.sub ? `<div class="cmp-qs-sub">${i.sub}</div>` : ""}
      </div>`,
      )
      .join("")}</div>`;
  }

  // ── Budget section (side-by-side) ──
  function budgetSection() {
    const cats = [
      "accommodation",
      "food",
      "transport",
      "activities",
      "miscellaneous",
    ];
    const icons = {
      accommodation: "fa-bed",
      food: "fa-utensils",
      transport: "fa-bus",
      activities: "fa-hiking",
      miscellaneous: "fa-ellipsis-h",
    };
    const maxTotal = Math.max(b1, b2);

    function budgetRows(p, other) {
      return cats
        .map((key) => {
          const val = p.budget[key];
          const otherVal = other.budget[key];
          const isLower = val < otherVal;
          return `<div class="cmp-brow">
          <span class="cmp-brow-icon"><i class="fas ${icons[key]}"></i></span>
          <span class="cmp-brow-label">${key.charAt(0).toUpperCase() + key.slice(1)}</span>
          <span class="cmp-brow-val ${isLower ? "cheaper" : ""}">${formatINR(val)} ${isLower ? '<i class="fas fa-arrow-down cmp-win-arrow"></i>' : ""}</span>
        </div>`;
        })
        .join("");
    }

    const pct1 = ((b1 / maxTotal) * 100).toFixed(0);
    const pct2 = ((b2 / maxTotal) * 100).toFixed(0);

    return `<div class="cmp-section-block">
      <div class="cmp-section-title"><i class="fas fa-wallet"></i> Budget Breakdown <span class="cmp-stag">${params.num_days} days · ${params.family_size} people · ${params.travel_class}</span></div>
      <div class="cmp-dual-col">
        <div class="cmp-col">
          <div class="cmp-col-head">${p1.destination}</div>
          ${budgetRows(p1, p2)}
          <div class="cmp-btotal">
            <span class="cmp-btotal-bar"><span class="cmp-btotal-fill ${b1 <= b2 ? "winner" : ""}" style="width:${pct1}%"></span></span>
            <span class="cmp-btotal-val ${b1 <= b2 ? "winner" : ""}">${formatINR(b1)}</span>
          </div>
        </div>
        <div class="cmp-col">
          <div class="cmp-col-head">${p2.destination}</div>
          ${budgetRows(p2, p1)}
          <div class="cmp-btotal">
            <span class="cmp-btotal-bar"><span class="cmp-btotal-fill ${b2 <= b1 ? "winner" : ""}" style="width:${pct2}%"></span></span>
            <span class="cmp-btotal-val ${b2 <= b1 ? "winner" : ""}">${formatINR(b2)}</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Safety section (side-by-side) ──
  function safetySection() {
    const cats = [
      { key: "crime_score", label: "Crime Safety", icon: "fa-gavel" },
      { key: "health_score", label: "Health", icon: "fa-heartbeat" },
      { key: "infrastructure_score", label: "Infrastructure", icon: "fa-road" },
      {
        key: "tourist_friendliness",
        label: "Tourist Friendly",
        icon: "fa-smile",
      },
    ];

    function safetyCol(p) {
      const s = p.safety;
      return `<div class="cmp-col">
        <div class="cmp-col-head">${p.destination} <span class="cmp-overall-badge" style="background:${scoreColor(s.overall_score)}">${s.overall_score}/10 · ${scoreLabel(s.overall_score)}</span></div>
        ${cats
          .map((c) => {
            const val = s[c.key];
            return `<div class="cmp-safety-row">
            <div class="cmp-sr-top"><span class="cmp-sr-icon"><i class="fas ${c.icon}"></i></span><span class="cmp-sr-label">${c.label}</span><span class="cmp-sr-num" style="color:${scoreColor(val)}">${val}/10</span></div>
            <div class="cmp-score-track"><div class="cmp-score-fill" data-w="${val * 10}%" style="width:0%;background:${scoreColor(val)}"></div></div>
          </div>`;
          })
          .join("")}
        <div class="cmp-advisory"><i class="fas fa-info-circle"></i> ${s.advisory}</div>
      </div>`;
    }

    return `<div class="cmp-section-block">
      <div class="cmp-section-title"><i class="fas fa-shield-alt"></i> Safety Analysis</div>
      <div class="cmp-dual-col">${safetyCol(p1)}${safetyCol(p2)}</div>
    </div>`;
  }

  // ── Weather section ──
  function weatherSection() {
    function weatherCol(p) {
      const w = p.weather;
      if (!w)
        return `<div class="cmp-col"><div class="cmp-col-head">${p.destination}</div><div class="cmp-weather-na"><i class="fas fa-cloud"></i> Weather data unavailable</div></div>`;
      const wIcon = w.description.toLowerCase().includes("rain")
        ? "fa-cloud-showers-heavy"
        : w.description.toLowerCase().includes("cloud")
          ? "fa-cloud"
          : w.description.toLowerCase().includes("clear") ||
              w.description.toLowerCase().includes("sun")
            ? "fa-sun"
            : "fa-cloud-sun";
      return `<div class="cmp-col">
        <div class="cmp-col-head">${p.destination}</div>
        <div class="cmp-weather-card">
          <div class="cmp-wc-icon"><i class="fas ${wIcon}"></i></div>
          <div class="cmp-wc-temp">${w.temperature_c}°C</div>
          <div class="cmp-wc-desc">${w.description}</div>
          <div class="cmp-wc-grid">
            <div class="cmp-wc-stat"><i class="fas fa-thermometer-half"></i><span>Feels like</span><strong>${w.feels_like_c}°C</strong></div>
            <div class="cmp-wc-stat"><i class="fas fa-tint"></i><span>Humidity</span><strong>${w.humidity}%</strong></div>
            <div class="cmp-wc-stat"><i class="fas fa-wind"></i><span>Wind</span><strong>${w.wind_speed_kmh} km/h</strong></div>
          </div>
          ${w.packing_suggestions && w.packing_suggestions.length ? `<div class="cmp-pack"><strong>Pack:</strong> ${w.packing_suggestions.slice(0, 4).join(", ")}</div>` : ""}
        </div>
      </div>`;
    }
    return `<div class="cmp-section-block">
      <div class="cmp-section-title"><i class="fas fa-cloud-sun"></i> Live Weather</div>
      <div class="cmp-dual-col">${weatherCol(p1)}${weatherCol(p2)}</div>
    </div>`;
  }

  // ── Destination info footer ──
  function destInfoFooter() {
    const m1 = getMeta(p1.destination);
    const m2 = getMeta(p2.destination);
    return `<div class="cmp-section-block">
      <div class="cmp-section-title"><i class="fas fa-info-circle"></i> Destination Quick Info</div>
      <div class="cmp-dual-col">
        <div class="cmp-col cmp-info-col">
          <div class="cmp-col-head">${p1.destination}</div>
          <div class="cmp-info-tags">
            ${m1.region ? `<span class="cmp-itag"><i class="fas fa-map-pin"></i> ${m1.region}</span>` : ""}
            ${m1.season ? `<span class="cmp-itag"><i class="fas fa-sun"></i> Best: ${m1.season}</span>` : ""}
            ${m1.highlight ? `<span class="cmp-itag"><i class="fas fa-star"></i> ${m1.highlight}</span>` : ""}
          </div>
        </div>
        <div class="cmp-col cmp-info-col">
          <div class="cmp-col-head">${p2.destination}</div>
          <div class="cmp-info-tags">
            ${m2.region ? `<span class="cmp-itag"><i class="fas fa-map-pin"></i> ${m2.region}</span>` : ""}
            ${m2.season ? `<span class="cmp-itag"><i class="fas fa-sun"></i> Best: ${m2.season}</span>` : ""}
            ${m2.highlight ? `<span class="cmp-itag"><i class="fas fa-star"></i> ${m2.highlight}</span>` : ""}
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Actions bar ──
  function actionsBar() {
    return `<div class="cmp-actions-bar">
      <button class="cmp-action-btn export" id="exportCmpPdf"><i class="fas fa-file-pdf"></i> Export PDF</button>
      <button class="cmp-action-btn share" id="cmpShareBtn"><i class="fas fa-share-alt"></i> Share</button>
    </div>`;
  }

  return `<div class="cmp-results-wrap">
    ${verdictBanner()}
    ${quickStats()}
    ${budgetSection()}
    ${safetySection()}
    ${weatherSection()}
    ${destInfoFooter()}
    ${actionsBar()}
  </div>`;
}
