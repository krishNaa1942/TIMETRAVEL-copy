/* =======================================================
 * Time Travel - Travel Services - Booking links, currency converter, language phrases
 * ======================================================= */

// BOOKING LINKS – Quick links to travel booking platforms
// ═══════════════════════════════════════════════════════════
function initBookingSection() {
  const btn = document.getElementById("bookingSearchBtn");
  if (!btn) return;

  // Set default dates (tomorrow + day after)
  const ci = document.getElementById("bookingCheckin");
  const co = document.getElementById("bookingCheckout");
  if (ci && !ci.value) {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 7);
    ci.value = tmrw.toISOString().split("T")[0];
    const dayAfter = new Date(tmrw);
    dayAfter.setDate(dayAfter.getDate() + 3);
    co.value = dayAfter.toISOString().split("T")[0];
  }

  btn.addEventListener("click", async () => {
    const dest = document.getElementById("bookingDest").value;
    if (!dest) return showToast("Please select a destination.", "warning");

    const checkin = ci.value || "";
    const checkout = co.value || "";
    const resultDiv = document.getElementById("bookingResult");

    resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:var(--primary-light)"></i><p>Finding booking links…</p></div>`;

    try {
      const params = new URLSearchParams({
        destination: dest,
        checkin,
        checkout,
      });
      const res = await fetch(`${API_BASE}/api/booking/links?${params}`);
      const data = await res.json();

      if (!res.ok) {
        resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i><p>${data.error || "Failed to load booking links."}</p></div>`;
        return;
      }

      const CATEGORY_ICONS = {
        flights: "fa-plane",
        hotels: "fa-hotel",
        trains: "fa-train",
        buses: "fa-bus",
      };
      const CATEGORY_LABELS = {
        flights: "Flights",
        hotels: "Hotels & Stays",
        trains: "Trains",
        buses: "Buses",
      };

      let html = '<div class="booking-results">';
      for (const [cat, platforms] of Object.entries(data.links)) {
        if (!platforms || platforms.length === 0) continue;
        html += `
          <div class="booking-category">
            <h4 class="booking-cat-title"><i class="fas ${CATEGORY_ICONS[cat] || "fa-link"}"></i> ${CATEGORY_LABELS[cat] || cat}</h4>
            <div class="booking-platform-grid">
              ${platforms
                .map(
                  (p) => `
                <a href="${p.url}" target="_blank" rel="noopener" class="booking-platform-card" style="border-left:4px solid ${p.color || "var(--primary)"}">
                  <div class="booking-platform-icon"><i class="${p.icon || "fas fa-external-link-alt"}"></i></div>
                  <div class="booking-platform-info">
                    <strong>${p.platform}</strong>
                    <small>${p.description || ""}</small>
                  </div>
                  <i class="fas fa-external-link-alt booking-ext-icon"></i>
                </a>
              `,
                )
                .join("")}
            </div>
          </div>`;
      }
      html += "</div>";
      resultDiv.innerHTML = html;
    } catch {
      resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i><p>Network error – is the server running?</p></div>`;
    }
  });
}

// ═══════════════════════════════════════════════════════════
// CURRENCY CONVERTER – Live exchange rates
// ═══════════════════════════════════════════════════════════
function initCurrencyConverter() {
  const amountEl = document.getElementById("currAmount");
  const fromEl = document.getElementById("currFrom");
  const toEl = document.getElementById("currTo");
  const swapBtn = document.getElementById("currSwap");
  const convertedEl = document.getElementById("currConverted");
  const rateInfoEl = document.getElementById("currRateInfo");

  if (!amountEl || !fromEl || !toEl) return;

  async function doConvert() {
    const amount = parseFloat(amountEl.value);
    if (!amount || amount <= 0) {
      convertedEl.textContent = "—";
      rateInfoEl.textContent = "";
      return;
    }

    try {
      const params = new URLSearchParams({
        amount: amount,
        from: fromEl.value,
        to: toEl.value,
      });
      const res = await fetch(`${API_BASE}/api/currency/convert?${params}`);
      const data = await res.json();

      if (!res.ok) {
        convertedEl.textContent = "Error";
        rateInfoEl.textContent = data.error || "Conversion failed";
        return;
      }

      convertedEl.textContent = `${data.symbol}${Number(data.converted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      rateInfoEl.textContent = `1 ${data.from} = ${Number(data.rate).toFixed(4)} ${data.to}${data.source === "fallback" ? " (offline rate)" : ""}`;
    } catch {
      convertedEl.textContent = "—";
      rateInfoEl.textContent = "Network error";
    }
  }

  // Debounce input
  let convertTimer;
  function triggerConvert() {
    clearTimeout(convertTimer);
    convertTimer = setTimeout(doConvert, 400);
  }

  amountEl.addEventListener("input", triggerConvert);
  fromEl.addEventListener("change", doConvert);
  toEl.addEventListener("change", doConvert);

  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const tmp = fromEl.value;
      fromEl.value = toEl.value;
      toEl.value = tmp;
      swapBtn.classList.add("spinning");
      setTimeout(() => swapBtn.classList.remove("spinning"), 300);
      doConvert();
    });
  }

  // Initial conversion
  doConvert();
}

// ═══════════════════════════════════════════════════════════
// LOCAL LANGUAGE HELPER – Phrase book for destinations
// ═══════════════════════════════════════════════════════════
function initLanguageSection() {
  const btn = document.getElementById("langSearchBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const dest = document.getElementById("langDest").value;
    if (!dest) return showToast("Please select a destination.", "warning");

    const resultDiv = document.getElementById("langResult");
    resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:var(--primary-light)"></i><p>Loading phrases…</p></div>`;

    try {
      const res = await fetch(
        `${API_BASE}/api/language/phrases?destination=${encodeURIComponent(dest)}`,
      );
      const data = await res.json();

      if (!res.ok) {
        resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i><p>${data.error || "Failed to load phrases."}</p></div>`;
        return;
      }

      let html = `
        <div class="lang-results">
          <div class="lang-header">
            <span class="lang-badge"><i class="fas fa-language"></i> ${data.language}</span>
            ${data.script ? `<span class="lang-script">${data.script}</span>` : ""}
          </div>
          <div class="lang-phrases-grid">
            ${data.phrases
              .map(
                (p) => `
              <div class="lang-phrase-card">
                <div class="lang-phrase-text">${p.phrase}</div>
                <div class="lang-phrase-trans">${p.transliteration}</div>
                <div class="lang-phrase-meaning">${p.meaning}</div>
                <small class="lang-phrase-usage"><i class="fas fa-info-circle"></i> ${p.usage}</small>
              </div>
            `,
              )
              .join("")}
          </div>`;

      if (data.travel_tips && data.travel_tips.length) {
        html += `
          <div class="lang-tips">
            <h4><i class="fas fa-lightbulb"></i> Travel Tips</h4>
            <ul>${data.travel_tips.map((t) => `<li>${t}</li>`).join("")}</ul>
          </div>`;
      }
      html += "</div>";
      resultDiv.innerHTML = html;
    } catch {
      resultDiv.innerHTML = `<div class="result-placeholder"><i class="fas fa-exclamation-triangle" style="color:var(--accent)"></i><p>Network error – is the server running?</p></div>`;
    }
  });
}

