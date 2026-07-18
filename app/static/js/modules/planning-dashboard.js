/* =======================================================
 * Time Travel - Planning Dashboard - Destination context + module status
 * ======================================================= */

(function () {
  "use strict";

  const MODULES = [
    "itinerary",
    "budget",
    "safety",
    "weather",
    "maps",
    "packing",
    "expenses",
    "journal",
  ];

  let plannerStatusTimer = null;
  let moduleMeta = {};

  function loadModuleMeta() {
    try {
      const raw = sessionStorage.getItem("tt_planner_module_meta");
      moduleMeta = raw ? JSON.parse(raw) : {};
    } catch (_e) {
      moduleMeta = {};
    }
  }

  function saveModuleMeta() {
    try {
      sessionStorage.setItem("tt_planner_module_meta", JSON.stringify(moduleMeta));
    } catch (_e) {
      // optional
    }
  }

  function setPlannerDestination(dest) {
    const input = document.getElementById("plannerDestinationInput");
    if (!input || !dest) return;
    input.value = dest;
  }

  function hydratePlannerDestination() {
    try {
      const saved = sessionStorage.getItem("tt_planner_dest");
      if (saved) setPlannerDestination(saved);
    } catch (_e) {
      // optional
    }
  }

  function hasGeneratedResult(resultId) {
    const el = document.getElementById(resultId);
    if (!el) return false;
    return !el.querySelector(".result-placeholder");
  }

  function hasSelectedValue(inputId) {
    const el = document.getElementById(inputId);
    return !!(el && (el.value || "").trim());
  }

  function isModuleReady(module) {
    switch (module) {
      case "itinerary":
        return hasGeneratedResult("itinResult");
      case "budget":
        return hasGeneratedResult("budgetResult");
      case "safety":
        return hasGeneratedResult("safetyResult");
      case "weather":
        return hasGeneratedResult("weatherResult");
      case "maps": {
        const poiCards = document.querySelectorAll("#poiResults .poi-card").length;
        const routeInfo = document.getElementById("routeInfo");
        const routeVisible =
          routeInfo &&
          window.getComputedStyle(routeInfo).display !== "none";
        return poiCards > 0 || !!routeVisible;
      }
      case "packing":
        return document.querySelectorAll("#packList .pack-item").length > 0;
      case "expenses":
        return document.querySelectorAll("#expList .exp-item").length > 0;
      case "journal":
        return document.querySelectorAll("#journalList .journal-entry").length > 0;
      default:
        return false;
    }
  }

  function isModuleStarted(module) {
    if (isModuleReady(module)) return true;
    switch (module) {
      case "itinerary":
        return hasSelectedValue("itinDest");
      case "budget":
        return hasSelectedValue("budgetDest");
      case "safety":
        return hasSelectedValue("safetyDest");
      case "weather":
        return hasSelectedValue("weatherDest");
      case "maps":
        return hasSelectedValue("mapDest");
      case "packing":
        return hasSelectedValue("packDest");
      case "expenses":
        return hasSelectedValue("expDest");
      case "journal":
        return (
          hasSelectedValue("journalDest") ||
          hasSelectedValue("journalTitle") ||
          hasSelectedValue("journalContent")
        );
      default:
        return false;
    }
  }

  function formatRelativeTime(ts) {
    if (!ts) return "--";
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 10) return "now";
    if (diffSec < 60) return `${diffSec}s`;
    const min = Math.floor(diffSec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    return `${day}d`;
  }

  function getFreshnessClass(ts) {
    if (!ts) return "";
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diffSec <= 5 * 60) return "status-fresh";
    if (diffSec <= 60 * 60) return "status-aging";
    return "status-stale";
  }

  function setStatusText(module, state) {
    const labels = {
      "not-started": "Not started",
      started: "In progress",
      ready: "Ready",
    };

    const meta = moduleMeta[module] || {};
    const stateChanged = meta.state !== state;
    if (stateChanged && (state === "started" || state === "ready")) {
      meta.updatedAt = Date.now();
    }
    meta.state = state;
    moduleMeta[module] = meta;

    const shortTime = formatRelativeTime(meta.updatedAt || 0);
    const label = `${labels[state]} | ${shortTime}`;
    const title = meta.updatedAt
      ? `Last updated: ${new Date(meta.updatedAt).toLocaleString()}`
      : "Last updated: not available";

    document.querySelectorAll(`[data-module-status="${module}"]`).forEach((el) => {
      el.textContent = label;
      el.setAttribute("title", title);
      el.classList.remove(
        "status-started",
        "status-ready",
        "status-fresh",
        "status-aging",
        "status-stale",
      );
      if (state === "started") el.classList.add("status-started");
      if (state === "ready") el.classList.add("status-ready");
      if (state === "started" || state === "ready") {
        const freshnessClass = getFreshnessClass(meta.updatedAt || 0);
        if (freshnessClass) el.classList.add(freshnessClass);
      }
    });
  }

  function updatePlannerStatus() {
    let completed = 0;

    MODULES.forEach((module) => {
      if (isModuleReady(module)) {
        completed += 1;
        setStatusText(module, "ready");
      } else if (isModuleStarted(module)) {
        setStatusText(module, "started");
      } else {
        setStatusText(module, "not-started");
      }
    });

    const pct = Math.round((completed / MODULES.length) * 100);
    const progressFill = document.getElementById("plannerProgressFill");
    const progressText = document.getElementById("plannerProgressText");
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `${completed} / ${MODULES.length} completed`;

    saveModuleMeta();
  }

  function syncPlannerNavActive() {
    const currentRoute =
      window.appRouter && typeof window.appRouter.getCurrentRoute === "function"
        ? window.appRouter.getCurrentRoute()
        : "planner";

    document.querySelectorAll(".planning-nav-link").forEach((link) => {
      const hash = (link.getAttribute("href") || "").replace("#", "");
      const isOverview = hash === "planningDashboard";
      const isPlannerActive = isOverview && currentRoute === "planner";
      const isMapped =
        (hash === "itinerary" && currentRoute === "itinerary") ||
        (hash === "budget" && currentRoute === "budget") ||
        (hash === "safety" && currentRoute === "budget") ||
        (hash === "weather" && currentRoute === "budget") ||
        (hash === "maps" && currentRoute === "maps") ||
        (hash === "packingChecklist" && currentRoute === "packing") ||
        (hash === "expenses" && currentRoute === "expenses") ||
        (hash === "journal" && currentRoute === "journal");

      link.classList.toggle("is-active", isPlannerActive || isMapped);
    });
  }

  function startPlannerMonitor() {
    if (plannerStatusTimer) return;
    plannerStatusTimer = window.setInterval(updatePlannerStatus, 2500);
  }

  function stopPlannerMonitor() {
    if (!plannerStatusTimer) return;
    window.clearInterval(plannerStatusTimer);
    plannerStatusTimer = null;
  }

  function bindPlannerActions() {
    const startBtn = document.getElementById("plannerStartBtn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        if (window.appRouter && typeof window.appRouter.navigateTo === "function") {
          window.appRouter.navigateTo("itinerary");
        }
      });
    }

    const plannerInput = document.getElementById("plannerDestinationInput");
    if (plannerInput) {
      plannerInput.addEventListener("change", () => {
        const val = (plannerInput.value || "").trim();
        if (!val) return;
        try {
          sessionStorage.setItem("tt_planner_dest", val);
        } catch (_e) {
          // optional
        }
        if (typeof setSharedDestinationContext === "function") {
          setSharedDestinationContext(val, { autoRun: false });
        }
      });
    }

    document.querySelectorAll(".planning-nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        document.querySelectorAll(".planning-nav-link").forEach((node) => {
          node.classList.remove("is-active");
        });
        link.classList.add("is-active");
      });
    });
  }

  window.addEventListener("routechange", (evt) => {
    const route = evt && evt.detail ? evt.detail.route : "";
    if (route === "planner") {
      hydratePlannerDestination();
      updatePlannerStatus();
      syncPlannerNavActive();
      startPlannerMonitor();
    } else {
      syncPlannerNavActive();
      stopPlannerMonitor();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      loadModuleMeta();
      bindPlannerActions();
      hydratePlannerDestination();
      updatePlannerStatus();
      syncPlannerNavActive();
    });
  } else {
    loadModuleMeta();
    bindPlannerActions();
    hydratePlannerDestination();
    updatePlannerStatus();
    syncPlannerNavActive();
  }
})();
