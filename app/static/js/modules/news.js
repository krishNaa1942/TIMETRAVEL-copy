/* =======================================================
 * Time Travel - Travel News - Destination news articles feed
 * ======================================================= */

/* ═══════════════════════════════════════════════════════════
   TRAVEL NEWS
   ═══════════════════════════════════════════════════════════ */
(function () {
  const destSel = document.getElementById("newsDest");
  const catSel = document.getElementById("newsCat");
  const searchBtn = document.getElementById("newsSearchBtn");
  const grid = document.getElementById("newsResults");
  if (!destSel || !grid) return;

  let currentTab = "latest";
  let ctxTimer = null;
  let lastCtxId = "";

  /* ── Populate destination dropdown ─── */
  async function loadNewsDests() {
    try {
      const r = await fetch("/api/news/destinations");
      if (!r.ok) return;
      const d = await r.json();
      (d.destinations || []).forEach((name) => {
        const o = document.createElement("option");
        o.value = name;
        o.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        destSel.appendChild(o);
      });
    } catch (_) {}
  }

  /* ── Render article cards ─── */
  function renderCards(articles) {
    const emptyEl = document.getElementById("newsEmpty");
    if (emptyEl) emptyEl.style.display = "none";
    grid.style.display = "grid";
    if (!articles || articles.length === 0) {
      grid.innerHTML =
        '<div class="news-empty"><i class="fas fa-newspaper"></i><p>No news articles found. Try a different destination or category.</p></div>';
      return;
    }
    grid.innerHTML = articles
      .map(
        (a) => `
      <article class="news-card">
        ${
          a.image_url
            ? `<img src="${a.image_url}" alt="" class="news-card-img" loading="lazy"
                 data-img-fallback>`
            : '<div class="news-card-img placeholder"><i class="fas fa-newspaper"></i></div>'
        }
        <div class="news-card-body">
          <div class="news-card-meta">
            <span class="news-card-source">${a.source || "Unknown"}</span>
            <span class="news-card-date">${formatNewsDate(a.published_at)}</span>
          </div>
          <h3 class="news-card-title">${escapeHTML(a.title || "Untitled")}</h3>
          <p class="news-card-desc">${escapeHTML(a.description || "")}</p>
          <a href="${a.url}" target="_blank" rel="noopener" class="news-card-link">
            Read More <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      </article>`,
      )
      .join("");
  }

  // escapeHTML — now uses global escapeHtml defined at top of file

  function formatNewsDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function showLoading() {
    grid.style.display = "grid";
    grid.innerHTML =
      '<div class="news-loading"><i class="fas fa-spinner"></i><p>Fetching news...</p></div>';
  }

  /* ── Fetch by tab type ─── */
  async function fetchNews() {
    showLoading();
    const dest = destSel.value;
    const cat = catSel.value;
    let url;
    if (currentTab === "trending") {
      url = "/api/news/trending?limit=9";
    } else if (currentTab === "safety") {
      url = `/api/news/safety?limit=9${dest ? "&destination=" + encodeURIComponent(dest) : ""}`;
    } else {
      url = `/api/news/travel?limit=9${dest ? "&destination=" + encodeURIComponent(dest) : ""}&category=${encodeURIComponent(cat)}`;
    }
    try {
      const r = await fetch(url);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        grid.style.display = "grid";
        grid.innerHTML = `<div class="news-empty"><i class="fas fa-exclamation-triangle"></i><p>${e.error || "Failed to fetch news"}</p></div>`;
        return;
      }
      const data = await r.json();
      renderCards(data.articles || []);
    } catch (err) {
      grid.style.display = "grid";
      grid.innerHTML =
        '<div class="news-empty"><i class="fas fa-exclamation-triangle"></i><p>Network error. Please try again.</p></div>';
    }
  }

  /* ── Tab switching ─── */
  document.querySelectorAll(".news-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".news-tab")
        .forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      currentTab = btn.dataset.tab;
      fetchNews();
    });
  });

  /* ── Search button ─── */
  searchBtn.addEventListener("click", () => {
    currentTab = "latest";
    document
      .querySelectorAll(".news-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelector('.news-tab[data-tab="latest"]')
      .classList.add("active");
    fetchNews();
  });

  function bindNewsDestinationContextListener() {
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

      clearTimeout(ctxTimer);
      ctxTimer = setTimeout(() => {
        const dedupeId =
          detail.contextId || `${dest.toLowerCase()}:${detail.autoRun ? 1 : 0}`;
        if (dedupeId === lastCtxId) return;
        lastCtxId = dedupeId;

        const match = Array.from(destSel.options || []).find(
          (o) => (o.value || "").toLowerCase() === dest.toLowerCase(),
        );
        if (match) {
          destSel.value = match.value;
        } else {
          const o = document.createElement("option");
          o.value = dest;
          o.textContent = dest;
          destSel.appendChild(o);
          destSel.value = dest;
        }

        if (detail.autoRun && searchBtn && !searchBtn.disabled) {
          searchBtn.click();
        }
      }, 240);
    });
  }

  /* ── Auto-load on scroll into view ─── */
  let newsLoaded = false;
  const newsSection = document.getElementById("news");
  if (newsSection && "IntersectionObserver" in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !newsLoaded) {
          newsLoaded = true;
          fetchNews();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(newsSection);
  }

  loadNewsDests();
  bindNewsDestinationContextListener();
})();
