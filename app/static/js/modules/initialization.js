/* =======================================================
 * Time Travel - Initialization & UX Enhancements
 * Startup checks, performance monitoring, error boundaries
 * ======================================================= */

/**
 * Global error handler to catch unhandled errors
 */
window.addEventListener("error", (event) => {
  console.error("Unhandled error:", event.error);

  // Only show error to user for critical errors
  if (event.error && event.error.message.includes("CRITICAL")) {
    showToast(
      "A critical error occurred. Please refresh the page.",
      "error",
      0,
    );
  }
});

/**
 * Global unhandled promise rejection handler
 */
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);

  // Notify user only for critical failures
  if (event.reason && typeof event.reason === "object") {
    if (event.reason.critical) {
      showToast(
        "Something went wrong. Please try again or contact support.",
        "error",
      );
    }
  }
});

/**
 * Performance monitoring
 */
class PerformanceMonitor {
  static init() {
    const isLocalhost =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const verbosePerf =
      isLocalhost ||
      location.search.includes("debugPerf=1") ||
      localStorage.getItem("tt_debug_perf") === "1";

    // Monitor page load performance
    if (window.performance && performance.timing) {
      window.addEventListener("load", () => {
        const loadTime =
          performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(`📊 Page load time: ${loadTime}ms`);

        // Log warning if load is slow
        if (loadTime > 4000) {
          console.warn("⚠️ Page load is slow. Consider optimizing assets.");
        }
      });
    }

    // Monitor long tasks
    if ("PerformanceObserver" in window) {
      try {
        const LONG_TASK_THRESHOLD_MS = 120;
        const REPORT_INTERVAL_MS = 8000;
        let longTaskCount = 0;
        let longTaskTotalMs = 0;
        let longTaskMaxMs = 0;
        let lastReportAt = performance.now();

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const duration = entry.duration;

            if (duration < LONG_TASK_THRESHOLD_MS) {
              continue;
            }

            longTaskCount += 1;
            longTaskTotalMs += duration;
            longTaskMaxMs = Math.max(longTaskMaxMs, duration);

            if (verbosePerf) {
              console.warn(`⚠️ Long task: ${duration.toFixed(0)}ms`);
            }
          }

          const now = performance.now();
          if (now - lastReportAt >= REPORT_INTERVAL_MS && longTaskCount > 0) {
            const avgMs = longTaskTotalMs / longTaskCount;
            console.warn(
              `⚠️ Performance summary (${Math.round(REPORT_INTERVAL_MS / 1000)}s): ${longTaskCount} long tasks, avg ${avgMs.toFixed(0)}ms, max ${longTaskMaxMs.toFixed(0)}ms`,
            );

            longTaskCount = 0;
            longTaskTotalMs = 0;
            longTaskMaxMs = 0;
            lastReportAt = now;
          }
        });
        observer.observe({ entryTypes: ["longtask"] });
      } catch (e) {
        // PerformanceObserver not fully supported
      }
    }
  }
}

/**
 * Startup validation
 */
class StartupValidator {
  static init() {
    // Check for required global functions
    const requiredFunctions = [
      "getCSRFToken",
      "escapeHtml",
      "showToast",
      "removeToast",
      "showLoader",
      "hideLoader",
    ];

    const missing = requiredFunctions.filter(
      (fn) => typeof window[fn] !== "function",
    );
    if (missing.length > 0) {
      console.error(`❌ Missing required functions: ${missing.join(", ")}`);
      showToast(
        "Application initialization error. Please refresh the page.",
        "error",
        0,
      );
    }

    // Check for required DOM elements
    const requiredElements = [
      "#appMain",
      "#mainNav",
      "#toast-container",
      "#loader",
    ];

    const missingElements = requiredElements.filter(
      (sel) => !document.querySelector(sel),
    );
    if (missingElements.length > 0) {
      console.error(
        `❌ Missing required DOM elements: ${missingElements.join(", ")}`,
      );
    }

    console.log("✅ Startup validation passed");
  }
}

/**
 * Session storage for recovery
 */
class SessionRecovery {
  static saveState(key, value) {
    try {
      sessionStorage.setItem(`tt_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn("Could not save to sessionStorage:", e);
    }
  }

  static getState(key) {
    try {
      const value = sessionStorage.getItem(`tt_${key}`);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.warn("Could not read from sessionStorage:", e);
      return null;
    }
  }

  static clearState(key) {
    try {
      sessionStorage.removeItem(`tt_${key}`);
    } catch (e) {
      console.warn("Could not clear sessionStorage:", e);
    }
  }
}

/**
 * Auto-save and recovery for forms
 */
class FormRecovery {
  static init() {
    // Find all forms with data-auto-save attribute
    document.querySelectorAll("form[data-auto-save]").forEach((form) => {
      const formKey = form.id || form.getAttribute("data-auto-save");

      // Load saved data if available
      const savedData = SessionRecovery.getState(`form_${formKey}`);
      if (savedData) {
        Object.keys(savedData).forEach((key) => {
          const field = form.querySelector(`[name="${key}"]`);
          if (field) {
            field.value = savedData[key];
          }
        });
      }

      // Auto-save on input
      const autoSaveHandler = debounce(() => {
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
          data[key] = value;
        });
        SessionRecovery.saveState(`form_${formKey}`, data);
        console.log(`📝 Auto-saved form: ${formKey}`);
      }, 1000);

      form.addEventListener("input", autoSaveHandler);

      // Clear saved data on successful form submission
      form.addEventListener("submit", () => {
        SessionRecovery.clearState(`form_${formKey}`);
      });
    });
  }
}

/**
 * Initialize features
 */
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Time Travel App Starting...");

  try {
    // Startup checks
    StartupValidator.init();

    // Performance monitoring
    PerformanceMonitor.init();

    // Form recovery
    FormRecovery.init();

    console.log("✅ App initialization complete");
  } catch (error) {
    console.error("❌ Initialization error:", error);
    showToast(
      "There was an issue starting the application. Please refresh the page.",
      "error",
      0,
    );
  }
});

/**
 * Keyboard shortcuts for better UX
 */
document.addEventListener("keydown", (e) => {
  // Cmd/Ctrl + K for search
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    const searchInput = document.querySelector(
      "[data-search-main], #heroSearchInput",
    );
    if (searchInput) {
      searchInput.focus();
      showToast("Search focused. Type to search...", "info", 2000);
    }
  }

  // Escape to close modals
  if (e.key === "Escape") {
    const modals = document.querySelectorAll(
      "[data-modal].open, .modal.active",
    );
    modals.forEach((modal) => {
      modal.classList.remove("active", "open");
      if (typeof closeAuthModal === "function" && modal.id === "authModal") {
        closeAuthModal();
      }
    });
  }
});

/**
 * Smooth scroll behavior fallback
 */
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) {
    console.warn(`Section not found: ${sectionId}`);
    return;
  }

  const offset = 100; // Account for fixed navbar
  const top = section.getBoundingClientRect().top + window.scrollY - offset;

  window.scrollTo({
    top,
    behavior: "smooth",
  });

  // Focus the section for accessibility
  section.focus();
  section.setAttribute("tabindex", "-1");
}

/**
 * Browser compatibility check
 */
class BrowserCheck {
  static init() {
    // Check for required APIs
    const requiredAPIs = {
      Fetch: "fetch",
      Promise: "Promise",
      localStorage: "localStorage",
      sessionStorage: "sessionStorage",
      requestAnimationFrame: "requestAnimationFrame",
    };

    const unsupported = Object.keys(requiredAPIs).filter((api) => {
      return typeof window[requiredAPIs[api]] === "undefined";
    });

    if (unsupported.length > 0) {
      console.error("⚠️ Browser missing required APIs:", unsupported);
      showToast(
        "Your browser may not fully support this application. Please upgrade to a modern browser.",
        "warning",
      );
    }

    // Detect mobile
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (isMobile) {
      console.log("📱 Mobile device detected");
      document.documentElement.classList.add("is-mobile");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  BrowserCheck.init();
});

console.log("✓ Initialization & UX Enhancements loaded");
